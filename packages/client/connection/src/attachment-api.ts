/** AI 附件上传请求适配；附件大小、持久化和授权由服务端 Owner 校验。 */
import { request } from "./http-client.js";

export interface UploadedAttachment {
  id: string;
  name: string;
  mediaType: string;
  bytes: number;
  sha256: string;
  createdAt: string;
}

/** 上传附件字节；调用仍沿用统一认证请求。 */
export function uploadAttachment(input: { name: string; mediaType: string; dataBase64: string }): Promise<{ attachment: UploadedAttachment }> {
  return request("/attachments", { method: "POST", body: JSON.stringify(input) });
}
