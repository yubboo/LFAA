// Host 网关内的项目画布路由，所有操作先通过本机令牌及项目登记校验。
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { pipeline } from "node:stream/promises";
import type { Context } from "@deepseek-ai/cordis";
import { CanvasError, maxAssetBytes } from "@lfaa/canvas";

function isWithinAllowedRoot(target: string, root: string): boolean {
  const base = resolve(root);
  const full = resolve(target);
  const a = process.platform === "win32" ? base.toLowerCase() : base;
  const b = process.platform === "win32" ? full.toLowerCase() : full;
  return b === a || b.startsWith(a + sep);
}

const pattern = /^\/api\/canvas\/projects\/([^/]+)\/boards(?:\/([^/]+)(?:\/(assets|runs)(?:\/([^/]+))?)?)?$/u;

function send(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

async function body(req: IncomingMessage, maxBytes = 1024 * 1024): Promise<Record<string, unknown>> {
  if (Number(req.headers["content-length"]) > maxBytes) throw new CanvasError(413, "请求体过大 / Request too large");
  const chunks: Buffer[] = [];
  let count = 0;
  for await (const chunk of req) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    count += value.length;
    if (count > maxBytes) throw new CanvasError(413, "请求体过大 / Request too large");
    chunks.push(value);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new CanvasError(400, "JSON 格式无效 / Invalid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CanvasError(400, "请求格式无效 / Invalid request");
  return value as Record<string, unknown>;
}

function revision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new CanvasError(400, "修订编号无效 / Invalid revision");
  return value;
}

/** 预览原始文件，支持视频播放进度跳转。 */
async function serve(req: IncomingMessage, res: ServerResponse, file: string, mime: string): Promise<void> {
  const size = (await stat(file)).size;
  const range = req.headers.range;
  const match = range ? /^bytes=(\d*)-(\d*)$/u.exec(range) : null;
  const requestedStart = match?.[1];
  const requestedEnd = match?.[2];
  const start = requestedStart ? Number(requestedStart) : requestedEnd ? Math.max(0, size - Number(requestedEnd)) : 0;
  const end = requestedStart && requestedEnd ? Math.min(size - 1, Number(requestedEnd)) : size - 1;
  if (range && (!match || (!requestedStart && !requestedEnd) || start > end)) {
    res.writeHead(416, { "Content-Range": "bytes */" + size });
    res.end();
    return;
  }
  res.writeHead(range ? 206 : 200, {
    "Content-Type": mime, "Content-Length": end - start + 1, "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    ...(range ? { "Content-Range": "bytes " + start + "-" + end + "/" + size } : {}),
  });
  if (req.method === "HEAD") res.end();
  else await pipeline(createReadStream(file, { start, end }), res);
}

export function createCanvasHandler(ctx: Context) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const parsed = pattern.exec(new URL(req.url ?? "/", "http://localhost").pathname);
    if (!parsed) return false;
    try {
      const canvas = ctx.get("canvas");
      if (!canvas) throw new CanvasError(404, "画布插件未启用 / Canvas unavailable");
      const projectId = decodeURIComponent(parsed[1] ?? "");
      const project = await ctx.workspace.getProject(projectId);
      if (!project) throw new CanvasError(404, "找不到已登记项目 / Project not found");
      const [, , canvasId, resource, itemId] = parsed;
      if (!canvasId) {
        if (req.method === "GET") send(res, 200, await canvas.store.list(projectId));
        else if (req.method === "POST") {
          const data = await body(req);
          if (typeof data.title !== "string" || !data.title.trim() || data.title.length > 120) throw new CanvasError(400, "画布名称无效 / Invalid canvas title");
          send(res, 201, await canvas.create(projectId, data.title.trim()));
        } else throw new CanvasError(405, "请求方法不受支持 / Method not allowed");
        return true;
      }
      const dir = canvas.store.boardDir(projectId, canvasId);
      if (!resource && req.method === "GET") send(res, 200, await canvas.detail(dir));
      else if (!resource && req.method === "PUT") {
        const data = await body(req);
        send(res, 200, await canvas.save(dir, revision(data.revision), data.graph));
      } else if (!resource && req.method === "PATCH") {
        const data = await body(req);
        if (typeof data.title !== "string") throw new CanvasError(400, "画布名称无效 / Invalid canvas title");
        send(res, 200, await canvas.rename(dir, data.title));
      } else if (resource === "assets") {
        await canvas.store.board(dir);
        if ((req.method === "GET" || req.method === "HEAD") && itemId) {
          const { asset, file } = await canvas.store.asset(dir, itemId);
          await serve(req, res, file, asset.mime);
        } else if (req.method === "POST" && !itemId) {
          const data = await body(req, Math.ceil(maxAssetBytes * 4 / 3) + 4096);
          if (typeof data.libraryPath === "string" && data.libraryPath.trim()) {
            const candidate = resolve(data.libraryPath.trim());
            const projects = await ctx.workspace.listProjects().catch(() => []);
            const allowedRoots = [
              join(process.cwd(), "data"),
              join(homedir(), ".lfaa", "media"),
              ...projects.flatMap((item) => [item.rootPath, ...(item.rootPaths ?? [])]),
            ].filter((root): root is string => Boolean(root && root.trim()));
            if (!allowedRoots.some((root) => isWithinAllowedRoot(candidate, root))) {
              throw new CanvasError(403, "仅允许引用资料库或项目目录下的素材 / Asset path outside allowed roots");
            }
            const name = typeof data.name === "string" ? data.name : undefined;
            send(res, 201, await canvas.store.linkLibraryFile(dir, candidate, name));
          } else {
            if (typeof data.base64 !== "string" || typeof data.name !== "string" || typeof data.mime !== "string") throw new CanvasError(400, "素材参数无效 / Invalid asset");
            send(res, 201, await canvas.store.addAsset(dir, data.name, data.mime, Buffer.from(data.base64, "base64")));
          }
        } else throw new CanvasError(405, "请求方法不受支持 / Method not allowed");
      } else if (resource === "runs" && req.method === "POST" && !itemId) {
        const data = await body(req);
        if (typeof data.id !== "string" || typeof data.nodeId !== "string") throw new CanvasError(400, "运行参数无效 / Invalid run");
        send(res, 202, await canvas.submit(dir, data.id, data.nodeId, revision(data.revision)));
      } else if (resource === "runs" && req.method === "GET") {
        const detail = await canvas.detail(dir);
        const run = itemId ? detail.runs.find((item) => item.id === itemId) : detail.runs;
        if (!run) throw new CanvasError(404, "找不到运行记录 / Run not found");
        send(res, 200, run);
      } else throw new CanvasError(405, "请求方法不受支持 / Method not allowed");
    } catch (error) {
      if (!res.headersSent) send(res, error instanceof CanvasError ? error.status : 500, { error: error instanceof CanvasError ? error.message : "画布接口请求失败 / Canvas request failed" });
      else res.destroy();
    }
    return true;
  };
}
