/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-tool-fs/src/read-image.ts。
 * 功能：读取图片文件（PNG/JPEG/WebP/GIF）——按扩展名 + 魔数识别格式，读字节返回引用信息。
 * 与 DSH 差异（重要）：DSH 把图送入 attachment 持久化并产出真正的 image 内容块给多模态模型；
 *   LFAA 的 attachment 服务（packages/attachment/*）尚未实现，本模块：
 *   - 真实实现魔数嗅探（sniffImageMediaType）与字节读取（有界）；
 *   - 返回 {path, mediaType, bytes, note}，图片以“路径 + 说明”形式交给模型；
 *   - 真正的图片块渲染/尺寸解码留作「集成需要」（待 attachment 服务与多模态链路就绪）。
 * 关联文件：read-target.ts、index.ts。
 */
import { extname } from "node:path";
import { readFile } from "node:fs/promises";
import { FsToolError } from "./error.js";

/** 支持的图片 MIME。 */
export type ImageMediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

/** 按扩展名声明的图片类型。 */
const EXT_MAP: Record<string, ImageMediaType> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIG = [0xff, 0xd8, 0xff];

function startsWith(data: Uint8Array, offset: number, expected: readonly number[]): boolean {
  if (data.byteLength < offset + expected.length) return false;
  return expected.every((byte, i) => data[offset + i] === byte);
}

function asciiStartsWith(data: Uint8Array, offset: number, value: string): boolean {
  if (data.byteLength < offset + value.length) return false;
  for (let i = 0; i < value.length; i += 1) if (data[offset + i] !== value.charCodeAt(i)) return false;
  return true;
}

/** 按文件魔数识别图片格式；不支持返回 undefined。 */
export function sniffImageMediaType(data: Uint8Array): ImageMediaType | undefined {
  if (startsWith(data, 0, PNG_SIG)) return "image/png";
  if (startsWith(data, 0, JPEG_SIG)) return "image/jpeg";
  if (asciiStartsWith(data, 0, "GIF87a") || asciiStartsWith(data, 0, "GIF89a")) return "image/gif";
  if (asciiStartsWith(data, 0, "RIFF") && asciiStartsWith(data, 8, "WEBP")) return "image/webp";
  return undefined;
}

/** 按扩展名得到声明的图片类型；非图片扩展名返回 undefined。 */
export function imageMediaTypeForPath(filePath: string): ImageMediaType | undefined {
  return EXT_MAP[extname(filePath).toLowerCase()];
}

/** 图片读取结果。 */
export interface ImageReadResult {
  readonly path: string;
  readonly mediaType: ImageMediaType;
  readonly bytes: number;
  readonly note: string;
}

/** 读取图片字节并识别格式；上限 8 MiB。真正的多模态图片块待 attachment 服务就绪后接入。 */
export async function readImageFile(abs: string, display: string): Promise<ImageReadResult> {
  let data: Buffer;
  try {
    data = await readFile(abs);
  } catch {
    throw new FsToolError(`找不到图片：${display}`, "FS_NOT_FOUND");
  }
  if (data.byteLength > 8 * 1024 * 1024) {
    throw new FsToolError(`图片过大（${data.byteLength} 字节，超过 8 MiB）。请缩小后再读。`, "FS_TOO_LARGE");
  }
  const mediaType = sniffImageMediaType(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  if (mediaType === undefined) {
    throw new FsToolError(`文件内容不是受支持的 PNG/JPEG/WebP/GIF：${display}`, "FS_NOT_TEXT");
  }
  return {
    path: display,
    mediaType,
    bytes: data.byteLength,
    note: "当前 LFAA 未挂载 attachment 服务，图片以路径+元信息返回；多模态图片块渲染需 attachment/多模态链路就绪后接入（集成需要）。"
  };
}
