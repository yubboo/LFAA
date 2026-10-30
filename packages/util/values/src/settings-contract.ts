/**
 * 功能：定义账户设置的双端共享类型与默认值。
 * 作用：提供不依赖 Node/数据库/React 的纯数据合同，兼容补值由 Settings Owner 负责。
 * 关联文件：settings/settings/src/service.ts、client/connection/src/api.ts、ui-settings-general/src/default-settings.ts。
 */
import type { ApplicationId, ApplicationNavigationId } from "./application-id.js";
import type { BrowserProviderId } from "./browser-provider.js";
import type { ExecutionSandboxMode } from "./sandbox-contract.js";

export type AppearanceTextFont = "system" | "sans" | "serif";
export type AppearanceCodeFont = "system" | "cascadia" | "consolas" | "jetbrains";
export interface AppearanceModeStyle { accentColor: string; fonts: AppearanceFonts }

export type SettingsCategory = "general" | "appearance" | "shortcuts" | "ai-runtime" | "minecraft-runtime" | "git" | "permissions" | "plugins" | "personalization" | "computer-control" | "browser-use" | "mini" | "canvas";

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
  hiddenApplicationNavigationIds: ApplicationNavigationId[];
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
  notificationToastDurationSeconds: number;
  notificationToastEffect: UiMotionEffect;
  aiProviderReminderEnabled: boolean;
  setupReminderEnabled: boolean;
  defaultAdminCredentialReminderEnabled: boolean;
  confettiEnabled: boolean;
}

export interface AppearanceSettings {
  presets: AppearancePreset[];
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
  areaEffects: AppearanceAreaEffects;
  wallpaperEngine: { enabled: boolean; projectId: string };
  overlay: number;
  blur: number;
  updateSurfaceOpacity: number;
  advanced: AppearanceAdvancedSettings;
}

/** 外观快照中不包含用户预设库，避免嵌套复制或递归增长。 */
export interface AppearancePresetSnapshot {
  appearance: AppearanceVisualSettings;
  general: AppearancePresetGeneralSettings;
}

export interface AppearancePreset {
  id: string;
  name: string;
  description: string;
  snapshot: AppearancePresetSnapshot;
}

export type AppearancePresetGeneralSettings = Pick<GeneralSettings,
  "defaultFullView" | "showServiceStatus" | "showBottomPanelControl" | "navigationLayout" | "hiddenApplicationNavigationIds" | "cardMotionEffect" | "dialogMotionEffect" | "terminalPosition"
>;

export interface AppearanceVisualSettings {
  theme: AppearanceSettings["theme"];
  accentColor: string;
  sidebarColor: string;
  backgrounds: AppearanceSettings["backgrounds"];
  areaEffects: AppearanceAreaEffects;
  wallpaperEngine: AppearanceSettings["wallpaperEngine"];
  overlay: number;
  blur: number;
  updateSurfaceOpacity: number;
  advanced: AppearanceAdvancedSettings;
}

export const APPEARANCE_PRESET_LIMIT = 20;
export const APPEARANCE_PRESET_NAME_MAX_LENGTH = 40;

/** 逐区域遮罩覆盖；Workbench 区域另支持玻璃模糊覆盖。null 表示沿用全局 Appearance 值。 */
export interface AppearanceAreaEffects {
  login: { overlay: number | null };
  appCenter: { overlay: number | null; blur: number | null };
  steamcmd: { overlay: number | null; blur: number | null };
  minecraft: { overlay: number | null; blur: number | null };
  writing: { overlay: number | null; blur: number | null };
  settings: { overlay: number | null; blur: number | null };
}

export const DEFAULT_APPEARANCE_AREA_EFFECTS: AppearanceAreaEffects = {
  login: { overlay: null },
  appCenter: { overlay: null, blur: null },
  steamcmd: { overlay: null, blur: null },
  minecraft: { overlay: null, blur: null },
  writing: { overlay: null, blur: null },
  settings: { overlay: null, blur: null }
};

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
  writingLightRaysEnabled: boolean;
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
  browserUse: BrowserUseSettings;
  mini: MiniSettings;
  canvas: CanvasSettings;
}

export interface MiniSettings {
  companion: "moss" | "cloud" | "ember";
  showCompanion: boolean;
  alwaysOnTop: boolean;
  opacity: number;
}

/** 画布打开时的默认模式：生成工作台或空白画布编排；两者都创建真实项目。 */
export const CANVAS_DEFAULT_MODE_OPTIONS = [
  { id: "generate", label: "生成工作台", description: "进入后默认展示生成工作台，仍可随时切换到画布。" },
  { id: "canvas", label: "画布编排", description: "进入后默认展示空白画布，仍可随时切换到生成。" }
] as const;
export type CanvasDefaultMode = typeof CANVAS_DEFAULT_MODE_OPTIONS[number]["id"];
export const CANVAS_DEFAULT_MODE_IDS: readonly CanvasDefaultMode[] = CANVAS_DEFAULT_MODE_OPTIONS.map(({ id }) => id);

/** 画布背景网格样式；关闭网格不改变节点坐标与吸附计算。 */
export const CANVAS_GRID_STYLE_OPTIONS = [
  { id: "dots", label: "点阵", description: "即梦式点阵网格；默认样式。" },
  { id: "lines", label: "线框", description: "显示连续参考线，便于大范围对齐。" },
  { id: "none", label: "关闭", description: "隐藏网格；拖动吸附仍按保存的开关计算。" }
] as const;
export type CanvasGridStyle = typeof CANVAS_GRID_STYLE_OPTIONS[number]["id"];
export const CANVAS_GRID_STYLE_IDS: readonly CanvasGridStyle[] = CANVAS_GRID_STYLE_OPTIONS.map(({ id }) => id);

/**
 * 画布账户偏好。
 * 只保存视图与默认交互；生成模型继续复用 aiRuntime 的图片/视频生成设置，不在此复制第二套模型配置。
 */
export interface CanvasSettings {
  /** 打开 /canvas 时默认进入生成工作台还是画布编排。 */
  defaultMode: CanvasDefaultMode;
  /** 画布背景网格样式。 */
  gridStyle: CanvasGridStyle;
  /** 拖动节点时是否吸附到网格。 */
  snapToGrid: boolean;
  /** 是否显示右下角小地图；关闭只隐藏视图，不删除项目数据。 */
  showMiniMap: boolean;
  /** 进入画布工作区时是否默认展开 Agent 对话面板。 */
  agentPanelDefaultOpen: boolean;
}

export interface ComputerControlSettings {
  enabled: boolean;
}

export interface BrowserUseSettings {
  /** 是否向 Agent 提供浏览器操作工具；所有动作仍由 permissions.mode 授权。 */
  enabled: boolean;
  /** Agent 打开公开网页时使用 LFAA Browser Owner，或当前可见的用户浏览器。 */
  webUrlOpenLocation: "lfaa" | "current-browser";
  /** Agent 打开 localhost/loopback 开发 URL 时使用 LFAA Browser Owner，或当前可见的用户浏览器。 */
  localUrlOpenLocation: "lfaa" | "current-browser";
  /** 用户明确接入的个人浏览器提供方；LFAA 内置浏览器不读写此字段。 */
  enabledProviderIds: BrowserProviderId[];
  /** 是否在浏览器地址栏展示完整路径、查询参数与片段。 */
  showFullUrl: boolean;
  /** 是否按账户保存 LFAA Browser Dock 与 Agent 实际访问的网站。 */
  recordRecentSites: boolean;
  /** 用户是否允许 Agent 读取 LFAA Browser Owner 保存的最近网站历史。 */
  allowAgentHistoryAccess: boolean;
  /** 控制 Agent 工具观察页面时是否把截图作为临时视觉输入。 */
  annotateScreenshots: "always" | "on-demand" | "never";
  /** 是否允许 Agent 默认发现当前网站提供的 WebMCP 工具。 */
  useWebsiteToolsByDefault: boolean;
  /** 对默认值进行覆盖的网站 WebMCP 例外，来源精确到 HTTP(S) Origin。 */
  websiteToolOverrides: Array<{ origin: string; decision: "allow" | "block" }>;
  /** Electron 下载是否逐项显示系统保存对话框。 */
  askBeforeDownload: boolean;
  /** 各类站点权限的账户默认决定；ask 表示每次请求交由用户处理。 */
  sitePermissionDefaults: Record<BrowserSitePermission, "ask" | "allow" | "block">;
  /** 按 HTTP(S) 来源保存的显式允许/拒绝例外。 */
  sitePermissionOverrides: BrowserSitePermissionOverride[];
  /** 是否显示并开放开发者浏览器工具。默认关闭。 */
  developerMode: boolean;
  /** 是否允许当前 Agent Run 调用完整 CDP；必须先开启 developerMode。 */
  fullCdpAccess: boolean;
  /** 地址栏输入普通文字时使用的默认搜索引擎。 */
  searchEngine: "bing" | "google" | "duckduckgo";
}

export type BrowserSitePermission = "camera" | "microphone" | "geolocation" | "notifications";
export interface BrowserSitePermissionOverride {
  origin: string;
  permission: BrowserSitePermission;
  decision: "allow" | "block";
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
  /** Agent Shell 文件访问限制；不是工具调用授权或审批模式。 */
  executionSandboxMode: ExecutionSandboxMode;
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
  /** 漫剧图片生成方式；本地模型不创建虚假的服务商账户。 */
  imageGenerationMode: "provider" | "local";
  /** AI 漫剧图片生成使用的已保存 Settings 账户与模型目录 ID。 */
  imageGenerationAccountId: string;
  imageGenerationModelId: string;
  /** 从 LFAA 本地模型库选择的原生图像模型 ID。 */
  imageGenerationLocalModelId: string;
  /** 首次装载与本机图像推理合计的最长等待秒数。 */
  imageGenerationLocalTimeoutSeconds: number;
  /** 生成完成后模型保留在运行进程中的空闲分钟数。 */
  imageGenerationUnloadAfterMinutes: number;
  /** 漫剧视频生成方式；本地模型不创建虚假的服务商账户。 */
  videoGenerationMode: "provider" | "local";
  /** 从 LFAA 本地模型库选择的原生视频模型 ID。 */
  videoGenerationLocalModelId: string;
  /** 首次装载与本机视频推理合计的最长等待秒数。 */
  videoGenerationLocalTimeoutSeconds: number;
  /** 视频生成后模型保留在运行进程中的空闲分钟数。 */
  videoGenerationUnloadAfterMinutes: number;
  /** AI 漫剧视频生成使用的已保存火山方舟账户与模型目录 ID。 */
  videoGenerationAccountId: string;
  videoGenerationModelId: string;
  /** 无公开字幕时，用于视频语音识别的已保存 Ark Agent Plan 账户。 */
  videoTranscriptionAccountId: string;
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
  /** 当前账户主动停用的 Skill 名称；只影响模型目录与加载，不改 Skill 来源文件。 */
  disabledSkillNames: string[];
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
  | { transport: "stdio"; command: string; args: string[]; env?: Record<string, string>; url?: never }
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
  aiWorkOutputFocusBlurEnabled: false,
  aiWorkOutputFocusBlurPercent: 33,
  aiWorkOutputFocusBlurIdleSeconds: 60,
  writingLightRaysEnabled: true
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
    hiddenApplicationNavigationIds: [],
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
    notificationToastDurationSeconds: 5,
    notificationToastEffect: "fluid",
    aiProviderReminderEnabled: true,
    setupReminderEnabled: true,
    defaultAdminCredentialReminderEnabled: true,
    confettiEnabled: false
  },
  appearance: { presets: [], theme: "system", accentColor: "#3457d5", sidebarColor: "auto", backgrounds: { login: "none", appCenter: "none", steamcmd: "none", minecraft: "none", writing: "none", settings: "none" }, areaEffects: structuredClone(DEFAULT_APPEARANCE_AREA_EFFECTS), wallpaperEngine: { enabled: false, projectId: "" }, overlay: 65, blur: 14, updateSurfaceOpacity: 92, advanced: structuredClone(DEFAULT_APPEARANCE_ADVANCED_SETTINGS) },
  shortcuts: { openSettings: ["Ctrl+,"], openHome: ["Alt+0"], openSteamcmd: ["Ctrl+Alt+1"], openMinecraft: ["Ctrl+Alt+2"], openWriting: ["Ctrl+Alt+3"], toggleSidebar: ["Ctrl+B"], toggleContextPanel: ["Ctrl+Alt+B"], toggleBottomPanel: ["Ctrl+J"], openTerminal: ["Ctrl+`"], switchNormalMode: ["Alt+1"], switchAiWorkMode: ["Alt+2"], openSideChat: ["Ctrl+Alt+S"], wallpaperSidebarToggle: [] },
  aiRuntime: { executionSandboxMode: "workspace-write", speed: "balanced", promptSuggestions: true, showContextUsage: true, requestTimeoutSeconds: 90, requestRetries: 1, retryDelaySeconds: 1, maxOutputTokens: 0, maxModelRequests: 0, maxToolCalls: 0, subagentAccountId: "", imageGenerationMode: "provider", imageGenerationAccountId: "", imageGenerationModelId: "", imageGenerationLocalModelId: "", imageGenerationLocalTimeoutSeconds: 900, imageGenerationUnloadAfterMinutes: 10, videoGenerationMode: "provider", videoGenerationLocalModelId: "", videoGenerationLocalTimeoutSeconds: 900, videoGenerationUnloadAfterMinutes: 10, videoGenerationAccountId: "", videoGenerationModelId: "", videoTranscriptionAccountId: "", videoGenerationDurationSeconds: 5, videoGenerationRatio: "adaptive", videoGenerationResolution: "720p", videoGenerationGenerateAudio: false, videoGenerationWatermark: true, maxSubagents: 4, maxDelegationDepth: 2, voiceInputEnabled: false, readResponsesAloud: false, commandTimeoutSeconds: 0, autoCompaction: true, contextWindowTokens: 32768 },
  minecraftRuntime: { minecraftReadyTimeoutSeconds: 120, minecraftStopTimeoutSeconds: 30, minecraftDefaultMemoryMb: 4096, minecraftDefaultPort: 25565, minecraftDownloadTimeoutSeconds: 1800, minecraftInstallTimeoutSeconds: 900, minecraftExecutionMode: "native", minecraftDefaultCore: "Paper", minecraftBedrockDefaultPort: 19132 },
  git: { branchPrefix: "codex/" },
  permissions: { mode: "ask" },
  plugins: { enabled: false, mcpServers: [], prompts: [], skillDirectories: [], disabledSkillNames: [] },
  personalization: { memoryEnabled: false, memoryFromToolChats: false },
  computerControl: { enabled: false },
  browserUse: { enabled: false, webUrlOpenLocation: "lfaa", localUrlOpenLocation: "lfaa", enabledProviderIds: [], showFullUrl: false, recordRecentSites: true, allowAgentHistoryAccess: false, annotateScreenshots: "on-demand", useWebsiteToolsByDefault: false, websiteToolOverrides: [], askBeforeDownload: true, sitePermissionDefaults: { camera: "ask", microphone: "ask", geolocation: "ask", notifications: "ask" }, sitePermissionOverrides: [], developerMode: false, fullCdpAccess: false, searchEngine: "bing" },
  mini: { companion: "moss", showCompanion: true, alwaysOnTop: true, opacity: 100 },
  canvas: { defaultMode: "generate", gridStyle: "dots", snapToGrid: false, showMiniMap: true, agentPanelDefaultOpen: false }
};
