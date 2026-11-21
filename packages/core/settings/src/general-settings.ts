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

/** 为常规设置读取和写入解析路径，测试可提供独立档案。 */
export function getGeneralSettingsFilePath(overridePath?: string): string {
  if (overridePath) return resolve(overridePath);
  return join(resolveUserHome(), ".lfaa", "general-settings.json");
}

/** 解析未绑定项目会话的默认目录，供 Agent 工作区初始化使用。 */
export function resolveDefaultOutsideProjectFolder(): string {
  return join(resolveUserHome(), ".lfaa", "workspace");
}

/** 兼容旧版使用应用数据根作为默认值，项目外产物写入专用目录。 */
function normalizeOutsideProjectFolder(input: string): string {
  const path = resolve(input.trim());
  const legacy = join(resolveUserHome(), ".lfaa");
  const same = process.platform === "win32" ? path.toLowerCase() === legacy.toLowerCase() : path === legacy;
  return same ? resolveDefaultOutsideProjectFolder() : path;
}

// 动态解析当前登录 Windows/POSIX 用户的“文档\lfaa”路径，供未添加源文件夹直接按名称新建项目时存放项目目录（不存会话）。
export async function resolveDefaultProjectsFolder(overrideBaseDocs?: string): Promise<string> {
  if (overrideBaseDocs) return join(resolve(overrideBaseDocs), "lfaa");
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
      if (detected) return join(resolve(detected), "lfaa");
    } catch {
      // 回退到用户主目录下的 Documents\lfaa。
    }
  }
  return join(resolveUserHome(), "Documents", "lfaa");
}

function createDefaultSettings(outsideProjectFolder: string, defaultProjectsFolder: string): GeneralSettingsConfig {
  return {
    schemaVersion: 2,
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
    const defaultOutside = resolveDefaultOutsideProjectFolder();
    const defaultProjects = await resolveDefaultProjectsFolder();
    const defaults = createDefaultSettings(defaultOutside, defaultProjects);
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<GeneralSettingsConfig>;
      let merged = this.mergePatch(defaults, parsed);
      // 兼容旧 v1 的文档目录默认值，项目外任务与应用数据使用独立位置。
      if ((parsed.schemaVersion ?? 1) < 2) {
        const legacyDocsTail = parsed.outsideProjectFolder?.replaceAll("/", "\\").toLowerCase();
        if (legacyDocsTail && legacyDocsTail.endsWith("\\documents\\lfaa")) {
          merged = {
            ...merged,
            schemaVersion: 2,
            outsideProjectFolder: defaultOutside,
            defaultProjectsFolder: defaultProjects,
            updatedAt: Date.now(),
          };
          await mkdir(dirname(this.filePath), { recursive: true });
          await writeFile(this.filePath, JSON.stringify(merged, null, 2), "utf8");
        }
      }
      this.cached = { ...merged, schemaVersion: 2 };
    } catch {
      this.cached = defaults;
    }
    return this.cached;
  }

  async update(patch: Partial<GeneralSettingsConfig>): Promise<GeneralSettingsConfig> {
    const current = await this.get();
    const next = this.mergePatch(current, patch);
    next.updatedAt = Date.now();
    this.cached = next;
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(next, null, 2), "utf8");
    return next;
  }

  private mergePatch(base: GeneralSettingsConfig, patch: Partial<GeneralSettingsConfig>): GeneralSettingsConfig {
    const next: GeneralSettingsConfig = { ...base };
    if (typeof patch.outsideProjectFolder === "string" && patch.outsideProjectFolder.trim()) {
      next.outsideProjectFolder = normalizeOutsideProjectFolder(patch.outsideProjectFolder);
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
