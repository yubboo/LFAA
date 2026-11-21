// 输入区附件整理：把粘贴的图片、拖入的文件与绝对路径统一转成 ComposerAttachment，文件会存入会话附件库。
import type { ComposerAttachment } from "./composer-context";
import { matchAbsolutePath } from "./composer-paths";

const TEXT_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "md", "txt", "css", "html",
  "yaml", "yml", "toml", "py", "rs", "go", "java", "sh", "ps1", "bat", "sql",
]);

/** 单文件上限与一次最多附件数，避免一次拖入过多文件卡住输入框。 */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_ACTION = 8;

/** 人类可读的字节数。 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 把文件字节转成 base64（分块拼接，避免超长 apply 栈溢出）。 */
async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

/** 上传到本机会话附件库；失败时返回 undefined，退回旧的仅前端预览行为。 */
export async function uploadAttachment(sessionId: string, file: File): Promise<string | undefined> {
  if (!sessionId || file.size > MAX_ATTACHMENT_BYTES) return undefined;
  try {
    const contentBase64 = await toBase64(file);
    const res = await fetch("/api/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, name: file.name, mime: file.type, contentBase64 }),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { item?: { id?: string } };
    return data.item?.id;
  } catch {
    return undefined;
  }
}

/** 判断附件是否是图片（粘贴图片与文件拖入共用）。 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

/** 把一组文件（粘贴 / 拖入 / 文件选择）转成附件项；图片与文本预览都尽量带上。 */
export async function filesToAttachments(fileList: FileList | File[], sessionId: string): Promise<ComposerAttachment[]> {
  const files = Array.from(fileList).slice(0, MAX_ATTACHMENTS_PER_ACTION);
  const attachments: ComposerAttachment[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isText = file.type.startsWith("text/") || TEXT_EXTENSIONS.has(ext);
    let contentPreview: string | undefined;
    if (isText && file.size <= 128 * 1024) {
      try {
        contentPreview = (await file.text()).slice(0, 6000);
      } catch {
        // 忽略读取失败。
      }
    }
    const attachmentId = await uploadAttachment(sessionId, file);
    const kindDetail = isImageFile(file) ? "图片" : "文件";
    attachments.push({
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind: "file",
      label: file.name,
      detail: `${kindDetail} · ${formatBytes(file.size)}${attachmentId ? " · 已入库" : ""}`,
      ...(contentPreview ? { contentPreview } : {}),
      ...(attachmentId ? { attachmentId } : {}),
      ...(isImageFile(file) ? { imageFile: file } : {}),
    });
  }
  return attachments;
}

/** 取出已入库的图片附件 id（去重）：媒体直连与聊天运行都用它把图片写回用户消息。 */
export function collectImageAttachmentIds(attachments: ComposerAttachment[]): string[] {
  return [...new Set(attachments
    .filter((item) => item.kind === "file" && item.imageFile && item.attachmentId)
    .map((item) => item.attachmentId as string))];
}

/** 把一段绝对路径转成附件项（不上传字节，只把本机路径交给 Agent 读取）。 */
export function pathToAttachment(rawPath: string): ComposerAttachment | undefined {
  const path = matchAbsolutePath(rawPath);
  if (!path) return undefined;
  const name = path.split(/[\\/]/u).filter(Boolean).at(-1) ?? path;
  return {
    id: `path-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: "file",
    label: name,
    detail: "绝对路径",
    path,
  };
}
