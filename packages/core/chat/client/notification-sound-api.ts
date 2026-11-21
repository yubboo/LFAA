// 自定义提示音接口：上传、列表与删除由 Host 保存在本机，客户端只传文件名、MIME 与 base64 内容。
import { fetchJson } from "./chat-http";

export interface CustomNotificationSound {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: number;
  file: string;
}

/** 与 Host 上限保持一致：超过 2.5MB 在客户端提前拒绝。 */
export const MAX_CUSTOM_SOUND_BYTES = 2.5 * 1024 * 1024;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : "";
      const comma = raw.indexOf(",");
      if (comma < 0) {
        reject(new Error("读取音频文件失败。"));
        return;
      }
      resolve(raw.slice(comma + 1));
    };
    reader.onerror = () => reject(new Error("读取音频文件失败。"));
    reader.readAsDataURL(file);
  });
}

export async function listCustomNotificationSounds(): Promise<CustomNotificationSound[]> {
  const res = await fetchJson<{ sounds: CustomNotificationSound[] }>("/api/notification-sounds");
  return Array.isArray(res.sounds) ? res.sounds : [];
}

export async function uploadCustomNotificationSound(file: File): Promise<CustomNotificationSound> {
  if (file.size > MAX_CUSTOM_SOUND_BYTES) {
    throw new Error("音频文件过大，请选择 2.5MB 以内的文件。");
  }
  if (!file.type.startsWith("audio/")) {
    throw new Error("请选择音频文件。");
  }
  const dataBase64 = await readFileAsBase64(file);
  const res = await fetchJson<{ sound: CustomNotificationSound }>("/api/notification-sounds", {
    method: "POST",
    body: JSON.stringify({ name: file.name, mime: file.type, dataBase64 }),
  });
  return res.sound;
}

export async function deleteCustomNotificationSound(id: string): Promise<void> {
  await fetchJson(`/api/notification-sounds/${encodeURIComponent(id)}`, { method: "DELETE" });
}