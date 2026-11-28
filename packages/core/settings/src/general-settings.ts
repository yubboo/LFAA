// 管理 LFAA「设置 → 常规」持久化配置（存于 ~/.lfaa/general-settings.json），并动态检测当前系统用户的默认项目外聊天目录。
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type FileOpenerKind = "explorer" | "vscode" | "cursor" | "antigravity" | "system";
export type AgentEnvKind = "windows_native" | "wsl" | "auto";
export type IntegratedShellKind = "powershell" | "cmd" | "git_bash" | "wsl";
export type AppLanguagePref = "system" | "zh" | "zh-TW" | "zh-HK" | "en" | "ja" | "ko" | "fr" | "de" | "es" | "pt" | "ru";
export type ConfirmCloseMode = "shortcut_only" | "always" | "never";
export type AutoArchiveMode = "never" | "7d" | "30d" | "90d";
export type ResponseSpeedMode = "standard" | "fast" | "thorough";
export type ReasoningLevelOption = "minimal" | "low" | "medium" | "high" | "max";
export type SendShortcutMode = "enter" | "ctrl_enter";
export type FollowUpHandleMode = "queue" | "steer";
export type TurnNotifyMode = "unfocused" | "always" | "off";
export type NotifySoundMode = "default" | "chime" | "mute";

/** 定义由 Host 保存并通过设置接口返回的用户偏好。 */
export interface GeneralSettingsConfig {
  schemaVersion?: number;
  outsideProjectFolder: string;
  defaultProjectsFolder: string;
  defaultFileOpener: FileOpenerKind;
  agentEnvironment: AgentEnvKind;
  integratedShell: IntegratedShellKind;
  language: AppLanguagePref;
  confirmBeforeClose: ConfirmCloseMode;
  defaultFullView: boolean;
  launchAtLogin: boolean;
  autoArchiveInactive: AutoArchiveMode;
  compressLocalHistory: boolean;
  responseSpeed: ResponseSpeedMode;
  reasoningLevels: ReasoningLevelOption[];
  homeSuggestions: boolean;
  enablePlugins: boolean;
  plainTextEditor: boolean;
  showContextUsage: boolean;
  /** 连续相同工具调用的提醒阈值；空数组表示关闭提醒。 */
  repeatToolThresholds: number[];
  sendShortcut: SendShortcutMode;
  followUpMode: FollowUpHandleMode;
  popoutShortcut: string;
  defaultStandaloneChat: boolean;
  turnCompleteNotification: TurnNotifyMode;
  enableApprovalNotification: boolean;
  enableQuestionNotification: boolean;
  enableDotNotification: boolean;
  notificationSound: NotifySoundMode;
  /** 轮次完成提示音：内置 id、custom:<uuid> 或 mute。 */
  completionSound?: string;
  /** 澄清/等待回答提示音。 */
  questionSound?: string;
  /** 待确认/关键决策提示音。 */
  approvalSound?: string;
  confettiEffect: boolean;
  /** 生成的图片是否叠加「小鱼 agent 生成」水印（提供方自带水印始终抑制）。 */
  imageWatermark: boolean;
  updatedAt: number;
}

export interface OpenSourcePackageInfo {
  name: string;
  version: string;
  scope: string;
}

function resolveUserHome(): string {
  return resolve(homedir() || process.env.USERPROFILE || process.env.HOME || ".");
}

/** 归一化路径键：小写 + 正斜杠，用于识别“仍是旧默认值”的历史配置。 */
function normalizePathKey(input: string | undefined): string {
  if (!input) return "";
  return input.replaceAll("\\", "/").replace(/\/+$/u, "").toLowerCase();
}

// 缓存「文档」目录探测结果：Windows 走系统已知文件夹（用户可能把文档挪到 D 盘等），其他平台用 ~/Documents。
let documentsFolderPromise: Promise<string> | undefined;

/** 解析当前登录用户的“文档”目录，跟随系统设置而不是写死盘符或用户名。 */
export function resolveDocumentsFolder(overrideBaseDocs?: string): Promise<string> {
  if (overrideBaseDocs) return Promise.resolve(resolve(overrideBaseDocs));
  documentsFolderPromise ??= detectDocumentsFolder();
  return documentsFolderPromise;
}

/** 探测系统文档目录；探测失败时回退到用户主目录下的 Documents。 */
async function detectDocumentsFolder(): Promise<string> {
  if (process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync(
        "powershell.exe",
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Environment]::GetFolderPath('MyDocuments')",
        ],
        { timeout: 5000, windowsHide: true },
      );
      const detected = stdout.trim();
      if (detected) return resolve(detected);
    } catch {
      // 回退到用户主目录下的 Documents。
    }
  }
  return join(resolveUserHome(), "Documents");
}

/** 为常规设置读取和写入解析路径，测试可提供独立档案。 */
export function getGeneralSettingsFilePath(overridePath?: string): string {
  if (overridePath) return resolve(overridePath);
  return join(resolveUserHome(), ".lfaa", "general-settings.json");
}

/** 默认项目外工作区：<系统文档>/lfaa/default-workspace/code，与画布子区物理隔离。 */
export async function resolveDefaultOutsideProjectFolder(overrideBaseDocs?: string): Promise<string> {
  return join(await resolveDocumentsFolder(overrideBaseDocs), "lfaa", "default-workspace", "code");
}

/** 兼容旧版使用应用数据根作为默认值，项目外产物写入专用目录。 */
function normalizeOutsideProjectFolder(input: string, fallbackOutside: string): string {
  const path = resolve(input.trim());
  const legacy = join(resolveUserHome(), ".lfaa");
  const same = process.platform === "win32" ? path.toLowerCase() === legacy.toLowerCase() : path === legacy;
  return same ? fallbackOutside : path;
}

// 动态解析当前登录 Windows/POSIX 用户的“文档\lfaa”路径，供未添加源文件夹直接按名称新建项目时存放项目目录（不存会话）。
export async function resolveDefaultProjectsFolder(overrideBaseDocs?: string): Promise<string> {
  return join(await resolveDocumentsFolder(overrideBaseDocs), "lfaa");
}

function createDefaultSettings(outsideProjectFolder: string, defaultProjectsFolder: string): GeneralSettingsConfig {
  return {
    schemaVersion: 4,
    outsideProjectFolder,
    defaultProjectsFolder,
    defaultFileOpener: "explorer",
    agentEnvironment: "windows_native",
    integratedShell: "powershell",
    language: "zh",
    confirmBeforeClose: "shortcut_only",
    defaultFullView: false,
    launchAtLogin: false,
    autoArchiveInactive: "never",
    compressLocalHistory: true,
    responseSpeed: "standard",
    reasoningLevels: ["minimal", "low", "medium", "high", "max"],
    homeSuggestions: true,
    enablePlugins: true,
    plainTextEditor: false,
    showContextUsage: true,
    repeatToolThresholds: [3, 5, 8],
    sendShortcut: "enter",
    followUpMode: "queue",
    popoutShortcut: "",
    defaultStandaloneChat: false,
    turnCompleteNotification: "unfocused",
    enableApprovalNotification: true,
    enableQuestionNotification: true,
    enableDotNotification: true,
    notificationSound: "default",
    completionSound: "default",
    questionSound: "bell",
    approvalSound: "alert",
    confettiEffect: true,
    imageWatermark: false,
    updatedAt: Date.now(),
  };
}

/** 归一化重复调用阈值：整数、>=2、去重升序，最多 6 个；空数组表示关闭。 */
function normalizeRepeatThresholds(values: readonly unknown[]): number[] {
  const numbers = values.filter((value): value is number => typeof value === "number" && Number.isInteger(value) && value >= 2);
  return Array.from(new Set(numbers)).sort((a, b) => a - b).slice(0, 6);
}

const VALID_REASONING = new Set<ReasoningLevelOption>(["minimal", "low", "medium", "high", "max"]);
const SOUND_ID_PATTERN = /^(?:default|chime|bell|pop|alert|mute|custom:[0-9a-fA-F-]{8,64})$/u;

/** 校验提示音 id：内置音或 custom:<uuid>；不合法时返回 undefined 由调用方保留旧值。 */
function readSoundId(value: unknown): string | undefined {
  return typeof value === "string" && SOUND_ID_PATTERN.test(value) ? value : undefined;
}

/** 管理常规偏好的持久化与兼容读取，并公开设置服务使用的用户配置。 */
export class GeneralSettingsStore {
  private readonly filePath: string;
  private cached: GeneralSettingsConfig | null = null;

  constructor(filePath?: string) {
    this.filePath = getGeneralSettingsFilePath(filePath);
  }

  async get(): Promise<GeneralSettingsConfig> {
    if (this.cached) return this.cached;
    const defaultOutside = await resolveDefaultOutsideProjectFolder();
    const defaultProjects = await resolveDefaultProjectsFolder();
    const defaults = createDefaultSettings(defaultOutside, defaultProjects);
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<GeneralSettingsConfig>;
      const parsedVersion = parsed.schemaVersion ?? 1;
      let merged = this.mergePatch(defaults, parsed, defaultOutside);
      // v3→v4：项目外工作区默认值从 ~/.lfaa/workspace 与 <系统文档>/lfaa/default-workspace
      // 迁到 <系统文档>/lfaa/default-workspace/code；只改写「仍是旧默认值」的配置，用户显式选过的目录保持不动。
      if (parsedVersion < 4) {
        const storedKey = normalizePathKey(parsed.outsideProjectFolder);
        const legacyDefaultWorkspace = join(defaultProjects, "default-workspace");
        const legacyKeys = new Set([
          normalizePathKey(join(resolveUserHome(), ".lfaa", "workspace")),
          normalizePathKey(join(resolveUserHome(), ".lfaa")),
          normalizePathKey(legacyDefaultWorkspace),
        ]);
        const looksLikeOldDefault = !storedKey
          || legacyKeys.has(storedKey)
          || storedKey.endsWith("/documents/lfaa")
          || storedKey.endsWith("/lfaa/default-workspace");
        merged = {
          ...merged,
          schemaVersion: 4,
          outsideProjectFolder: looksLikeOldDefault ? defaultOutside : merged.outsideProjectFolder,
          // v2 已经给过一次默认项目目录，保留用户改过的值；v1 沿用旧文档默认值时纠正。
          defaultProjectsFolder: parsedVersion < 2 ? defaultProjects : merged.defaultProjectsFolder,
          updatedAt: Date.now(),
        };
        await mkdir(dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, JSON.stringify(merged, null, 2), "utf8");
      }
      this.cached = { ...merged, schemaVersion: 4 };
    } catch {
      this.cached = defaults;
    }
    return this.cached;
  }

  async update(patch: Partial<GeneralSettingsConfig>): Promise<GeneralSettingsConfig> {
    const current = await this.get();
    const next = this.mergePatch(current, patch, current.outsideProjectFolder);
    next.updatedAt = Date.now();
    this.cached = next;
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(next, null, 2), "utf8");
    return next;
  }

  private mergePatch(base: GeneralSettingsConfig, patch: Partial<GeneralSettingsConfig>, fallbackOutside: string): GeneralSettingsConfig {
    const next: GeneralSettingsConfig = { ...base };
    if (typeof patch.outsideProjectFolder === "string" && patch.outsideProjectFolder.trim()) {
      next.outsideProjectFolder = normalizeOutsideProjectFolder(patch.outsideProjectFolder, fallbackOutside);
    }
    if (typeof patch.defaultProjectsFolder === "string" && patch.defaultProjectsFolder.trim()) {
      next.defaultProjectsFolder = resolve(patch.defaultProjectsFolder.trim());
    }
    if (patch.defaultFileOpener === "explorer" || patch.defaultFileOpener === "vscode" || patch.defaultFileOpener === "cursor" || patch.defaultFileOpener === "antigravity" || patch.defaultFileOpener === "system") {
      next.defaultFileOpener = patch.defaultFileOpener;
    }
    if (patch.agentEnvironment === "windows_native" || patch.agentEnvironment === "wsl" || patch.agentEnvironment === "auto") {
      next.agentEnvironment = patch.agentEnvironment;
    }
    if (patch.integratedShell === "powershell" || patch.integratedShell === "cmd" || patch.integratedShell === "git_bash" || patch.integratedShell === "wsl") {
      next.integratedShell = patch.integratedShell;
    }
    if (typeof patch.language === "string" && ["system", "zh", "zh-TW", "zh-HK", "en", "ja", "ko", "fr", "de", "es", "pt", "ru"].includes(patch.language)) {
      next.language = patch.language as AppLanguagePref;
    }
    if (patch.confirmBeforeClose === "shortcut_only" || patch.confirmBeforeClose === "always" || patch.confirmBeforeClose === "never") {
      next.confirmBeforeClose = patch.confirmBeforeClose;
    }
    if (typeof patch.defaultFullView === "boolean") next.defaultFullView = patch.defaultFullView;
    if (typeof patch.launchAtLogin === "boolean") next.launchAtLogin = patch.launchAtLogin;
    if (patch.autoArchiveInactive === "never" || patch.autoArchiveInactive === "7d" || patch.autoArchiveInactive === "30d" || patch.autoArchiveInactive === "90d") {
      next.autoArchiveInactive = patch.autoArchiveInactive;
    }
    if (typeof patch.compressLocalHistory === "boolean") next.compressLocalHistory = patch.compressLocalHistory;
    if (patch.responseSpeed === "standard" || patch.responseSpeed === "fast" || patch.responseSpeed === "thorough") {
      next.responseSpeed = patch.responseSpeed;
    }
    if (Array.isArray(patch.reasoningLevels)) {
      const filtered = patch.reasoningLevels.filter((x): x is ReasoningLevelOption => VALID_REASONING.has(x));
      if (filtered.length > 0) next.reasoningLevels = Array.from(new Set(filtered));
    }
    if (typeof patch.homeSuggestions === "boolean") next.homeSuggestions = patch.homeSuggestions;
    if (typeof patch.enablePlugins === "boolean") next.enablePlugins = patch.enablePlugins;
    if (typeof patch.plainTextEditor === "boolean") next.plainTextEditor = patch.plainTextEditor;
    if (typeof patch.showContextUsage === "boolean") next.showContextUsage = patch.showContextUsage;
    if (Array.isArray(patch.repeatToolThresholds)) next.repeatToolThresholds = normalizeRepeatThresholds(patch.repeatToolThresholds);
    if (patch.sendShortcut === "enter" || patch.sendShortcut === "ctrl_enter") next.sendShortcut = patch.sendShortcut;
    if (patch.followUpMode === "queue" || patch.followUpMode === "steer") next.followUpMode = patch.followUpMode;
    if (typeof patch.popoutShortcut === "string") next.popoutShortcut = patch.popoutShortcut.trim().slice(0, 40);
    if (typeof patch.defaultStandaloneChat === "boolean") next.defaultStandaloneChat = patch.defaultStandaloneChat;
    if (patch.turnCompleteNotification === "unfocused" || patch.turnCompleteNotification === "always" || patch.turnCompleteNotification === "off") {
      next.turnCompleteNotification = patch.turnCompleteNotification;
    }
    if (typeof patch.enableApprovalNotification === "boolean") next.enableApprovalNotification = patch.enableApprovalNotification;
    if (typeof patch.enableQuestionNotification === "boolean") next.enableQuestionNotification = patch.enableQuestionNotification;
    if (typeof patch.enableDotNotification === "boolean") next.enableDotNotification = patch.enableDotNotification;
    if (patch.notificationSound === "default" || patch.notificationSound === "chime" || patch.notificationSound === "mute") {
      next.notificationSound = patch.notificationSound;
    }
    const completionSound = readSoundId(patch.completionSound);
    if (completionSound) next.completionSound = completionSound;
    const questionSound = readSoundId(patch.questionSound);
    if (questionSound) next.questionSound = questionSound;
    const approvalSound = readSoundId(patch.approvalSound);
    if (approvalSound) next.approvalSound = approvalSound;
    if (typeof patch.confettiEffect === "boolean") next.confettiEffect = patch.confettiEffect;
    if (typeof patch.imageWatermark === "boolean") next.imageWatermark = patch.imageWatermark;
    return next;
  }
}

// 读取工作区真实依赖清单，供设置页「打开源许可证」弹窗展示。
export async function readBundledOpenSourceLicenses(repoRoot: string): Promise<OpenSourcePackageInfo[]> {
  const pkgFiles = [
    { scope: "root", file: join(repoRoot, "package.json") },
    { scope: "web", file: join(repoRoot, "apps", "web", "package.json") },
    { scope: "chat", file: join(repoRoot, "packages", "core", "chat", "package.json") },
  ];
  const seen = new Map<string, OpenSourcePackageInfo>();
  for (const item of pkgFiles) {
    try {
      const raw = await readFile(item.file, "utf8");
      const parsed = JSON.parse(raw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      for (const group of [parsed.dependencies, parsed.devDependencies]) {
        if (!group) continue;
        for (const [name, version] of Object.entries(group)) {
          if (version.startsWith("workspace:") || seen.has(name)) continue;
          seen.set(name, { name, version, scope: item.scope });
        }
      }
    } catch {
      // 忽略缺失的可选清单文件。
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}
