// @lfaa/web-server：提供自定义通知提示音的上传、列表、读取与删除接口；文件保存在本机 ~/.lfaa/notification-sounds。
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiHandler } from "@lfaa/api-gateway";

/** 自定义提示音元数据；客户端据此填充设置页下拉与展示。 */
export interface CustomNotificationSoundMeta {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: number;
  file: string;
}

export interface NotificationSoundHandlerOptions {
  /** 覆盖存储目录，供测试使用；缺省 ~/.lfaa/notification-sounds。 */
  soundsDir?: string;
}

const MAX_AUDIO_BYTES = 2.5 * 1024 * 1024;
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const ID_PATTERN = /^[0-9a-fA-F-]{36}$/u;
const MIME_EXTENSIONS: Record<string, string> = {
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/wave": ".wav",
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "application/ogg": ".ogg",
  "audio/mp4": ".m4a",
  "audio/aac": ".m4a",
  "audio/webm": ".webm",
  "audio/flac": ".flac",
};

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    total += buf.length;
    if (total > MAX_BODY_BYTES) throw new Error("音频文件过大，请选择 2.5MB 以内的文件。");
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

function resolveSoundsDir(options: NotificationSoundHandlerOptions): string {
  return options.soundsDir ? resolve(options.soundsDir) : join(homedir(), ".lfaa", "notification-sounds");
}

async function listSounds(dir: string): Promise<CustomNotificationSoundMeta[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const sounds: CustomNotificationSoundMeta[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".meta.json")) continue;
    try {
      const parsed = JSON.parse(await readFile(join(dir, entry), "utf8")) as Partial<CustomNotificationSoundMeta>;
      if (typeof parsed.id !== "string" || !ID_PATTERN.test(parsed.id)) continue;
      if (typeof parsed.name !== "string" || typeof parsed.mime !== "string") continue;
      if (typeof parsed.file !== "string" || !parsed.file || extname(parsed.file) === "") continue;
      sounds.push({
        id: parsed.id,
        name: parsed.name,
        mime: parsed.mime,
        size: typeof parsed.size === "number" ? parsed.size : 0,
        createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : 0,
        file: parsed.file,
      });
    } catch {
      // 忽略损坏的元数据，不影响其它提示音。
    }
  }
  return sounds.sort((left, right) => right.createdAt - left.createdAt);
}

async function readMeta(dir: string, id: string): Promise<CustomNotificationSoundMeta | null> {
  try {
    return JSON.parse(await readFile(join(dir, `${id}.meta.json`), "utf8")) as CustomNotificationSoundMeta;
  } catch {
    return null;
  }
}

/** 处理 /api/notification-sounds 系列接口；未命中返回 false 交给后续处理器。 */
export function createNotificationSoundsHttpHandler(options: NotificationSoundHandlerOptions = {}): ApiHandler {
  const dir = resolveSoundsDir(options);
  return async (req, res) => {
    const url = new URL(req.url ?? "", "http://127.0.0.1");
    const pathname = url.pathname;
    if (!pathname.startsWith("/api/notification-sounds")) return false;
    const method = (req.method ?? "GET").toUpperCase();
    const suffix = pathname.slice("/api/notification-sounds".length);

    try {
      if (method === "GET" && suffix === "") {
        sendJson(res, 200, { sounds: await listSounds(dir) });
        return true;
      }

      if (method === "POST" && suffix === "") {
        const body = await readJsonBody(req);
        const name = (typeof body.name === "string" ? body.name.trim() : "").slice(0, 60) || "自定义提示音";
        const mime = typeof body.mime === "string" ? body.mime.trim().toLowerCase() : "";
        const extension = MIME_EXTENSIONS[mime];
        if (!extension) {
          sendJson(res, 415, { error: "仅支持 WAV、MP3、OGG、M4A、WebM 或 FLAC 音频。" });
          return true;
        }
        const base64 = typeof body.dataBase64 === "string" ? body.dataBase64 : "";
        const buffer = Buffer.from(base64, "base64");
        if (buffer.length === 0) {
          sendJson(res, 400, { error: "音频内容为空。" });
          return true;
        }
        if (buffer.length > MAX_AUDIO_BYTES) {
          sendJson(res, 413, { error: "音频文件过大，请选择 2.5MB 以内的文件。" });
          return true;
        }
        const id = randomUUID();
        const file = `${id}${extension}`;
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, file), buffer);
        const meta: CustomNotificationSoundMeta = { id, name, mime, size: buffer.length, createdAt: Date.now(), file };
        await writeFile(join(dir, `${id}.meta.json`), JSON.stringify(meta, null, 2), "utf8");
        sendJson(res, 201, { sound: meta });
        return true;
      }

      const fileRoute = /^\/([^/]+)\/file$/u.exec(suffix);
      if (method === "GET" && fileRoute?.[1]) {
        const id = decodeURIComponent(fileRoute[1]);
        if (!ID_PATTERN.test(id)) {
          sendJson(res, 400, { error: "无效的提示音 ID。" });
          return true;
        }
        const meta = await readMeta(dir, id);
        if (!meta) {
          sendJson(res, 404, { error: "提示音不存在。" });
          return true;
        }
        const buffer = await readFile(join(dir, meta.file)).catch(() => null);
        if (!buffer) {
          sendJson(res, 404, { error: "提示音文件不存在。" });
          return true;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", meta.mime);
        res.setHeader("Content-Length", String(buffer.length));
        res.setHeader("Cache-Control", "private, max-age=86400");
        res.end(buffer);
        return true;
      }

      const deleteRoute = /^\/([^/]+)$/u.exec(suffix);
      if (method === "DELETE" && deleteRoute?.[1]) {
        const id = decodeURIComponent(deleteRoute[1]);
        if (!ID_PATTERN.test(id)) {
          sendJson(res, 400, { error: "无效的提示音 ID。" });
          return true;
        }
        const meta = await readMeta(dir, id);
        if (!meta) {
          sendJson(res, 404, { error: "提示音不存在。" });
          return true;
        }
        await rm(join(dir, meta.file), { force: true });
        await rm(join(dir, `${id}.meta.json`), { force: true });
        sendJson(res, 200, { ok: true });
        return true;
      }

      return false;
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  };
}