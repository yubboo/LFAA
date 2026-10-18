/**
 * 功能：定义账户设置的双端共享类型与默认值。
 * 作用：提供不依赖 Node/数据库/React 的纯数据合同，兼容补值由 Settings Owner 负责。
 * 关联文件：settings/settings/src/service.ts、client/connection/src/api.ts、ui-settings-general/src/default-settings.ts。
 */
import type { ApplicationId } from "./application-id.js";

export type AppearanceTextFont = "system" | "sans" | "serif";
export type AppearanceCodeFont = "system" | "cascadia" | "consolas" | "jetbrains";
export interface AppearanceModeStyle { accentColor: string; fonts: AppearanceFonts }

export type SettingsCategory = "general" | "appearance" | "shortcuts" | "ai-runtime" | "minecraft-runtime" | "git" | "permissions" | "plugins" | "personalization" | "computer-control";

export const UI_MOTION_EFFECT_OPTIONS = [
  { id: "fluid", label: "柔和流体", cardDescription: "轻轻淡入、错开上浮；默认效果。", dialogDescription: "轻柔淡入、微缩放并顺势落位；默认效果。" },
  { id: "fade", label: "渐隐淡入", cardDescription: "从轻微缩放中柔和显现。", dialogDescription: "以柔和渐隐和轻微缩放进出。" },
  { id: "lift", label: "轻盈上浮", cardDescription: "从下方升起，悬停时轻抬。", dialogDescription: "从稍低位置轻盈升起后停稳。" },
  { id: "none", label: "静态", cardDescription: "不播放卡片入场或悬停动画。", dialogDescription: "不播放弹窗入场或退出动画。" }
] as const;
export type UiMotionEffect = typeof UI_MOTION_EFFECT_OPTIONS[number]["id"];
export type CardMotionEffect = UiMotionEffect;
export type DialogMotionEffect = UiMotionEffect;
export const UI_MOTION_EFFECT_IDS: readonly UiMotionEffect[] = UI_MOTION_EFFECT_OPTIONS.map(({ id }) => id);
// 兼容现有卡片设置消费者；卡片与弹窗共用同一个效果目录。
export const CARD_MOTION_EFFECT_OPTIONS = UI_MOTION_EFFECT_OPTIONS;
export const CARD_MOTION_EFFECT_IDS = UI_MOTION_EFFECT_IDS;

export interface GeneralSettings {
  defaultMode: "normal" | "ai-work";
  showServiceStatus: boolean;
  showBottomPanelControl: boolean;
  taskFolder: string;
  fileOpenLocation: "system" | "ask";
  agentEnvironment: "system" | "windows-native" | "wsl" | "linux";
  integratedShell: "system" | "powershell" | "cmd" | "bash" | "zsh";
  language: "system" | "zh-CN" | "en-US";
  defaultFullView: boolean;
  navigationLayout: "left-two-column" | "three-column" | "right-tools" | "focus";
  cardMotionEffect: CardMotionEffect;
  dialogMotionEffect: DialogMotionEffect;
  terminalPosition: "bottom" | "right";
  plainTextEditor: boolean;
  sendShortcut: "enter" | "ctrl-enter";
  followupBehavior: "queue" | "steer";
  popupShortcut: string;
  defaultStandaloneChat: boolean;
  notificationPopupsEnabled: boolean;
  completionNotification: "always" | "unfocused" | "never";
  permissionNotifications: boolean;
  questionNotifications: boolean;
  sessionIssueNotifications: boolean;
  notificationSound: "default" | "subtle" | "off";
  setupReminderEnabled: boolean;
  defaultAdminCredentialReminderEnabled: boolean;
  confettiEnabled: boolean;
}

export interface AppearanceSettings {
  theme: "light" | "dark" | "system";
  accentColor: string;
  sidebarColor: string;
  backgrounds: {
    login: string;
    appCenter: string;
    steamcmd: string;
    minecraft: string;
    writing: string;
    settings: string;
  };
  wallpaperEngine: { enabled: boolean; projectId: string };
  overlay: number;
  blur: number;
  updateSurfaceOpacity: number;
  advanced: AppearanceAdvancedSettings;
}

export interface AppearanceFonts {
  interface: "system" | "sans" | "serif";
  content: "system" | "sans" | "serif";
  code: "system" | "cascadia" | "consolas" | "jetbrains";
}

export interface AppearanceAdvancedSettings {
  interfaceFontSize: number;
  codeFontSize: number;
  reducedMotion: "system" | "on" | "off";
  authTransitionPluginId: string;
  separateModes: boolean;
  fonts: AppearanceFonts;
  modeStyles: {
    light: { accentColor: string; fonts: AppearanceFonts };
    dark: { accentColor: string; fonts: AppearanceFonts };
  };
  translucentSidebar: boolean;
  contrast: number;
  diffMarkers: "color" | "symbols";
  pointerCursor: boolean;
  aiWorkOutputFocusBlurEnabled: boolean;
  aiWorkOutputFocusBlurPercent: number;
  aiWorkOutputFocusBlurIdleSeconds: number;
}

export interface AppearanceBackgroundView {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  createdAt: string;
}

export interface ShortcutSettings {
  openSettings: string[];
  openHome: string[];
  openSteamcmd: string[];
  openMinecraft: string[];
  openWriting: string[];
  toggleSidebar: string[];
  toggleContextPanel: string[];
  toggleBottomPanel: string[];
  openTerminal: string[];
  switchNormalMode: string[];
  switchAiWorkMode: string[];
  openSideChat: string[];
  wallpaperSidebarToggle: string[];
}

export interface UserSettings {
  general: GeneralSettings;
  appearance: AppearanceSettings;
  shortcuts: ShortcutSettings;
  aiRuntime: AiRuntimeSettings;
  minecraftRuntime: MinecraftRuntimeSettings;
  git: GitSettings;
  permissions: PermissionSettings;
  plugins: PluginSettings;
  personalization: PersonalizationSettings;
  computerControl: ComputerControlSettings;
}

export interface ComputerControlSettings {
  enabled: boolean;
}

export interface PersonalizationSettings {
  memoryEnabled: boolean;
  memoryFromToolChats: boolean;
}

/** 单轮模型请求硬上限，包含重试与上下文摘要请求。设置为 0 时使用此值。 */
export const AI_RUNTIME_MAX_MODEL_REQUESTS_PER_RUN = 64;
/** 单轮工具调用硬上限。设置为 0 时使用此值。 */
export const AI_RUNTIME_MAX_TOOL_CALLS_PER_RUN = 128;

export interface AiRuntimeSettings {
  speed: "balanced" | "fast" | "deep";
  promptSuggestions: boolean;
  showContextUsage: boolean;
  requestTimeoutSeconds: number;
  /** 模型请求失败恢复；不得重放工具，仍计入本轮总请求预算。 */
  requestRetries: number;
  retryDelaySeconds: number;
  /** 0 跟随所选模型目录输出上限；目录未提供时遵循 Provider 默认。正数为用户请求上限。 */
  maxOutputTokens: number;
  /** 0 使用产品单轮硬上限；正数可设置更低的用户预算。 */
  maxModelRequests: number;
  /** 0 使用产品单轮硬上限；正数可设置更低的用户预算。 */
  maxToolCalls: number;
  subagentAccountId: string;
  /** AI 漫剧图片生成使用的已保存 Settings 账户与模型目录 ID。 */
  imageGenerationAccountId: string;
  imageGenerationModelId: string;
  /** AI 漫剧视频生成使用的已保存火山方舟账户与模型目录 ID。 */
  videoGenerationAccountId: string;
  videoGenerationModelId: string;
  videoGenerationDurationSeconds: number;
  videoGenerationRatio: "adaptive" | "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  videoGenerationResolution: "480p" | "720p" | "1080p";
  videoGenerationGenerateAudio: boolean;
  videoGenerationWatermark: boolean;
  maxSubagents: number;
  maxDelegationDepth: number;
  voiceInputEnabled: boolean;
  readResponsesAloud: boolean;
  commandTimeoutSeconds: number;
  /** 自动摘要由当前模型执行，仍计入请求预算；窗口未知时用此配置。 */
  contextWindowTokens?: number;
  autoCompaction?: boolean;
}

export interface MinecraftRuntimeSettings {
  minecraftReadyTimeoutSeconds: number;
  minecraftStopTimeoutSeconds: number;
  minecraftDefaultMemoryMb: number;
  minecraftDefaultPort: number;
  minecraftDownloadTimeoutSeconds: number;
  minecraftInstallTimeoutSeconds: number;
  minecraftExecutionMode: "native" | "appcontainer";
  minecraftDefaultCore: string;
  minecraftBedrockDefaultPort: number;
}

export interface GitSettings {
  branchPrefix: string;
}

export interface PermissionSettings {
  mode: "ask" | "approve_remembered" | "full_access";
}

export interface UserCapabilityPrompt {
  id: string;
  name: string;
  description: string;
  applicationId: ApplicationId;
  sourceRepository: string;
  sourcePath: string;
  license: string | null;
  commit: string;
  archiveSha256: string;
  contentSha256: string;
  content: string;
  enabled: boolean;
  createdAt: string;
}

export interface PluginSettings {
  enabled: boolean;
  /** 当前账户主动配置的本机 Skill 根；不作为远端服务器文件访问授权。 */
  skillDirectories?: string[];
  mcpServers: Array<McpServerSetting>;
  prompts: UserCapabilityPrompt[];
}

export type McpServerSetting = {
  id: string;
  name: string;
  enabled: boolean;
  applicationIds: ApplicationId[];
  manifestSha256?: string;
  computerUse?: boolean;
} & (
  | { transport?: "streamable-http"; url: string; command?: never; args?: never }
  | { transport: "stdio"; command: string; args: string[]; url?: never }
);

export const DEFAULT_APPEARANCE_ADVANCED_SETTINGS: AppearanceAdvancedSettings = {
  interfaceFontSize: 14,
  codeFontSize: 12,
  reducedMotion: "system",
  authTransitionPluginId: "builtin",
  separateModes: false,
  fonts: { interface: "system", content: "system", code: "system" },
  modeStyles: {
    light: { accentColor: "#3457d5", fonts: { interface: "system", content: "system", code: "system" } },
    dark: { accentColor: "#3457d5", fonts: { interface: "system", content: "system", code: "system" } }
  },
  translucentSidebar: false,
  contrast: 60,
  diffMarkers: "color",
  pointerCursor: false,
  aiWorkOutputFocusBlurEnabled: true,
  aiWorkOutputFocusBlurPercent: 33,
  aiWorkOutputFocusBlurIdleSeconds: 60
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  general: {
    defaultMode: "ai-work",
    showServiceStatus: true,
    showBottomPanelControl: true,
    taskFolder: "",
    fileOpenLocation: "system",
    agentEnvironment: "system",
    integratedShell: "system",
    language: "system",
    defaultFullView: true,
    navigationLayout: "three-column",
    cardMotionEffect: "fluid",
    dialogMotionEffect: "fluid",
    terminalPosition: "bottom",
    plainTextEditor: true,
    sendShortcut: "enter",
    followupBehavior: "queue",
    popupShortcut: "",
    defaultStandaloneChat: true,
    notificationPopupsEnabled: true,
    completionNotification: "unfocused",
    permissionNotifications: true,
    questionNotifications: true,
    sessionIssueNotifications: true,
    notificationSound: "default",
    setupReminderEnabled: true,
    defaultAdminCredentialReminderEnabled: true,
    confettiEnabled: false
  },
  appearance: { theme: "system", accentColor: "#3457d5", sidebarColor: "auto", backgrounds: { login: "forest-bridge-evening", appCenter: "cherry-blossom-shore", steamcmd: "ocean-cliff-sunset", minecraft: "cherry-blossom-village", writing: "snowy-cabin-interior", settings: "lakeside-pagoda-morning" }, wallpaperEngine: { enabled: false, projectId: "" }, overlay: 65, blur: 14, updateSurfaceOpacity: 92, advanced: structuredClone(DEFAULT_APPEARANCE_ADVANCED_SETTINGS) },
  shortcuts: { openSettings: ["Ctrl+,"], openHome: ["Alt+0"], openSteamcmd: ["Ctrl+Alt+1"], openMinecraft: ["Ctrl+Alt+2"], openWriting: ["Ctrl+Alt+3"], toggleSidebar: ["Ctrl+B"], toggleContextPanel: ["Ctrl+Alt+B"], toggleBottomPanel: ["Ctrl+J"], openTerminal: ["Ctrl+`"], switchNormalMode: ["Alt+1"], switchAiWorkMode: ["Alt+2"], openSideChat: ["Ctrl+Alt+S"], wallpaperSidebarToggle: [] },
  aiRuntime: { speed: "balanced", promptSuggestions: true, showContextUsage: false, requestTimeoutSeconds: 90, requestRetries: 1, retryDelaySeconds: 1, maxOutputTokens: 0, maxModelRequests: 0, maxToolCalls: 0, subagentAccountId: "", imageGenerationAccountId: "", imageGenerationModelId: "", videoGenerationAccountId: "", videoGenerationModelId: "", videoGenerationDurationSeconds: 5, videoGenerationRatio: "adaptive", videoGenerationResolution: "720p", videoGenerationGenerateAudio: false, videoGenerationWatermark: true, maxSubagents: 4, maxDelegationDepth: 2, voiceInputEnabled: false, readResponsesAloud: false, commandTimeoutSeconds: 0, autoCompaction: true, contextWindowTokens: 32768 },
  minecraftRuntime: { minecraftReadyTimeoutSeconds: 120, minecraftStopTimeoutSeconds: 30, minecraftDefaultMemoryMb: 4096, minecraftDefaultPort: 25565, minecraftDownloadTimeoutSeconds: 1800, minecraftInstallTimeoutSeconds: 900, minecraftExecutionMode: "native", minecraftDefaultCore: "Paper", minecraftBedrockDefaultPort: 19132 },
  git: { branchPrefix: "codex/" },
  permissions: { mode: "ask" },
  plugins: { enabled: false, mcpServers: [], prompts: [], skillDirectories: [] },
  personalization: { memoryEnabled: false, memoryFromToolChats: false },
  computerControl: { enabled: false }
};

