// 个人背景图接口：列表、上传与删除；文件由 Host 保存在本机 ~/.lfaa/backgrounds，客户端只传文件名、MIME 与 base64。
/** 个人背景的元数据；id 与文件名一一对应，可直接拼出读取地址。 */
export interface CustomBackground {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: number;
}

/** 与 Host 上限保持一致：超过 12MB 在客户端提前拒绝。 */
export const MAX_BACKGROUND_BYTES = 12 * 1024 * 1024;

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : "";
      const comma = raw.indexOf(",");
      if (comma < 0) {
        reject(new Error("read-failed"));
        return;
      }
      resolve(raw.slice(comma + 1));
    };
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(file);
  });
}

/** 读取页面注入的一次性接口令牌；静态预览等未注入场景返回空串。 */
function readApiToken(): string {
  if (typeof document === "undefined") return "";
  return document.querySelector<HTMLMetaElement>('meta[name="lfaa-api-token"]')?.content?.trim() ?? "";
}

/** 给读取地址补查询令牌：<img src> 与 CSS url() 无法带请求头，只能走 GET 查询参数。 */
export function withApiToken(url: string): string {
  const token = readApiToken();
  if (!token) return url;
  const next = new URL(url, window.location.href);
  next.searchParams.set("token", token);
  return next.toString();
}

/** 个人背景的读取地址；id 已在契约里限制为安全字符。 */
export function customBackgroundUrl(id: string): string {
  return withApiToken(`/api/backgrounds/${encodeURIComponent(id)}/file`);
}

export async function listCustomBackgrounds(): Promise<CustomBackground[]> {
  const response = await fetch("/api/backgrounds");
  if (!response.ok) throw new Error("load-failed");
  const payload = (await response.json()) as { backgrounds?: CustomBackground[] };
  return Array.isArray(payload.backgrounds) ? payload.backgrounds : [];
}

export async function uploadCustomBackground(file: File): Promise<CustomBackground> {
  if (!ALLOWED_MIME.has(file.type)) throw new Error("bad-format");
  if (file.size > MAX_BACKGROUND_BYTES) throw new Error("too-large");
  const dataBase64 = await readFileAsBase64(file);
  const response = await fetch("/api/backgrounds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, mime: file.type, dataBase64 }),
  });
  if (!response.ok) {
    if (response.status === 413) throw new Error("too-large");
    if (response.status === 415) throw new Error("bad-format");
    throw new Error("upload-failed");
  }
  const payload = (await response.json()) as { background?: CustomBackground };
  if (!payload.background) throw new Error("upload-failed");
  return payload.background;
}

export async function deleteCustomBackground(id: string): Promise<void> {
  const response = await fetch(`/api/backgrounds/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error("delete-failed");
}