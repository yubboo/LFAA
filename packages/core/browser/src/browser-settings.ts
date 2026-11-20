// 内置浏览器设置读写：设置文件路径、偏好归一化与缓存，更新时报告 headless 变化以便运行时重建浏览器。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { BrowserSettingsConfig } from "./types";

export const DEFAULT_SETTINGS_PATH = join(homedir(), ".lfaa", "browser-settings.json");

/** 把设备像素比收敛到 1–2.5（保留两位小数），非法值退回 2。 */
export function clampDpr(raw?: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 2;
  return Math.max(1, Math.min(2.5, Math.round(raw * 100) / 100));
}

export const DEFAULT_SETTINGS: BrowserSettingsConfig = {
  preferredChannel: "auto",
  customExecutablePath: "",
  headless: true,
  autoApproveLocalhost: true,
};

export class BrowserSettingsStore {
  private readonly storeFilePath: string;
  private cache: BrowserSettingsConfig | null = null;

  constructor(storeFilePath?: string) {
    this.storeFilePath = storeFilePath ? resolve(storeFilePath) : DEFAULT_SETTINGS_PATH;
  }

  async get(): Promise<BrowserSettingsConfig> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(this.storeFilePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<BrowserSettingsConfig>;
      this.cache = {
        preferredChannel: parsed.preferredChannel === "msedge" || parsed.preferredChannel === "chrome" ? parsed.preferredChannel : "auto",
        customExecutablePath: typeof parsed.customExecutablePath === "string" ? parsed.customExecutablePath : "",
        headless: typeof parsed.headless === "boolean" ? parsed.headless : true,
        autoApproveLocalhost: typeof parsed.autoApproveLocalhost === "boolean" ? parsed.autoApproveLocalhost : true,
      };
    } catch {
      this.cache = { ...DEFAULT_SETTINGS };
    }
    return this.cache;
  }

  /** 合并并落盘设置；`headlessChanged` 供调用方决定是否重启浏览器。 */
  async update(patch: Partial<BrowserSettingsConfig>): Promise<{ config: BrowserSettingsConfig; headlessChanged: boolean }> {
    const current = await this.get();
    const next: BrowserSettingsConfig = {
      preferredChannel: patch.preferredChannel ?? current.preferredChannel,
      customExecutablePath: typeof patch.customExecutablePath === "string" ? patch.customExecutablePath.trim() : current.customExecutablePath,
      headless: typeof patch.headless === "boolean" ? patch.headless : current.headless,
      autoApproveLocalhost: typeof patch.autoApproveLocalhost === "boolean" ? patch.autoApproveLocalhost : current.autoApproveLocalhost,
    };
    const headlessChanged = current.headless !== next.headless;
    this.cache = next;
    await mkdir(dirname(this.storeFilePath), { recursive: true });
    await writeFile(this.storeFilePath, JSON.stringify(next, null, 2), "utf8");
    return { config: next, headlessChanged };
  }
}