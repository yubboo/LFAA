// 处理 /api/browser/{history,downloads,passwords,contacts,clear-data} 数据管理路由，保持主 http-handler 精简。
import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { BrowserService } from "../index";

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

export async function handleBrowserDataRequest(
  service: BrowserService,
  req: IncomingMessage,
  res: ServerResponse,
  urlObj: URL,
  method: string,
): Promise<boolean> {
  const { pathname } = urlObj;
  const data = service.dataStore;

  if (method === "POST" && pathname === "/api/browser/clear-data") {
    await Promise.all([data.clearHistory(), data.clearDownloads()]);
    sendJson(res, 200, { cleared: true });
    return true;
  }

  // ---- 浏览历史 ----
  if (method === "GET" && pathname === "/api/browser/history") {
    const q = urlObj.searchParams.get("q") ?? undefined;
    sendJson(res, 200, { items: await data.listHistory(q) });
    return true;
  }
  if (method === "DELETE" && pathname === "/api/browser/history") {
    await data.clearHistory();
    sendJson(res, 200, { cleared: true });
    return true;
  }
  const histMatch = /^\/api\/browser\/history\/([^/]+)$/u.exec(pathname);
  if (method === "DELETE" && histMatch?.[1]) {
    const removed = await data.removeHistory(decodeURIComponent(histMatch[1]));
    sendJson(res, removed ? 200 : 404, { removed });
    return true;
  }

  // ---- 下载历史 ----
  if (method === "GET" && pathname === "/api/browser/downloads") {
    const q = urlObj.searchParams.get("q") ?? undefined;
    sendJson(res, 200, { items: await data.listDownloads(q) });
    return true;
  }
  if (method === "DELETE" && pathname === "/api/browser/downloads") {
    await data.clearDownloads();
    sendJson(res, 200, { cleared: true });
    return true;
  }
  const dlRevealMatch = /^\/api\/browser\/downloads\/([^/]+)\/reveal$/u.exec(pathname);
  if (method === "POST" && dlRevealMatch?.[1]) {
    const id = decodeURIComponent(dlRevealMatch[1]);
    const list = await data.listDownloads();
    const target = list.find((item) => item.id === id);
    if (!target || !target.savePath) {
      sendJson(res, 404, { error: "未找到下载记录。" });
      return true;
    }
    if (process.platform === "win32") {
      spawn("explorer.exe", [`/select,${target.savePath}`], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    }
    sendJson(res, 200, { opened: true });
    return true;
  }
  const dlMatch = /^\/api\/browser\/downloads\/([^/]+)$/u.exec(pathname);
  if (method === "DELETE" && dlMatch?.[1]) {
    const removed = await data.removeDownload(decodeURIComponent(dlMatch[1]));
    sendJson(res, removed ? 200 : 404, { removed });
    return true;
  }

  // ---- 本地加密密码库 ----
  if (method === "GET" && pathname === "/api/browser/passwords") {
    const q = urlObj.searchParams.get("q") ?? undefined;
    sendJson(res, 200, { items: await data.listPasswords(q) });
    return true;
  }
  if (method === "POST" && pathname === "/api/browser/passwords") {
    const body = await readJsonBody(req);
    const item = await data.upsertPassword({
      ...(typeof body.id === "string" ? { id: body.id } : {}),
      origin: typeof body.origin === "string" ? body.origin : "",
      username: typeof body.username === "string" ? body.username : "",
      password: typeof body.password === "string" ? body.password : "",
    });
    sendJson(res, 200, { item });
    return true;
  }
  if (method === "DELETE" && pathname === "/api/browser/passwords") {
    await data.clearPasswords();
    sendJson(res, 200, { cleared: true });
    return true;
  }
  if (method === "GET" && pathname === "/api/browser/passwords/export") {
    const csv = await data.exportPasswordsCsv();
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="lfaa-passwords.csv"');
    res.end(csv);
    return true;
  }
  if (method === "POST" && pathname === "/api/browser/passwords/import") {
    const body = await readJsonBody(req);
    const csv = typeof body.csv === "string" ? body.csv : "";
    const imported = await data.importPasswordsCsv(csv);
    sendJson(res, 200, { imported });
    return true;
  }
  const pwdMatch = /^\/api\/browser\/passwords\/([^/]+)$/u.exec(pathname);
  if (method === "DELETE" && pwdMatch?.[1]) {
    const removed = await data.removePassword(decodeURIComponent(pwdMatch[1]));
    sendJson(res, removed ? 200 : 404, { removed });
    return true;
  }

  // ---- 联系信息 ----
  if (method === "GET" && pathname === "/api/browser/contacts") {
    sendJson(res, 200, { items: await data.listContacts() });
    return true;
  }
  if (method === "POST" && pathname === "/api/browser/contacts") {
    const body = await readJsonBody(req);
    const item = await data.upsertContact({
      ...(typeof body.id === "string" ? { id: body.id } : {}),
      name: typeof body.name === "string" ? body.name : "",
      email: typeof body.email === "string" ? body.email : "",
      phone: typeof body.phone === "string" ? body.phone : "",
      address: typeof body.address === "string" ? body.address : "",
    });
    sendJson(res, 200, { item });
    return true;
  }
  const cntMatch = /^\/api\/browser\/contacts\/([^/]+)$/u.exec(pathname);
  if (method === "DELETE" && cntMatch?.[1]) {
    const removed = await data.removeContact(decodeURIComponent(cntMatch[1]));
    sendJson(res, removed ? 200 : 404, { removed });
    return true;
  }

  return false;
}
