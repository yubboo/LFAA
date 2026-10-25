/**
 * 功能：前端附件上传的唯一入口（选文件/粘贴得到 File → 调控制端 → 返回附件元数据）。
 * 作用：集中校验类型与大小、把字节转成 base64、携带认证头发起请求；界面只负责选择与展示。
 * 关联文件：packages/api/attachment-controller、packages/attachment/attachment、client/ui-chat 输入框。
 */

/** 与合同包一致的白名单与上限；前端先拦一次，服务端仍是权威。 */
export const CLIENT_ATTACHMENT_MEDIA_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "text/plain"] as const;
export const CLIENT_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;

export interface UploadedAttachment {
  id: string;
  name: string;
  mediaType: string;
  bytes: number;
  sha256: string;
  createdAt: string;
}

export interface UploadAttachmentInput {
  file: { name: string; type: string; size: number; arrayBuffer(): Promise<ArrayBuffer> };
  fetchImpl?: typeof fetch;
  authorization: string;
  endpoint?: string;
}

/** 把 File 内容转成 base64；按块拼接，避免一次性字符串拼接过大。 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

/**
 * 上传一个附件。前端只做"合不合法"的快速拦截，服务端仍会重新校验；
 * 任何失败都抛错而不是返回假成功，界面据此提示真实原因。
 */
export async function uploadAttachment(input: UploadAttachmentInput): Promise<UploadedAttachment> {
  const mediaType = input.file.type || "application/octet-stream";
  if (!(CLIENT_ATTACHMENT_MEDIA_TYPES as readonly string[]).includes(mediaType)) throw new Error("只支持 PNG/JPEG/GIF/WebP 图片或纯文本文件。");
  if (input.file.size <= 0 || input.file.size > CLIENT_ATTACHMENT_MAX_BYTES) throw new Error("文件必须大于 0 且不超过 8 MiB。");
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const response = await (input.fetchImpl ?? fetch)(input.endpoint ?? "/api/attachments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: input.authorization },
    body: JSON.stringify({ name: input.file.name, mediaType, dataBase64: bytesToBase64(bytes) })
  });
  if (!response.ok) {
    let detail = "";
    try { detail = JSON.stringify(await response.json()).slice(0, 300); } catch { /* 响应体不可读时保留状态码。 */ }
    throw new Error("附件上传失败（HTTP " + response.status + "）。" + detail);
  }
  const payload = await response.json() as { attachment?: UploadedAttachment };
  if (!payload?.attachment?.id) throw new Error("附件上传响应缺少附件记录。");
  return payload.attachment;
}
