// 管理内置浏览器的浏览历史、下载历史、本地加密密码库（AES-256-GCM）与联系信息自动填充数据。
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type {
  BrowserContactItem,
  BrowserDownloadItem,
  BrowserHistoryItem,
  BrowserPasswordItem,
  BrowserPolicyDecision,
  BrowserSiteRule,
} from "../types";

const MAX_HISTORY_ITEMS = 1000;
const MAX_DOWNLOAD_ITEMS = 300;

interface EncryptedVaultFile {
  iv: string;
  tag: string;
  data: string;
}

/** 根据域名/通配模式匹配网站访问控制规则。 */
export function evaluateSitePolicy(
  rawUrl: string,
  rules: readonly BrowserSiteRule[],
  defaultPolicy: BrowserPolicyDecision,
  action: "browse" | "download" = "browse",
): BrowserPolicyDecision {
  let host = "";
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return defaultPolicy;
  }
  for (const rule of rules) {
    const pat = rule.pattern.trim().toLowerCase().replace(/^https?:\/\//u, "").replace(/\/.*$/u, "");
    if (!pat) continue;
    const matched = pat.startsWith("*.")
      ? host === pat.slice(2) || host.endsWith(pat.slice(1))
      : host === pat || rawUrl.toLowerCase().includes(pat);
    if (matched) return action === "download" ? rule.download : rule.browse;
  }
  return defaultPolicy;
}

export class BrowserDataStore {
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ? resolve(baseDir) : join(homedir(), ".lfaa");
  }

  private filePath(name: string): string {
    return join(this.baseDir, name);
  }

  private async readJson<T>(name: string, fallback: T): Promise<T> {
    try {
      const raw = await readFile(this.filePath(name), "utf8");
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private async writeJson(name: string, value: unknown): Promise<void> {
    const target = this.filePath(name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(value, null, 2), "utf8");
  }

  // ---- 浏览历史 ----
  async listHistory(query?: string): Promise<BrowserHistoryItem[]> {
    const items = await this.readJson<BrowserHistoryItem[]>("browser-history.json", []);
    const q = query?.trim().toLowerCase();
    const filtered = q
      ? items.filter((item) => item.url.toLowerCase().includes(q) || item.title.toLowerCase().includes(q))
      : items;
    return filtered.sort((a, b) => b.visitedAt - a.visitedAt);
  }

  async recordHistory(url: string, title: string, byAgent: boolean): Promise<void> {
    const cleanUrl = url.trim();
    if (!cleanUrl || cleanUrl === "about:blank") return;
    const items = await this.readJson<BrowserHistoryItem[]>("browser-history.json", []);
    const next: BrowserHistoryItem[] = [
      { id: `hist-${randomUUID().slice(0, 8)}`, url: cleanUrl, title: title.trim() || cleanUrl, visitedAt: Date.now(), byAgent },
      ...items,
    ].slice(0, MAX_HISTORY_ITEMS);
    await this.writeJson("browser-history.json", next);
  }

  async removeHistory(id: string): Promise<boolean> {
    const items = await this.readJson<BrowserHistoryItem[]>("browser-history.json", []);
    const next = items.filter((item) => item.id !== id);
    if (next.length === items.length) return false;
    await this.writeJson("browser-history.json", next);
    return true;
  }

  async clearHistory(): Promise<void> {
    await this.writeJson("browser-history.json", []);
  }

  // ---- 下载历史 ----
  async listDownloads(query?: string): Promise<BrowserDownloadItem[]> {
    const items = await this.readJson<BrowserDownloadItem[]>("browser-downloads.json", []);
    const q = query?.trim().toLowerCase();
    const enriched: BrowserDownloadItem[] = items.map((item) => {
      const deleted = item.savePath ? !existsSync(item.savePath) : item.deleted;
      return deleted !== undefined ? { ...item, deleted } : item;
    });
    const filtered = q
      ? enriched.filter((item) => item.filename.toLowerCase().includes(q) || item.url.toLowerCase().includes(q))
      : enriched;
    return filtered.sort((a, b) => b.downloadedAt - a.downloadedAt);
  }

  async recordDownload(input: Omit<BrowserDownloadItem, "id" | "downloadedAt">): Promise<BrowserDownloadItem> {
    const items = await this.readJson<BrowserDownloadItem[]>("browser-downloads.json", []);
    const created: BrowserDownloadItem = {
      ...input,
      id: `dl-${randomUUID().slice(0, 8)}`,
      downloadedAt: Date.now(),
    };
    await this.writeJson("browser-downloads.json", [created, ...items].slice(0, MAX_DOWNLOAD_ITEMS));
    return created;
  }

  async removeDownload(id: string): Promise<boolean> {
    const items = await this.readJson<BrowserDownloadItem[]>("browser-downloads.json", []);
    const next = items.filter((item) => item.id !== id);
    if (next.length === items.length) return false;
    await this.writeJson("browser-downloads.json", next);
    return true;
  }

  async clearDownloads(): Promise<void> {
    await this.writeJson("browser-downloads.json", []);
  }

  // ---- 本地加密密码库（AES-256-GCM） ----
  private async getOrCreateVaultKey(): Promise<Buffer> {
    const keyPath = this.filePath(".browser-vault.key");
    try {
      const hex = (await readFile(keyPath, "utf8")).trim();
      if (hex.length === 64) return Buffer.from(hex, "hex");
    } catch {
      // 首次创建随机 32 字节密钥。
    }
    const key = randomBytes(32);
    await mkdir(dirname(keyPath), { recursive: true });
    await writeFile(keyPath, key.toString("hex"), { encoding: "utf8", mode: 0o600 });
    return key;
  }

  async listPasswords(query?: string): Promise<BrowserPasswordItem[]> {
    const vault = await this.readJson<EncryptedVaultFile | null>("browser-passwords.enc.json", null);
    if (!vault) return [];
    try {
      const key = await this.getOrCreateVaultKey();
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(vault.iv, "base64"));
      decipher.setAuthTag(Buffer.from(vault.tag, "base64"));
      const plain = Buffer.concat([decipher.update(Buffer.from(vault.data, "base64")), decipher.final()]).toString("utf8");
      const items = JSON.parse(plain) as BrowserPasswordItem[];
      const q = query?.trim().toLowerCase();
      return q
        ? items.filter((item) => item.origin.toLowerCase().includes(q) || item.username.toLowerCase().includes(q))
        : items;
    } catch {
      return [];
    }
  }

  private async savePasswords(items: BrowserPasswordItem[]): Promise<void> {
    const key = await this.getOrCreateVaultKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(items), "utf8"), cipher.final()]);
    const payload: EncryptedVaultFile = {
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: encrypted.toString("base64"),
    };
    await this.writeJson("browser-passwords.enc.json", payload);
  }

  async upsertPassword(input: { id?: string; origin: string; username: string; password: string }): Promise<BrowserPasswordItem> {
    const origin = input.origin.trim();
    const username = input.username.trim();
    if (!origin || !username) throw new Error("网站地址与用户名不能为空。");
    const items = await this.listPasswords();
    const now = Date.now();
    const item: BrowserPasswordItem = {
      id: input.id?.trim() || `pwd-${randomUUID().slice(0, 8)}`,
      origin,
      username,
      password: input.password,
      updatedAt: now,
    };
    const exists = items.some((existing) => existing.id === item.id);
    const next = exists ? items.map((existing) => (existing.id === item.id ? item : existing)) : [item, ...items];
    await this.savePasswords(next);
    return item;
  }

  async removePassword(id: string): Promise<boolean> {
    const items = await this.listPasswords();
    const next = items.filter((item) => item.id !== id);
    if (next.length === items.length) return false;
    await this.savePasswords(next);
    return true;
  }

  async clearPasswords(): Promise<void> {
    await this.savePasswords([]);
  }

  async exportPasswordsCsv(): Promise<string> {
    const items = await this.listPasswords();
    const esc = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const rows = items.map((item) => [esc(item.origin), esc(item.username), esc(item.password)].join(","));
    return ["url,username,password", ...rows].join("\n");
  }

  async importPasswordsCsv(csvText: string): Promise<number> {
    const lines = csvText.split(/\r?\n/u).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return 0;
    const startIdx = lines[0]!.toLowerCase().includes("url") && lines[0]!.toLowerCase().includes("username") ? 1 : 0;
    const items = await this.listPasswords();
    let imported = 0;
    for (let i = startIdx; i < lines.length; i += 1) {
      const cols = lines[i]!.split(",").map((c) => c.trim().replace(/^"|"$/gu, "").replaceAll('""', '"'));
      const [origin, username, password] = cols;
      if (!origin || !username) continue;
      items.unshift({
        id: `pwd-${randomUUID().slice(0, 8)}`,
        origin,
        username,
        password: password ?? "",
        updatedAt: Date.now(),
      });
      imported += 1;
    }
    if (imported > 0) await this.savePasswords(items);
    return imported;
  }

  // ---- 联系信息自动填充 ----
  async listContacts(): Promise<BrowserContactItem[]> {
    return this.readJson<BrowserContactItem[]>("browser-contacts.json", []);
  }

  async upsertContact(input: Partial<BrowserContactItem> & { name: string }): Promise<BrowserContactItem> {
    const name = input.name.trim();
    if (!name) throw new Error("联系人姓名不能为空。");
    const items = await this.listContacts();
    const item: BrowserContactItem = {
      id: input.id?.trim() || `cnt-${randomUUID().slice(0, 8)}`,
      name,
      email: input.email?.trim() ?? "",
      phone: input.phone?.trim() ?? "",
      address: input.address?.trim() ?? "",
    };
    const exists = items.some((existing) => existing.id === item.id);
    const next = exists ? items.map((existing) => (existing.id === item.id ? item : existing)) : [item, ...items];
    await this.writeJson("browser-contacts.json", next);
    return item;
  }

  async removeContact(id: string): Promise<boolean> {
    const items = await this.listContacts();
    const next = items.filter((item) => item.id !== id);
    if (next.length === items.length) return false;
    await this.writeJson("browser-contacts.json", next);
    return true;
  }
}
