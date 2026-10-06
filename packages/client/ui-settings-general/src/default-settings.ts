/** 功能：提供 lfaa-client-ui-settings-general 的现有界面能力。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { DEFAULT_APPEARANCE_ADVANCED_SETTINGS, type UserSettings } from "lfaa-client-connection/src/api.js";
export const DEFAULT_USER_SETTINGS: UserSettings = {
  general: {
    defaultMode: "normal", showServiceStatus: true, showBottomPanelControl: true, taskFolder: "",
    fileOpenLocation: "system", agentEnvironment: "system", integratedShell: "system", language: "system", defaultFullView: true, navigationLayout: "three-column",
    terminalPosition: "bottom", plainTextEditor: true, sendShortcut: "enter", followupBehavior: "queue", popupShortcut: "", defaultStandaloneChat: false,
    completionNotification: "unfocused", permissionNotifications: true, questionNotifications: true, sessionIssueNotifications: true, notificationSound: "default", setupReminderEnabled: true, confettiEnabled: false
  },
  appearance: { theme: "system", accentColor: "#3457d5", sidebarColor: "auto", backgrounds: { login: "forest-bridge-evening", appCenter: "cherry-blossom-shore", steamcmd: "ocean-cliff-sunset", minecraft: "cherry-blossom-village", writing: "snowy-cabin-interior", settings: "lakeside-pagoda-morning" }, wallpaperEngine: { enabled: false, projectId: "" }, overlay: 37, blur: 14, advanced: structuredClone(DEFAULT_APPEARANCE_ADVANCED_SETTINGS) },
  shortcuts: { openSettings: ["Ctrl+,"], openHome: ["Alt+0"], openSteamcmd: ["Ctrl+Alt+1"], openMinecraft: ["Ctrl+Alt+2"], openWriting: ["Ctrl+Alt+3"], toggleSidebar: ["Ctrl+B"], toggleContextPanel: ["Ctrl+Alt+B"], toggleBottomPanel: ["Ctrl+J"], openTerminal: ["Ctrl+`"], switchNormalMode: ["Alt+1"], switchAiWorkMode: ["Alt+2"], openSideChat: ["Ctrl+Alt+S"], wallpaperSidebarToggle: [] },
  aiRuntime: { speed: "balanced", promptSuggestions: true, showContextUsage: false, requestTimeoutSeconds: 90, maxOutputTokens: 2048, maxModelRequests: 12, maxToolCalls: 24, subagentAccountId: "", maxSubagents: 4, maxDelegationDepth: 2, voiceInputEnabled: false, readResponsesAloud: false, commandTimeoutSeconds: 0 },
  minecraftRuntime: { minecraftReadyTimeoutSeconds: 120, minecraftStopTimeoutSeconds: 30, minecraftDefaultMemoryMb: 4096, minecraftDefaultPort: 25565, minecraftDownloadTimeoutSeconds: 1800, minecraftInstallTimeoutSeconds: 900, minecraftExecutionMode: "native", minecraftDefaultCore: "Paper", minecraftBedrockDefaultPort: 19132 },
  git: { branchPrefix: "codex/" },
  permissions: { mode: "ask" },
  personalization: { memoryEnabled: false, memoryFromToolChats: false },
  computerControl: { enabled: false },
  plugins: { enabled: false, mcpServers: [], prompts: [] }
};
