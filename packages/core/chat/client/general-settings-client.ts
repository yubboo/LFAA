// 提供浏览器端通用设置默认结构、长路径中间省略格式化、开源依赖读取及轻量提示音播放辅助。
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
  sendShortcut: SendShortcutMode;
  followUpMode: FollowUpHandleMode;
  popoutShortcut: string;
  defaultStandaloneChat: boolean;
  turnCompleteNotification: TurnNotifyMode;
  enableApprovalNotification: boolean;
  enableQuestionNotification: boolean;
  enableDotNotification: boolean;
  notificationSound: NotifySoundMode;
  confettiEffect: boolean;
  updatedAt: number;
}

export interface OpenSourcePackageInfo {
  name: string;
  version: string;
  scope: string;
}

export const LOCALE_OVERRIDE_STORAGE_KEY = "lfaa:locale-override";

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
  sendShortcut: "enter",
  followUpMode: "queue",
  popoutShortcut: "",
  defaultStandaloneChat: false,
  turnCompleteNotification: "unfocused",
  enableApprovalNotification: true,
  enableQuestionNotification: true,
  enableDotNotification: true,
  notificationSound: "default",
  confettiEffect: true,
  updatedAt: 0,
};

// 将长目录路径中间省略（如 C:\Users\Admin...ocuments\LFAA），完整路径保留在 title 悬浮提示中。
export function middleTruncatePath(rawPath: string, maxLength = 30): string {
  const clean = rawPath.trim();
  if (!clean || clean.length <= maxLength) return clean;
  const head = Math.max(8, Math.floor((maxLength - 3) * 0.48));
  const tail = Math.max(8, maxLength - 3 - head);
  return `${clean.slice(0, head)}...${clean.slice(clean.length - tail)}`;
}

// 持久化界面语言覆盖设置并在切换时立即驱动组件文案更新。
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

// 使用 Web Audio 合成轻柔短提示音，不依赖外部音频文件。
export function playGentleNotificationSound(mode: NotifySoundMode): void {
  if (mode === "mute" || typeof window === "undefined") return;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  try {
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = mode === "chime" ? "triangle" : "sine";
    osc.frequency.setValueAtTime(mode === "chime" ? 880 : 660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(mode === "chime" ? 1174 : 880, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.19);
    window.setTimeout(() => void ctx.close().catch(() => {}), 300);
  } catch {
    // 忽略自动播放策略拦截异常。
  }
}
