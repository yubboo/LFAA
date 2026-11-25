// 处理 /api/browser/{history,downloads,passwords,contacts,clear-data} 数据管理路由，保持主 http-handler 精简。
import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { BrowserService } from "../index";
import type { BrowserHttpOptions } from "../http-handler";

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
  options: BrowserHttpOptions,
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

  // ---- 下载确认与历史 ----
  if (method === "GET" && pathname === "/api/browser/downloads/pending") {
    res.setHeader("Cache-Control", "private, no-store");
    sendJson(res, 200, { items: service.downloads.list(urlObj.searchParams.get("sessionId") ?? undefined) });
    return true;
  }
  const decisionMatch = /^\/api\/browser\/downloads\/([\w-]+)\/(location|decision)$/u.exec(pathname);
  if (method === "POST" && decisionMatch?.[1]) {
    const sessionId = urlObj.searchParams.get("sessionId");
    if (!sessionId) {
      sendJson(res, 400, { error: "缺少下载请求所属会话。" });
      return true;
    }
    const itemId = decisionMatch[1];
    if (decisionMatch[2] === "location") {
      const pick = options.pickDownloadFolder;
      if (!pick) {
        sendJson(res, 503, { error: "当前宿主未连接本机目录选择器。" });
        return true;
      }
      const body = await readJsonBody(req);
      const title = body.locale === "zh" ? "选择下载保存位置" : "Choose download folder";
      const result = await service.downloads.chooseLocation(sessionId, itemId, (directory) => pick(title, directory));
      sendJson(res, 200, result);
      return true;
    }
    const { decision } = await readJsonBody(req);
    if (decision !== "save" && decision !== "cancel") {
      sendJson(res, 400, { error: "无效的下载操作。" });
      return true;
    }
    sendJson(res, 200, { item: service.downloads.decide(sessionId, itemId, decision) });
    return true;
  }
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
    if (!target || !target.savePath || target.deleted) {
      sendJson(res, 404, { error: "未找到下载记录。" });
      return true;
    }
    if (process.platform !== "win32") {
      sendJson(res, 501, { error: "当前平台未接入文件定位。" });
      return true;
    }
    const explorer = spawn("explorer.exe", [`/select,"${target.savePath}"`], {
      detached: true,
      stdio: "ignore",
      windowsVerbatimArguments: true,
    });
    await new Promise<void>((resolve, reject) => {
      explorer.once("spawn", resolve);
      explorer.once("error", reject);
    });
    explorer.unref();
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
