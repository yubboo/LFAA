/**
 * 功能：大于阈值时把图片重编码为更小的 jpeg/webp（去元数据、限边）。
 * 作用：sharp 为可选依赖；不可用或图片本身很小时返回 null，由调用方回退到字节级规范化。
 * 关联文件：packages/attachment/attachment/src/normalize.ts、attachment-local/src/index.ts。
 */
import { ATTACHMENT_MAX_DIMENSION } from "lfaa-attachment/src/index.js";

/** 超过这个边长或字节数才值得重编码；小图保留原字节，避免无谓画质损失。 */
const REENCODE_MAX_DIMENSION = 2048;
const REENCODE_MIN_BYTES = 1.5 * 1024 * 1024;
const JPEG_QUALITY = 82;

export interface ReencodedImage {
  data: Uint8Array;
  mediaType: string;
  width: number | null;
  height: number | null;
}

/** GIF 可能是动画，重编码会丢帧，因此永不进入这条路径。 */
export async function reencodeWithSharp(mediaType: string, data: Uint8Array): Promise<ReencodedImage | null> {
  if (mediaType === "image/gif") return null;
  let sharpModule: typeof import("sharp") | undefined;
  try { sharpModule = await import("sharp"); } catch { return null; }
  const sharp = sharpModule.default;
  const input = Buffer.from(data);
  let meta: import("sharp").Metadata;
  try { meta = await sharp(input).metadata(); } catch { throw new Error("图片无法解码，已拒绝上传。"); }
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
  if (longest === 0) throw new Error("图片缺少可用尺寸信息，已拒绝上传。");
  if (longest > ATTACHMENT_MAX_DIMENSION * 2) throw new Error("图片尺寸远超上限（" + longest + " 像素），已拒绝上传。");
  const needsResize = longest > REENCODE_MAX_DIMENSION;
  const needsShrink = data.byteLength > REENCODE_MIN_BYTES;
  if (!needsResize && !needsShrink) return null;
  // rotate() 先按 EXIF 方向归正，输出不带任何元数据。
  let pipeline = sharp(input).rotate();
  if (needsResize) pipeline = pipeline.resize({ width: REENCODE_MAX_DIMENSION, height: REENCODE_MAX_DIMENSION, fit: "inside", withoutEnlargement: true });
  const output = meta.hasAlpha ? await pipeline.webp({ quality: JPEG_QUALITY }).toBuffer() : await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  const outputMeta = await sharp(output).metadata();
  return {
    data: new Uint8Array(output),
    mediaType: meta.hasAlpha ? "image/webp" : "image/jpeg",
    width: outputMeta.width ?? null,
    height: outputMeta.height ?? null
  };
}
