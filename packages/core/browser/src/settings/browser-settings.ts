// 内置浏览器设置读写：归一化完整偏好（常规、下载、权限规则、站点权限、密码偏好、扩展与完整 CDP）并落盘缓存。
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type {
  BrowserExtensionItem,
  BrowserPasswordSettings,
  BrowserPermissionSetting,
  BrowserPolicyDecision,
  BrowserSettingsConfig,
  BrowserSitePermissions,
  BrowserSiteRule,
} from "../types";

export const DEFAULT_SETTINGS_PATH = join(homedir(), ".lfaa", "browser-settings.json");

/** 把设备像素比收敛到 1–2.5（保留两位小数），非法值退回 2。 */
export function clampDpr(raw?: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 2;
  return Math.max(1, Math.min(2.5, Math.round(raw * 100) / 100));
}

export const DEFAULT_SITE_PERMISSIONS: BrowserSitePermissions = {
  location: "ask",
  camera: "ask",
  microphone: "ask",
  notifications: "ask",
  embeddedContent: "ask",
  thirdPartyCookies: "allow",
  javascript: "allow",
  images: "allow",
  popups: "block",
  autoRevokeUnused: true,
};

export const DEFAULT_PASSWORD_SETTINGS: BrowserPasswordSettings = {
  offerToSave: true,
  autoCreatePasskey: true,
  autoSignIn: true,
};

export const DEFAULT_SETTINGS: Required<BrowserSettingsConfig> = {
  enabled: true,
  preferredChannel: "auto",
  customExecutablePath: "",
  headless: true,
  autoApproveLocalhost: true,
  webLinkOpenMode: "external",
  localUrlOpenMode: "builtin",
  showFullUrl: false,
  annotationScreenshotMode: "always",
  downloadDir: join(homedir(), "Downloads"),
  askBeforeDownload: false,
  historyAccessPolicy: "ask",
  enableWebsiteTools: true,
  defaultBrowsePolicy: "ask",
  defaultDownloadPolicy: "ask",
  siteRules: [],
  enableFullCdp: false,
  sitePermissions: DEFAULT_SITE_PERMISSIONS,
  passwordSettings: DEFAULT_PASSWORD_SETTINGS,
  extensions: [],
};

function normDecision(raw: unknown, fallback: BrowserPolicyDecision): BrowserPolicyDecision {
  return raw === "allow" || raw === "block" || raw === "ask" ? raw : fallback;
}

function normPerm(raw: unknown, fallback: BrowserPermissionSetting): BrowserPermissionSetting {
  return raw === "allow" || raw === "block" || raw === "ask" ? raw : fallback;
}

function normSiteRules(raw: unknown): BrowserSiteRule[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r, idx) => ({
      id: typeof r.id === "string" && r.id.trim() ? r.id.trim() : `rule-${idx + 1}`,
      pattern: typeof r.pattern === "string" ? r.pattern.trim() : "",
      browse: normDecision(r.browse, "ask"),
      download: normDecision(r.download, "ask"),
    }))
    .filter((r) => r.pattern.length > 0);
}

function normExtensions(raw: unknown): BrowserExtensionItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => Boolean(e && typeof e === "object"))
    .map((e, idx) => ({
      id: typeof e.id === "string" && e.id.trim() ? e.id.trim() : `ext-${idx + 1}`,
      name: typeof e.name === "string" && e.name.trim() ? e.name.trim() : "未命名扩展",
      path: typeof e.path === "string" ? e.path.trim() : "",
      enabled: e.enabled !== false,
    }))
    .filter((e) => e.path.length > 0);
}

function normalizeConfig(parsed: Partial<BrowserSettingsConfig>, base: Required<BrowserSettingsConfig>): Required<BrowserSettingsConfig> {
  const sp = (parsed.sitePermissions ?? {}) as Partial<BrowserSitePermissions>;
  const ps = (parsed.passwordSettings ?? {}) as Partial<BrowserPasswordSettings>;
  return {
    enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : base.enabled,
    preferredChannel: parsed.preferredChannel === "msedge" || parsed.preferredChannel === "chrome" || parsed.preferredChannel === "auto"
      ? parsed.preferredChannel
      : base.preferredChannel,
    customExecutablePath: typeof parsed.customExecutablePath === "string" ? parsed.customExecutablePath.trim() : base.customExecutablePath,
    headless: typeof parsed.headless === "boolean" ? parsed.headless : base.headless,
    autoApproveLocalhost: typeof parsed.autoApproveLocalhost === "boolean" ? parsed.autoApproveLocalhost : base.autoApproveLocalhost,
    webLinkOpenMode: parsed.webLinkOpenMode === "builtin" || parsed.webLinkOpenMode === "external" ? parsed.webLinkOpenMode : base.webLinkOpenMode,
    localUrlOpenMode: parsed.localUrlOpenMode === "external" || parsed.localUrlOpenMode === "builtin" ? parsed.localUrlOpenMode : base.localUrlOpenMode,
    showFullUrl: typeof parsed.showFullUrl === "boolean" ? parsed.showFullUrl : base.showFullUrl,
    annotationScreenshotMode: parsed.annotationScreenshotMode === "selection_only" || parsed.annotationScreenshotMode === "always"
      ? parsed.annotationScreenshotMode
      : base.annotationScreenshotMode,
    downloadDir: typeof parsed.downloadDir === "string" && parsed.downloadDir.trim() ? parsed.downloadDir.trim() : base.downloadDir,
    askBeforeDownload: typeof parsed.askBeforeDownload === "boolean" ? parsed.askBeforeDownload : base.askBeforeDownload,
    historyAccessPolicy: parsed.historyAccessPolicy === "allow" || parsed.historyAccessPolicy === "deny" || parsed.historyAccessPolicy === "ask"
      ? parsed.historyAccessPolicy
      : base.historyAccessPolicy,
    enableWebsiteTools: typeof parsed.enableWebsiteTools === "boolean" ? parsed.enableWebsiteTools : base.enableWebsiteTools,
    defaultBrowsePolicy: normDecision(parsed.defaultBrowsePolicy, base.defaultBrowsePolicy),
    defaultDownloadPolicy: normDecision(parsed.defaultDownloadPolicy, base.defaultDownloadPolicy),
    siteRules: parsed.siteRules !== undefined ? normSiteRules(parsed.siteRules) : base.siteRules,
    enableFullCdp: typeof parsed.enableFullCdp === "boolean" ? parsed.enableFullCdp : base.enableFullCdp,
    sitePermissions: {
      location: normPerm(sp.location, base.sitePermissions.location),
      camera: normPerm(sp.camera, base.sitePermissions.camera),
      microphone: normPerm(sp.microphone, base.sitePermissions.microphone),
      notifications: normPerm(sp.notifications, base.sitePermissions.notifications),
      embeddedContent: normPerm(sp.embeddedContent, base.sitePermissions.embeddedContent),
      thirdPartyCookies: sp.thirdPartyCookies === "block" || sp.thirdPartyCookies === "block_incognito" || sp.thirdPartyCookies === "allow"
        ? sp.thirdPartyCookies
        : base.sitePermissions.thirdPartyCookies,
      javascript: sp.javascript === "block" || sp.javascript === "allow" ? sp.javascript : base.sitePermissions.javascript,
      images: sp.images === "block" || sp.images === "allow" ? sp.images : base.sitePermissions.images,
      popups: sp.popups === "allow" || sp.popups === "block" ? sp.popups : base.sitePermissions.popups,
      autoRevokeUnused: typeof sp.autoRevokeUnused === "boolean" ? sp.autoRevokeUnused : base.sitePermissions.autoRevokeUnused,
    },
    passwordSettings: {
      offerToSave: typeof ps.offerToSave === "boolean" ? ps.offerToSave : base.passwordSettings.offerToSave,
      autoCreatePasskey: typeof ps.autoCreatePasskey === "boolean" ? ps.autoCreatePasskey : base.passwordSettings.autoCreatePasskey,
      autoSignIn: typeof ps.autoSignIn === "boolean" ? ps.autoSignIn : base.passwordSettings.autoSignIn,
    },
    extensions: parsed.extensions !== undefined ? normExtensions(parsed.extensions) : base.extensions,
  };
}

export class BrowserSettingsStore {
  private readonly storeFilePath: string;
  private cache: Required<BrowserSettingsConfig> | null = null;

  constructor(storeFilePath?: string) {
    this.storeFilePath = storeFilePath ? resolve(storeFilePath) : DEFAULT_SETTINGS_PATH;
  }

  async get(): Promise<Required<BrowserSettingsConfig>> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(this.storeFilePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<BrowserSettingsConfig>;
      this.cache = normalizeConfig(parsed, DEFAULT_SETTINGS);
    } catch {
      this.cache = normalizeConfig({}, DEFAULT_SETTINGS);
    }
    return this.cache;
  }

  /** 下载授权读取磁盘最新值，避免独立 Web 与桌面宿主使用旧规则。 */
  async readForDownload(): Promise<Required<BrowserSettingsConfig>> {
    try {
      const raw = await readFile(this.storeFilePath, "utf8");
      return normalizeConfig(JSON.parse(raw) as Partial<BrowserSettingsConfig>, DEFAULT_SETTINGS);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return DEFAULT_SETTINGS;
      throw error;
    }
  }

  /** 合并并落盘设置；`headlessChanged` 供调用方决定是否重启浏览器。 */
  async update(patch: Partial<BrowserSettingsConfig>): Promise<{ config: Required<BrowserSettingsConfig>; headlessChanged: boolean }> {
    const current = await this.get();
    const next = normalizeConfig(patch, current);
    const headlessChanged = current.headless !== next.headless;
    await mkdir(dirname(this.storeFilePath), { recursive: true });
    const temporary = `${this.storeFilePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(next, null, 2), { encoding: "utf8", flag: "wx" });
      await rename(temporary, this.storeFilePath);
      this.cache = next;
    } finally {
      await rm(temporary, { force: true });
    }
    return { config: next, headlessChanged };
  }
}
