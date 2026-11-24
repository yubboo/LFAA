// 浏览器端通用设置公共契约与默认值：供 store 与 settings 单向共享，打破 store ↔ settings 循环依赖。
import { playNotificationSound } from "./notification-sounds";

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

/** 定义浏览器表单与 Host 之间交换的常规偏好数据。 */
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
  /** 旧版统一提示音；新配置按事件分别保存，缺省时回退到这里。 */
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

/** 提供许可证列表需要的依赖名称、版本和授权信息。 */
export interface OpenSourcePackageInfo {
  name: string;
  version: string;
  scope: string;
}

/** 约定设置页与字典加载器共用的浏览器语言偏好键。 */
export const LOCALE_OVERRIDE_STORAGE_KEY = "lfaa:locale-override";

/** 提供 Host 尚未返回偏好时的界面初始值。 */
export const DEFAULT_GENERAL_SETTINGS: GeneralSettingsConfig = {
  schemaVersion: 2,
  outsideProjectFolder: "",
  defaultProjectsFolder: "",
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
  updatedAt: 0,
};

/** 将长目录路径中间省略（如 C:\Users\Admin...ocuments\LFAA），完整路径保留在 title 悬浮提示中。 */
export function middleTruncatePath(rawPath: string, maxLength = 30): string {
  const clean = rawPath.trim();
  if (!clean || clean.length <= maxLength) return clean;
  const head = Math.max(8, Math.floor((maxLength - 3) * 0.48));
  const tail = Math.max(8, maxLength - 3 - head);
  return `${clean.slice(0, head)}...${clean.slice(clean.length - tail)}`;
}

/** 持久化界面语言覆盖设置并在切换时立即驱动组件文案更新。 */
export function writeLocaleOverride(pref: AppLanguagePref): void {
  if (typeof window === "undefined") return;
  try {
    if (pref === "system") {
      window.localStorage.removeItem(LOCALE_OVERRIDE_STORAGE_KEY);
    } else if (pref.startsWith("zh")) {
      window.localStorage.setItem(LOCALE_OVERRIDE_STORAGE_KEY, "zh");
    } else {
      window.localStorage.setItem(LOCALE_OVERRIDE_STORAGE_KEY, "en");
    }
  } catch {
    // 忽略受限存储异常。
  }
}

/** 取出已保存的语言选择，异常时由调用方使用默认语言。 */
export function readLocaleOverride(): AppLanguagePref | null {
  if (typeof window === "undefined") return null;
  try {
    const val = window.localStorage.getItem(LOCALE_OVERRIDE_STORAGE_KEY);
    if (val === "zh" || val === "en") return val;
  } catch {
    // 忽略读取异常。
  }
  return null;
}

/** 兼容旧调用：统一走新的内置/自定义提示音播放层。 */
export function playGentleNotificationSound(mode: NotifySoundMode): void {
  void playNotificationSound(mode);
}
