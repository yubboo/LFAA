/**
 * 功能：定义附件（图片/文本）的稳定记录、边界与读取合同。
 * 作用：作为附件类型的唯一 Owner：媒体类型嗅探、大小上限、摘要与数据 URL 都由这里定义；存储由提供方实现。
 * 关联文件：packages/attachment/attachment-local、fs/tool-fs/src/read-image.ts、llm/llm/src/completion.ts。
 */

/** 单个附件上限；超过即拒绝，不做静默截断。 */
export const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;

/** 单账户附件数量与总容量上限；超限拒绝上传，不做静默覆盖或删除。 */
export const ATTACHMENT_MAX_COUNT_PER_USER = 200;
export const ATTACHMENT_MAX_TOTAL_BYTES = 200 * 1024 * 1024;

/** 受支持的附件媒体类型；不在白名单内的内容一律拒绝。 */
export const ATTACHMENT_MEDIA_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "text/plain"] as const;
export type AttachmentMediaType = typeof ATTACHMENT_MEDIA_TYPES[number];

/** 一次已持久化附件的公开描述；不包含本机路径。 */
export interface AttachmentRecord {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly mediaType: AttachmentMediaType;
  readonly bytes: number;
  readonly sha256: string;
  readonly createdAt: string;
}

/** 附件读取结果：记录 + 原始字节。 */
export interface AttachmentContent {
  readonly record: AttachmentRecord;
  readonly data: Uint8Array;
}

/** 附件存储合同；账户隔离与路径围栏由提供方负责。 */
export interface AttachmentStore {
  put(input: { userId: string; name: string; mediaType: AttachmentMediaType; data: Uint8Array }): Promise<AttachmentRecord>;
  get(userId: string, id: string): Promise<AttachmentContent>;
  list(userId: string): Promise<AttachmentRecord[]>;
  /** 当前账户占用（条数与总字节），用于配额判断与展示。 */
  usage(userId: string): Promise<{ count: number; bytes: number }>;
  /** 只删除当前账户自己的附件；不存在或不属于该账户返回 false。 */
  remove(userId: string, id: string): Promise<boolean>;
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIG = [0xff, 0xd8, 0xff];

function startsWith(data: Uint8Array, offset: number, expected: readonly number[]): boolean {
  if (data.byteLength < offset + expected.length) return false;
  return expected.every((byte, index) => data[offset + index] === byte);
}

function asciiStartsWith(data: Uint8Array, offset: number, value: string): boolean {
  if (data.byteLength < offset + value.length) return false;
  for (let index = 0; index < value.length; index += 1) if (data[offset + index] !== value.charCodeAt(index)) return false;
  return true;
}

/** 按内容魔数识别图片类型；不认识返回 undefined。扩展名不参与判定。 */
export function sniffImageMediaType(data: Uint8Array): Extract<AttachmentMediaType, "image/png" | "image/jpeg" | "image/gif" | "image/webp"> | undefined {
  if (startsWith(data, 0, PNG_SIG)) return "image/png";
  if (startsWith(data, 0, JPEG_SIG)) return "image/jpeg";
  if (asciiStartsWith(data, 0, "GIF87a") || asciiStartsWith(data, 0, "GIF89a")) return "image/gif";
  if (asciiStartsWith(data, 0, "RIFF") && asciiStartsWith(data, 8, "WEBP")) return "image/webp";
  return undefined;
}

/** 校验并归一化附件名称：只允许单段、无路径分隔、无控制字符。 */
export function normalizeAttachmentName(value: unknown): string {
  if (typeof value !== "string") throw new Error("附件名称无效。");
  const name = value.trim();
  if (!name || name.length > 128 || /[\\/\u0000-\u001f]/u.test(name) || name === "." || name === "..") throw new Error("附件名称必须是不含路径分隔的 1–128 字符。");
  return name;
}

/** 写入前统一校验：大小、白名单与内容是否与声明一致。 */
export function validateAttachmentInput(input: { mediaType: AttachmentMediaType; data: Uint8Array }): void {
  if (!ATTACHMENT_MEDIA_TYPES.includes(input.mediaType)) throw new Error("附件媒体类型不在允许范围内。");
  if (!(input.data instanceof Uint8Array) || input.data.byteLength === 0) throw new Error("附件内容为空。");
  if (input.data.byteLength > ATTACHMENT_MAX_BYTES) throw new Error(`附件超过 ${ATTACHMENT_MAX_BYTES} 字节上限。`);
  if (input.mediaType.startsWith("image/")) {
    const sniffed = sniffImageMediaType(input.data);
    if (sniffed !== input.mediaType) throw new Error("附件内容与声明的图片类型不一致。");
  }
}

/** 供模型请求使用的 data URL；只在当前进程内拼接，不写入会话。 */
export function attachmentDataUrl(record: Pick<AttachmentRecord, "mediaType">, data: Uint8Array): string {
  return `data:${record.mediaType};base64,${Buffer.from(data).toString("base64")}`;
}

export {
  ATTACHMENT_MAX_DIMENSION,
  normalizeAttachmentImage,
  type NormalizedImage,
} from "./normalize.js";
