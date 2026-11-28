// 右工作台启动页地址栏历史记录：合并内置浏览器浏览历史与本地输入记录，提供展示归一化、筛选与行内补全。
import type { BrowserHistoryItem } from "@lfaa/client-ui-browser/client";

export interface StartHistoryEntry {
  /** 列表唯一键（本地记录与服务端历史合并去重后使用）。 */
  key: string;
  /** url 表示网页地址，query 表示搜索词或本地输入项。 */
  kind: "url" | "query";
  /** 提交时实际打开的完整值（URL 带协议或原始输入）。 */
  value: string;
  /** 去掉协议前缀与末尾斜杠的简洁展示串，用于列表副标题与行内前缀补全。 */
  displayUrl: string;
  /** 页面标题；搜索项为空，纯地址无标题时也为空。 */
  title: string;
  visitedAt: number;
  /** 若该条来自后端浏览器历史，记录其服务端 ID 供删除同步。 */
  serverIds: string[];
}

const STORAGE_KEY = "lfaa:workbench-start-history";
const MAX_LOCAL_ITEMS = 60;
const MAX_VISIBLE_ITEMS = 8;

const EXPLICIT_URL_RE = /^(?:https?:\/\/|localhost(?:[:/]|$)|(?:\d{1,3}\.){3}\d{1,3}(?:[:/]|$)|\[::1\](?:[:/]|$))/iu;

/** 判断输入是否应按网址处理（协议、本机地址或 IP）。 */
export function isExplicitStartUrl(raw: string): boolean {
  return EXPLICIT_URL_RE.test(raw.trim());
}

/** 去掉 http(s)://、www. 与末尾多余斜杠，得到类似 127.0.0.1:5173/work 的简洁展示串。 */
export function formatDisplayUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const withoutScheme = trimmed.replace(/^https?:\/\//iu, "").replace(/^www\./iu, "");
  return withoutScheme.replace(/\/+$/u, "");
}

/** 从 URL 提取站点 origin（用于请求 /favicon.ico），非 http(s) 返回 null。 */
export function extractFaviconOrigin(rawUrl: string): string | null {
  const candidate = /^https?:\/\//iu.test(rawUrl) ? rawUrl : `http://${rawUrl}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function normalizeDedupKey(kind: "url" | "query", value: string): string {
  if (kind === "url") return `url:${formatDisplayUrl(value).toLowerCase()}`;
  return `query:${value.trim().toLowerCase()}`;
}

function cleanTitle(title: string | undefined, displayUrl: string): string {
  const trimmed = (title ?? "").trim();
  if (!trimmed) return "";
  if (formatDisplayUrl(trimmed).toLowerCase() === displayUrl.toLowerCase()) return "";
  return trimmed;
}

interface StoredLocalEntry {
  kind: "url" | "query";
  value: string;
  title?: string;
  visitedAt: number;
}

/** 读取本地记录的启动页输入历史（SSR / 异常存储下安全回退为空数组）。 */
export function readLocalStartHistory(): StartHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const items: StartHistoryEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const record = item as Partial<StoredLocalEntry>;
      if ((record.kind !== "url" && record.kind !== "query") || typeof record.value !== "string" || !record.value.trim()) continue;
      const value = record.value.trim();
      const displayUrl = record.kind === "url" ? formatDisplayUrl(value) : value;
      items.push({
        key: normalizeDedupKey(record.kind, value),
        kind: record.kind,
        value,
        displayUrl,
        title: record.kind === "url" ? cleanTitle(record.title, displayUrl) : "",
        visitedAt: typeof record.visitedAt === "number" ? record.visitedAt : 0,
        serverIds: [],
      });
    }
    return items;
  } catch {
    return [];
  }
}

function writeLocalStartHistory(entries: StartHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredLocalEntry[] = entries.slice(0, MAX_LOCAL_ITEMS).map((entry) => ({
      kind: entry.kind,
      value: entry.value,
      ...(entry.title ? { title: entry.title } : {}),
      visitedAt: entry.visitedAt,
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 隐私模式或存储配额不足时静默忽略，不影响正常跳转。
  }
}

/** 记录一条新的启动页输入（置顶并去重）。 */
export function recordLocalStartHistory(input: { kind: "url" | "query"; value: string; title?: string; now?: number }): StartHistoryEntry[] {
  const value = input.value.trim();
  if (!value) return readLocalStartHistory();
  const displayUrl = input.kind === "url" ? formatDisplayUrl(value) : value;
  const key = normalizeDedupKey(input.kind, value);
  const existing = readLocalStartHistory().filter((item) => item.key !== key);
  const next: StartHistoryEntry = {
    key,
    kind: input.kind,
    value,
    displayUrl,
    title: input.kind === "url" ? cleanTitle(input.title, displayUrl) : "",
    visitedAt: input.now ?? Date.now(),
    serverIds: [],
  };
  const merged = [next, ...existing].slice(0, MAX_LOCAL_ITEMS);
  writeLocalStartHistory(merged);
  return merged;
}

/** 从本地历史删除指定键。 */
export function removeLocalStartHistory(key: string): StartHistoryEntry[] {
  const next = readLocalStartHistory().filter((item) => item.key !== key);
  writeLocalStartHistory(next);
  return next;
}

/** 合并服务端浏览历史与本地启动页记录：同址去重，保留更丰富的标题与最新访问时间。 */
export function mergeStartHistory(serverItems: BrowserHistoryItem[], localItems: StartHistoryEntry[]): StartHistoryEntry[] {
  const map = new Map<string, StartHistoryEntry>();

  for (const item of serverItems) {
    const rawUrl = item.url?.trim();
    if (!rawUrl || rawUrl === "about:blank" || rawUrl.startsWith("chrome-error://")) continue;
    const displayUrl = formatDisplayUrl(rawUrl);
    if (!displayUrl) continue;
    const key = normalizeDedupKey("url", rawUrl);
    const title = cleanTitle(item.title, displayUrl);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        kind: "url",
        value: rawUrl,
        displayUrl,
        title,
        visitedAt: item.visitedAt ?? 0,
        serverIds: [item.id],
      });
    } else {
      existing.serverIds.push(item.id);
      if ((item.visitedAt ?? 0) >= existing.visitedAt) {
        existing.visitedAt = item.visitedAt ?? existing.visitedAt;
        existing.value = rawUrl;
        if (title) existing.title = title;
      } else if (!existing.title && title) {
        existing.title = title;
      }
    }
  }

  for (const local of localItems) {
    const existing = map.get(local.key);
    if (!existing) {
      map.set(local.key, { ...local, serverIds: [...local.serverIds] });
    } else if (local.visitedAt > existing.visitedAt) {
      existing.visitedAt = local.visitedAt;
      if (!existing.title && local.title) existing.title = local.title;
    }
  }

  return [...map.values()].sort((a, b) => b.visitedAt - a.visitedAt);
}

/** 按输入关键字筛选历史记录：前缀命中排在包含命中之前，同优先级按最近访问时间排序。 */
export function filterStartHistory(entries: StartHistoryEntry[], query: string, limit = MAX_VISIBLE_ITEMS): StartHistoryEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries.slice(0, limit);

  const prefixHits: StartHistoryEntry[] = [];
  const otherHits: StartHistoryEntry[] = [];

  for (const entry of entries) {
    const displayLower = entry.displayUrl.toLowerCase();
    const titleLower = entry.title.toLowerCase();
    const valueLower = entry.value.toLowerCase();
    if (displayLower.startsWith(needle) || valueLower.startsWith(needle)) {
      prefixHits.push(entry);
    } else if (displayLower.includes(needle) || titleLower.includes(needle) || valueLower.includes(needle)) {
      otherHits.push(entry);
    }
  }

  return [...prefixHits, ...otherHits].slice(0, limit);
}

/** 查找可用于输入框行内补全的前缀匹配（例如输入 "127.0" → 返回 "127.0.0.1:3000/work"）。 */
export function findInlineCompletion(entries: StartHistoryEntry[], typed: string): string | null {
  if (!typed || /\s/u.test(typed)) return null;
  const lower = typed.toLowerCase();
  for (const entry of entries) {
    if (entry.kind !== "url") continue;
    const candidate = entry.displayUrl;
    if (candidate.toLowerCase().startsWith(lower) && candidate.length > typed.length) {
      return `${typed}${candidate.slice(typed.length)}`;
    }
  }
  return null;
}
