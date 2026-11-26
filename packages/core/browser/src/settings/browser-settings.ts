// 内置浏览器设置读写：归一化完整偏好（常规、下载、权限规则、站点权限、密码偏好、扩展与完整 CDP）并落盘缓存。
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type {
  BrowserExtensionItem,
  BrowserPasswordSettings,
  BrowserPermissionSetting,
  BrowserPolicyDecision,
  BrowserSettingsConfig,
  BrowserSitePermissions,
  BrowserSiteRule,
} from "../types";
import { getSystemDownloadsDir } from "./system-downloads";

export const DEFAULT_SETTINGS_PATH = join(homedir(), ".lfaa", "browser-settings.json");

/** 下载位置来源：system 表示跟随本机系统「下载」目录，custom 表示用户自己指定。 */
export type DownloadDirSource = "system" | "custom";

/** 生效的下载目录与其来源，供设置页显示路径并决定是否提供「恢复默认」。 */
export interface DownloadDirState {
  path: string;
  source: DownloadDirSource;
}

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
  // 空串表示跟随系统「下载」目录；用户选定自定义目录后才写入绝对路径。
  downloadDir: "",
  // 默认在下载前询问保存位置，避免文件悄悄落到某个目录；用户显式关闭后会保持关闭。
  askBeforeDownload: true,
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

/** 设置文件结构版本：v2 起「下载前询问保存位置」默认开启。 */
const SETTINGS_FILE_VERSION = 2;

/** 设置文件正文：配置字段 + 结构版本；版本只在落盘时写入，不进公开配置契约。 */
interface SettingsFile extends Partial<BrowserSettingsConfig> {
  settingsVersion?: number;
}

/**
 * 旧版本默认「不询问保存位置」，且任何一次保存都会把这个默认值写进文件，无法区分「用户显式关闭」；
 * 升级到 v2 时统一打开，之后用户手动关闭会正常保持。
 */
function migrateSettingsFile(parsed: SettingsFile): Partial<BrowserSettingsConfig> {
  const version = typeof parsed.settingsVersion === "number" && Number.isFinite(parsed.settingsVersion) ? parsed.settingsVersion : 1;
  if (version >= SETTINGS_FILE_VERSION) return parsed;
  return { ...parsed, askBeforeDownload: true };
}

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
    downloadDir: parsed.downloadDir === undefined
      ? base.downloadDir
      : typeof parsed.downloadDir === "string" ? parsed.downloadDir.trim() : base.downloadDir,
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

/** 按平台规则比较两个绝对路径是否指向同一目录（Windows 不区分大小写）。 */
function sameDirectory(left: string, right: string): boolean {
  const normalize = (value: string) => {
    const absolute = resolve(value);
    return process.platform === "win32" ? absolute.toLowerCase() : absolute;
  };
  return normalize(left) === normalize(right);
}

/** 形如 <用户目录>/Downloads 的路径：旧版本把它写死成默认值，换机后必须回落到系统目录。 */
function looksLikeProfileDownloads(value: string): boolean {
  return /(?:^[a-z]:\\users\\[^\\/]+\\downloads|^\/(?:home|Users)\/[^\\/]+\/Downloads)\/?$/iu.test(resolve(value));
}

/** 解析生效下载目录：空串、本机系统目录或旧版本写死的默认路径都回落到系统「下载」目录。 */
async function resolveDownloadDir(configured: string, systemDownloadsDir: () => Promise<string>): Promise<DownloadDirState> {
  const systemDir = await systemDownloadsDir();
  const value = configured.trim();
  if (!value || !isAbsolute(value)) return { path: systemDir, source: "system" };
  if (sameDirectory(value, systemDir) || sameDirectory(value, join(homedir(), "Downloads"))) {
    return { path: systemDir, source: "system" };
  }
  // 其他机器留下的 <用户>/Downloads 在本机不存在时同样是旧默认值，不能继续写回归属别人的目录。
  if (looksLikeProfileDownloads(value) && !existsSync(value)) return { path: systemDir, source: "system" };
  return { path: value, source: "custom" };
}

/** 系统「下载」目录探测的可替换入口，默认走真实平台探测，测试可注入临时目录。 */
export interface BrowserSettingsStoreOptions {
  systemDownloadsDir?: () => Promise<string>;
}

export class BrowserSettingsStore {
  private readonly storeFilePath: string;
  private readonly systemDownloadsDir: () => Promise<string>;
  private stored: Required<BrowserSettingsConfig> | null = null;
  private effective: Required<BrowserSettingsConfig> | null = null;
  private downloadDirSource: DownloadDirSource = "system";

  constructor(storeFilePath?: string, options: BrowserSettingsStoreOptions = {}) {
    this.storeFilePath = storeFilePath ? resolve(storeFilePath) : DEFAULT_SETTINGS_PATH;
    this.systemDownloadsDir = options.systemDownloadsDir ?? getSystemDownloadsDir;
  }

  /** 生效配置：`downloadDir` 已是真实目录，跟随系统时即本机「下载」目录。 */
  async get(): Promise<Required<BrowserSettingsConfig>> {
    if (this.effective) return this.effective;
    const stored = await this.readStored();
    const downloadDir = await this.resolveDownloadDir(stored.downloadDir);
    this.effective = { ...stored, downloadDir: downloadDir.path };
    this.downloadDirSource = downloadDir.source;
    return this.effective;
  }

  /** 当前下载目录是否为用户自定义，设置页据此决定是否显示「恢复默认」。 */
  async getDownloadDirSource(): Promise<DownloadDirSource> {
    await this.get();
    return this.downloadDirSource;
  }

  /** 下载授权读取磁盘最新值，避免独立 Web 与桌面宿主使用旧规则。 */
  async readForDownload(): Promise<Required<BrowserSettingsConfig>> {
    let stored: Required<BrowserSettingsConfig>;
    try {
      const raw = await readFile(this.storeFilePath, "utf8");
      stored = normalizeConfig(migrateSettingsFile(JSON.parse(raw) as SettingsFile), DEFAULT_SETTINGS);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") stored = normalizeConfig({}, DEFAULT_SETTINGS);
      else throw error;
    }
    return { ...stored, downloadDir: (await this.resolveDownloadDir(stored.downloadDir)).path };
  }

  /** 合并并落盘设置；下载目录只存「空串或自定义绝对路径」，本机默认路径不落盘。 */
  async update(patch: Partial<BrowserSettingsConfig>): Promise<{ config: Required<BrowserSettingsConfig>; headlessChanged: boolean }> {
    const current = await this.readStored();
    const next = normalizeConfig(patch, current);
    const downloadDir = await this.resolveDownloadDir(next.downloadDir);
    const stored: Required<BrowserSettingsConfig> = {
      ...next,
      downloadDir: downloadDir.source === "custom" ? downloadDir.path : "",
    };
    const headlessChanged = current.headless !== stored.headless;
    await mkdir(dirname(this.storeFilePath), { recursive: true });
    const temporary = `${this.storeFilePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify({ ...stored, settingsVersion: SETTINGS_FILE_VERSION }, null, 2), { encoding: "utf8", flag: "wx" });
      await rename(temporary, this.storeFilePath);
      const effective: Required<BrowserSettingsConfig> = { ...stored, downloadDir: downloadDir.path };
      this.stored = stored;
      this.effective = effective;
      this.downloadDirSource = downloadDir.source;
      return { config: effective, headlessChanged };
    } finally {
      await rm(temporary, { force: true });
    }
  }

  private async readStored(): Promise<Required<BrowserSettingsConfig>> {
    if (this.stored) return this.stored;
    try {
      const raw = await readFile(this.storeFilePath, "utf8");
      this.stored = normalizeConfig(migrateSettingsFile(JSON.parse(raw) as SettingsFile), DEFAULT_SETTINGS);
    } catch {
      this.stored = normalizeConfig({}, DEFAULT_SETTINGS);
    }
    return this.stored;
  }

  private resolveDownloadDir(configured: string): Promise<DownloadDirState> {
    return resolveDownloadDir(configured, this.systemDownloadsDir);
  }
}
