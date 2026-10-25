/**
 * 功能：图片附件的规范化——去除敏感元数据并在写入前核对像素尺寸。
 * 作用：纯 JS 实现（不依赖原生库），对 JPEG/PNG/WebP 做段/块级删除；解析失败一律拒绝，绝不"存原图兜底"。
 * 关联文件：packages/attachment/attachment/src/index.ts、attachment-local/src/index.ts。
 */

/** 单边像素上限；超过即拒绝，避免超大图进入上下文或撑爆请求。 */
export const ATTACHMENT_MAX_DIMENSION = 4096;

export interface NormalizedImage {
  data: Uint8Array;
  width: number | null;
  height: number | null;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** 允许保留的 PNG 关键/渲染块；其余辅助块（文本、时间、Exif）全部删除。 */
const PNG_KEEP = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND", "gAMA", "cHRM", "sRGB", "bKGD", "pHYs"]);

function ascii(data: Uint8Array, offset: number, length: number): string {
  let value = "";
  for (let index = 0; index < length; index += 1) value += String.fromCharCode(data[offset + index]!);
  return value;
}

function u16be(data: Uint8Array, offset: number): number { return (data[offset]! << 8) | data[offset + 1]!; }
function u16le(data: Uint8Array, offset: number): number { return data[offset]! | (data[offset + 1]! << 8); }
function u32be(data: Uint8Array, offset: number): number { return ((data[offset]! << 24) | (data[offset + 1]! << 16) | (data[offset + 2]! << 8) | data[offset + 3]!) >>> 0; }

function concat(parts: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.byteLength; }
  return out;
}

function normalizePng(data: Uint8Array): NormalizedImage {
  if (data.byteLength < 8 + 12 + 13) throw new Error("PNG 结构不完整。");
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) if (data[index] !== PNG_SIGNATURE[index]) throw new Error("PNG 签名不一致。");
  const parts: Uint8Array[] = [data.subarray(0, 8)];
  let offset = 8;
  let width: number | null = null;
  let height: number | null = null;
  let total = 8;
  let sawIend = false;
  while (offset + 12 <= data.byteLength) {
    const length = u32be(data, offset);
    if (length > data.byteLength - offset - 12) throw new Error("PNG 块长度越界。");
    const type = ascii(data, offset + 4, 4);
    const chunk = data.subarray(offset, offset + 12 + length);
    if (type === "IHDR") {
      if (length !== 13) throw new Error("PNG IHDR 长度无效。");
      width = u32be(data, offset + 8);
      height = u32be(data, offset + 12);
    }
    if (PNG_KEEP.has(type)) { parts.push(chunk); total += chunk.byteLength; }
    offset += 12 + length;
    if (type === "IEND") { sawIend = true; break; }
  }
  if (!sawIend) throw new Error("PNG 缺少 IEND。");
  return { data: concat(parts, total), width, height };
}

function normalizeJpeg(data: Uint8Array): NormalizedImage {
  if (data.byteLength < 4 || data[0] !== 0xff || data[1] !== 0xd8) throw new Error("JPEG 签名不一致。");
  const parts: Uint8Array[] = [data.subarray(0, 2)];
  let offset = 2;
  let total = 2;
  let width: number | null = null;
  let height: number | null = null;
  while (offset + 4 <= data.byteLength) {
    if (data[offset] !== 0xff) throw new Error("JPEG 段标记无效。");
    const marker = data[offset + 1]!;
    if (marker === 0xd9) { parts.push(data.subarray(offset, offset + 2)); total += 2; offset += 2; break; }
    if (marker === 0xda) {
      // SOS 之后是熵编码数据，原样保留到文件末尾。
      const rest = data.subarray(offset);
      parts.push(rest); total += rest.byteLength; offset = data.byteLength; break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { parts.push(data.subarray(offset, offset + 2)); total += 2; offset += 2; continue; }
    const length = u16be(data, offset + 2);
    if (length < 2 || offset + 2 + length > data.byteLength) throw new Error("JPEG 段长度越界。");
    const segment = data.subarray(offset, offset + 2 + length);
    const isExif = marker === 0xe1;
    const isIptc = marker === 0xed;
    const isComment = marker === 0xfe;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame && length >= 7) { height = u16be(data, offset + 5); width = u16be(data, offset + 7); }
    if (!isExif && !isIptc && !isComment) { parts.push(segment); total += segment.byteLength; }
    offset += 2 + length;
  }
  if (offset < data.byteLength) { const tail = data.subarray(offset); parts.push(tail); total += tail.byteLength; }
  return { data: concat(parts, total), width, height };
}

function normalizeWebp(data: Uint8Array): NormalizedImage {
  if (data.byteLength < 30) throw new Error("WebP 结构不完整。");
  if (ascii(data, 0, 4) !== "RIFF" || ascii(data, 8, 4) !== "WEBP") throw new Error("WebP 签名不一致。");
  const parts: Uint8Array[] = [data.subarray(0, 12)];
  let offset = 12;
  let total = 12;
  let width: number | null = null;
  let height: number | null = null;
  while (offset + 8 <= data.byteLength) {
    const type = ascii(data, offset, 4);
    const size = u16le(data, offset + 4) | (u16le(data, offset + 6) << 16);
    const end = offset + 8 + size + (size % 2);
    if (end > data.byteLength) throw new Error("WebP 块长度越界。");
    if (type === "VP8X" && size >= 10) {
      width = 1 + (data[offset + 12]! | (data[offset + 13]! << 8) | (data[offset + 14]! << 16));
      height = 1 + (data[offset + 15]! | (data[offset + 16]! << 8) | (data[offset + 17]! << 16));
    }
    if (type !== "EXIF" && type !== "XMP ") { const chunk = data.subarray(offset, end); parts.push(chunk); total += chunk.byteLength; }
    offset = end;
  }
  const out = concat(parts, total);
  if (out.byteLength >= 4) { const size = out.byteLength - 8; out[4] = size & 0xff; out[5] = (size >>> 8) & 0xff; out[6] = (size >>> 16) & 0xff; out[7] = (size >>> 24) & 0xff; }
  return { data: out, width, height };
}

function normalizeGif(data: Uint8Array): NormalizedImage {
  if (data.byteLength < 13) throw new Error("GIF 结构不完整。");
  const header = ascii(data, 0, 6);
  if (header !== "GIF87a" && header !== "GIF89a") throw new Error("GIF 签名不一致。");
  // GIF 的注释块不含定位信息，且解析块链较长；这里只读尺寸，不做字节改写。
  return { data, width: u16le(data, 6), height: u16le(data, 8) };
}

/** 按媒体类型规范化；不认识的类型原样返回，像素尺寸为未知。 */
export function normalizeAttachmentImage(mediaType: string, data: Uint8Array): NormalizedImage {
  if (mediaType === "image/png") return normalizePng(data);
  if (mediaType === "image/jpeg") return normalizeJpeg(data);
  if (mediaType === "image/webp") return normalizeWebp(data);
  if (mediaType === "image/gif") return normalizeGif(data);
  return { data, width: null, height: null };
}
