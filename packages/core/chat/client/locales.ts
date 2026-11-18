// 管理 @lfaa/chat 浏览器端界面中英文文案字典。
import { readLocaleOverride } from "./general-settings-client";

// 接入方式选择和套餐配置表单共用的双语文案。
export const providerAccessMessages = {
  zh: {
    title: "选择接入方式",
    close: "关闭弹窗",
    api: "API 接入",
    apiDescription: "使用标准 API Key，按量计费",
    subscription: "套餐接入",
    reconfigure: "重新配置",
    planModel: "填写该套餐支持的官方模型 ID",
    selectedModel: "套餐已配置模型",
  },
  en: {
    title: "Connection type",
    close: "Close",
    api: "Standard API",
    apiDescription: "Use a standard pay-as-you-go API key",
    subscription: "Subscription",
    reconfigure: "Reconfigure",
    planModel: "Enter an official model ID supported by this subscription",
    selectedModel: "Configured subscription model",
  },
} as const;

// 方舟公开目录与聊天选模共享的模型状态、分类和思考档位文案。
export const arkModelMessages = {
  zh: {
    source: "方舟官方目录 · 账号权限以控制台为准",
    chat: "语言模型",
    embedding: "向量模型",
    vision: "视觉模型",
    speech: "语音模型",
    resource: "资源 ID",
    routed: "控制台路由",
    retiring: "即将下线",
    chatCatalog: "方舟官方语言模型目录",
    off: "关闭",
    supported: "支持思考 · 方舟未提供可调档位",
    routedReasoning: "思考能力由方舟控制台所选模型决定",
    unknownReasoning: "无已确认的思考档位",
  },
  en: {
    source: "Official Ark catalog · Check your console for account access",
    chat: "Language models",
    embedding: "Embedding",
    vision: "Vision",
    speech: "Speech",
    resource: "Resource ID",
    routed: "Console routing",
    retiring: "Retiring",
    chatCatalog: "Official Ark language catalog",
    off: "Off",
    supported: "Thinking supported · No adjustable levels published",
    routedReasoning: "Thinking depends on the model selected in the Ark console",
    unknownReasoning: "No verified reasoning levels",
  },
} as const;

/** 约定各语言字典的同一组键，供聊天视图索引文案。 */
export interface ChatLocaleMessages {
  isZh: boolean;
  workspaceTitle: string;
  welcomeHeadline: string;
  welcomeSubtitle: string;
  composerPlaceholder: string;
  send: string;
  stop: string;
  newChat: string;
  deleteChat: string;
  noProjectBound: string;
  bindProject: string;
  workLocation: string;
  localComputer: string;
  cloudLocation: string;
  cloudDefaultEnv: string;
  cloudLocationUnavailable: string;
  selectProject: string;
  searchProjects: string;
  noMatchingProjects: string;
  noProjectsYet: string;
  createNewProject: string;
  workOutsideProject: string;
  activeModel: string;
  configureModel: string;
  modelKeyMissingHint: string;
  phaseThink: string;
  phaseAct: string;
  phaseCheck: string;
  statusRunning: string;
  statusWaitingApproval: string;
  statusDone: string;
  statusError: string;
  approveAction: string;
  rejectAction: string;
  approvalRequiredTitle: string;
  permissionPromptTitle: string;
  learnMore: string;
  permissionAskLabel: string;
  permissionAskDesc: string;
  permissionSmartLabel: string;
  permissionSmartDesc: string;
  permissionFullShort: string;
  permissionFullLabel: string;
  permissionFullDesc: string;
  permissionLearnMoreText: string;
  permissionLabel: string;
  toolsFullAccess: string;
  smartTrustedPrefix: string;
  smartTrustedSuffix: string;
  resetSmartTrust: string;
  smartProgressPrefix: string;
  smartProgressSuffix: string;
  highRiskApprovalHint: string;
  addContextTooltip: string;
  addContextMenuTitle: string;
  ctxFile: string;
  ctxFolder: string;
  ctxMention: string;
  ctxActions: string;
  ctxBrowser: string;
  ctxCloudDrive: string;
  ctxSetUp: string;
  mentionAddGroup: string;
  mentionFilesAndFolders: string;
  mentionUseProject: string;
  mentionGoalTitle: string;
  mentionGoalDesc: string;
  mentionPlanTitle: string;
  mentionPlanDesc: string;
  mentionSessionsGroup: string;
  mentionSessionTag: string;
  mentionPluginsGroup: string;
  mentionUnconnectedTag: string;
  mentionEmpty: string;
  ctxServiceUnavailable: string;
  recordAudio: string;
  stopRecording: string;
  cancelRunTooltip: string;
  speechUnsupportedNotice: string;
  speechErrorPrefix: string;
  speechLocalRecordingNotice: string;
  speechTranscribingNotice: string;
  speechNoResultNotice: string;
  speechMicPermissionDenied: string;
  speechMicNotFound: string;
  speechMicBusy: string;
  speechNetworkFallbackFailed: string;
  dismissNoticeLabel: string;
  libraryTitle: string;
  librarySubtitle: string;
  libraryStoragePathLabel: string;
  manageStorageBtn: string;
  openStorageDirBtn: string;
  librarySearchPlaceholder: string;
  libraryTabAll: string;
  libraryTabArtifacts: string;
  libraryTabAssets: string;
  libraryTabMemories: string;
  importAssetBtn: string;
  newAssetNoteBtn: string;
  artifactBadge: string;
  assetBadge: string;
  memoryBadge: string;
  emptyLibraryHint: string;
  selectItemPreviewHint: string;
  copyContentBtn: string;
  copiedNotice: string;
  storageTitle: string;
  storageSubtitle: string;
  storageCurrentPath: string;
  storageFixedSessionsLabel: string;
  storageStatsTitle: string;
  storageSessionsLabel: string;
  storageArtifactsLabel: string;
  storageAssetsLabel: string;
  storageMemoriesLabel: string;
  storageTotalSizeLabel: string;
  storageModeDefaultTitle: string;
  storageModeDefaultDesc: string;
  storageModeProjectTitle: string;
  storageModeProjectDesc: string;
  storageModeCustomTitle: string;
  storageModeCustomDesc: string;
  storageCustomPlaceholder: string;
  storageDetectingUserPath: string;
  storageDetectingProjectPath: string;
  storagePickFolderBtn: string;
  storageResolvedPreview: string;
  storageApplyMigrateBtn: string;
  storageMigratingBtn: string;
  storageMigrationDone: string;
  reasoningSummary: string;
  stepTimelineTitle: string;
  contextTitle: string;
  brainLabel: string;
  toolsLabel: string;
  memoryLabel: string;
  rulesLabel: string;
  rulesLayersCountSuffix: string;
  memoryCountSuffix: string;
  toolsReady: string;
  toolsUnbound: string;
  openAgentSettings: string;
  settingsTitle: string;
  settingsSubtitle: string;
  tabModels: string;
  tabRules: string;
  tabMemory: string;
  providerLabel: string;
  profileNameLabel: string;
  baseUrlLabel: string;
  modelIdLabel: string;
  apiKeyLabel: string;
  apiKeyKeepPlaceholder: string;
  saveProfile: string;
  addProfile: string;
  testConnection: string;
  deleteProfile: string;
  useProfile: string;
  activeBadge: string;
  systemRulesTitle: string;
  projectRulesTitle: string;
  userRulesTitle: string;
  userRulesPlaceholder: string;
  saveRules: string;
  savedNotice: string;
  addMemoryPlaceholder: string;
  addMemory: string;
  deleteMemory: string;
  globalScope: string;
  projectScope: string;
  emptyMemories: string;
  starterInspect: string;
  starterMemory: string;
  starterRules: string;
}

const zh: ChatLocaleMessages = {
  isZh: true,
  workspaceTitle: "首页",
  welcomeHeadline: "我们要做什么？",
  welcomeSubtitle: "支持 LLM 思考规划、工作区工具行动、记忆召回与分层规则约束。",
  composerPlaceholder: "输入任何问题，输入 @ 提及，/触发操作",
  send: "发送",
  stop: "停止",
  newChat: "新聊天",
  deleteChat: "删除会话",
  noProjectBound: "未绑定项目",
  bindProject: "绑定项目",
  workLocation: "工作位置",
  localComputer: "此计算机",
  cloudLocation: "云端",
  cloudDefaultEnv: "默认环境",
  cloudLocationUnavailable: "云端环境暂未接入；当前仅支持本地「此计算机」工作区。",
  selectProject: "选择项目",
  searchProjects: "搜索项目",
  noMatchingProjects: "没有匹配的项目",
  noProjectsYet: "还没有本地项目",
  createNewProject: "新建项目",
  workOutsideProject: "不在项目中工作",
  activeModel: "当前模型",
  configureModel: "配置模型 / 规则",
  modelKeyMissingHint: "当前模型尚未配置 API Key，请点击右侧「配置模型 / 规则」填写或改选本地 Ollama。",
  phaseThink: "思考",
  phaseAct: "行动",
  phaseCheck: "检查",
  statusRunning: "进行中",
  statusWaitingApproval: "待确认",
  statusDone: "已完成",
  statusError: "异常",
  approveAction: "批准 (Yes)",
  rejectAction: "拒绝 (No)",
  approvalRequiredTitle: "操作需要你的确认",
  permissionPromptTitle: "应如何批准 LFAA 操作？",
  learnMore: "了解更多",
  permissionAskLabel: "请求批准",
  permissionAskDesc: "修改文件、执行命令或访问外部路径时始终询问",
  permissionSmartLabel: "帮我审批",
  permissionSmartDesc: "同类操作累计批准 3 次后自动放行；高危操作仍询问",
  permissionFullShort: "完全访问",
  permissionFullLabel: "完全访问权限",
  permissionFullDesc: "可不受限制地访问本机任何文件并自动执行，无需确认",
  permissionLearnMoreText: "「请求批准」每次写文件或跑命令都会弹出 Yes/No；「帮我审批」会记住你在工作区内的选择，同类常规操作批准满 3 次后自动 Yes，遇到破坏性高危命令仍拦截询问；「完全访问权限」将解除目录沙箱限制并全自动执行。",
  permissionLabel: "权限策略",
  toolsFullAccess: "完全访问权限（不限本机目录，全自动执行）",
  smartTrustedPrefix: "已信任",
  smartTrustedSuffix: "类操作自动放行",
  resetSmartTrust: "清空自动放行记忆",
  smartProgressPrefix: "帮我审批：",
  smartProgressSuffix: "次，满 3 次起自动放行",
  highRiskApprovalHint: "检测到高危操作，必须手动确认",
  addContextTooltip: "添加文件等内容",
  addContextMenuTitle: "添加上下文",
  ctxFile: "文件",
  ctxFolder: "文件夹",
  ctxMention: "提及",
  ctxActions: "操作",
  ctxBrowser: "浏览器",
  ctxCloudDrive: "云端硬盘",
  ctxSetUp: "Set up",
  mentionAddGroup: "添加",
  mentionFilesAndFolders: "文件和文件夹",
  mentionUseProject: "在项目中使用 · 选择绑定项目",
  mentionGoalTitle: "目标",
  mentionGoalDesc: "设置要持续追求的目标",
  mentionPlanTitle: "计划模式",
  mentionPlanDesc: "开启计划模式（先给出方案再执行）",
  mentionSessionsGroup: "LFAA 对话",
  mentionSessionTag: "LFAA 对话",
  mentionPluginsGroup: "插件",
  mentionUnconnectedTag: "未接入",
  mentionEmpty: "没有匹配的上下文、对话或插件",
  ctxServiceUnavailable: "暂未接入此扩展服务，目前支持本地文件、文件夹、项目、目标/计划模式与历史对话引用。",
  recordAudio: "语音输入",
  stopRecording: "停止录音",
  cancelRunTooltip: "取消 (Ctrl+D)",
  speechUnsupportedNotice: "当前浏览器不支持录音，请确认处于本机 localhost/https 安全环境且麦克风可用。",
  speechErrorPrefix: "语音输入不可用：",
  speechLocalRecordingNotice: "正在本地录音（离线识别），再次点击麦克风或按 Ctrl+M 停止并识别...",
  speechTranscribingNotice: "正在本地识别语音...",
  speechNoResultNotice: "未识别到清晰语音，请靠近麦克风重试。",
  speechMicPermissionDenied: "未获得麦克风权限，请在浏览器地址栏允许访问麦克风后重试。",
  speechMicNotFound: "未检测到可用麦克风设备，请检查本机音频输入设备。",
  speechMicBusy: "麦克风正被其他程序占用，请释放后重试。",
  speechNetworkFallbackFailed: "在线语音服务不可用，尝试切换本地离线识别失败：",
  dismissNoticeLabel: "关闭提示",
  libraryTitle: "资料库与资产库",
  librarySubtitle: "本地持久化存储 Agent 长期记忆、Agent 生产产物与工作区资产，内置 Agent 可直接读写并自动归档。",
  libraryStoragePathLabel: "当前存储目录：",
  manageStorageBtn: "存储位置设置",
  openStorageDirBtn: "打开目录",
  librarySearchPlaceholder: "搜索记忆、产物标题、文件名或标签...",
  libraryTabAll: "全部",
  libraryTabArtifacts: "Agent 产物",
  libraryTabAssets: "本地资产",
  libraryTabMemories: "Agent 记忆",
  importAssetBtn: "导入文件",
  newAssetNoteBtn: "新建资产笔记",
  artifactBadge: "产物",
  assetBadge: "资产",
  memoryBadge: "记忆",
  emptyLibraryHint: "资料库暂无匹配内容。让 Agent 产出报告/文档或导入本地文件即可在此统一管理。",
  selectItemPreviewHint: "点击左侧任意产物或资产以查看完整内容与存储路径。",
  copyContentBtn: "复制内容",
  copiedNotice: "已复制",
  storageTitle: "存储与资料库位置",
  storageSubtitle: "管理 LFAA 资料库（长期记忆、Agent 产物与本地资产）的磁盘位置与无损迁移；历史会话固定存在本机 ~/.lfaa/sessions，不跟随项目移动。",
  storageCurrentPath: "当前资料库目录（可迁移）",
  storageFixedSessionsLabel: "历史会话目录（固定随本机用户，不跟随项目）",
  storageStatsTitle: "本地数据统计",
  storageSessionsLabel: "历史会话",
  storageArtifactsLabel: "Agent 产物",
  storageAssetsLabel: "本地资产",
  storageMemoriesLabel: "长期记忆",
  storageTotalSizeLabel: "总占用空间",
  storageModeDefaultTitle: "默认位置（系统用户目录）",
  storageModeDefaultDesc: "自动检测当前系统用户目录并在其 .lfaa\\data 下保存，不随单个项目移动。",
  storageModeProjectTitle: "项目推荐目录（跟随项目走）",
  storageModeProjectDesc: "自动识别当前项目所在根目录并在其下生成 data 文件夹，便于随项目打包携带。",
  storageModeCustomTitle: "自定义目录",
  storageModeCustomDesc: "选择或输入任意本机文件夹，系统将自动在该目录下生成并校验 data 目录。",
  storageCustomPlaceholder: "输入或选择任意本机文件夹路径，将自动生成 data 子目录",
  storageDetectingUserPath: "正在自动检测系统用户目录...",
  storageDetectingProjectPath: "正在自动识别当前项目根目录...",
  storagePickFolderBtn: "选择文件夹",
  storageResolvedPreview: "最终将使用并生成目录：",
  storageApplyMigrateBtn: "应用并无损迁移数据",
  storageMigratingBtn: "正在迁移并校验...",
  storageMigrationDone: "已完成无损迁移与校验：",
  reasoningSummary: "查看推理过程",
  stepTimelineTitle: "Agent 循环轨迹",
  contextTitle: "Agent 核心能力",
  brainLabel: "大脑 (LLM)",
  toolsLabel: "手脚 (工具)",
  memoryLabel: "记忆 (会话 + 长期)",
  rulesLabel: "规则 (系统 / 项目 / 用户)",
  rulesLayersCountSuffix: "层规则生效",
  memoryCountSuffix: "条长期记忆",
  toolsReady: "已授权项目沙箱读写与命令",
  toolsUnbound: "未绑定项目目录（仅记忆/对话工具）",
  openAgentSettings: "配置模型、规则与记忆",
  settingsTitle: "模型、规则与记忆配置",
  settingsSubtitle: "管理 LLM 提供商凭据（仅保存在本机 Host）、用户全局规则及长期事实记忆。",
  tabModels: "LLM 大脑配置",
  tabRules: "系统与用户规则",
  tabMemory: "长期记忆库",
  providerLabel: "提供商类型",
  profileNameLabel: "配置名称",
  baseUrlLabel: "Base URL",
  modelIdLabel: "模型 ID",
  apiKeyLabel: "API Key（本机脱敏保存）",
  apiKeyKeepPlaceholder: "输入新 Key；留空则保持原有密钥",
  saveProfile: "保存配置",
  addProfile: "新增模型配置",
  testConnection: "测试连通性",
  deleteProfile: "删除",
  useProfile: "设为当前",
  activeBadge: "当前使用",
  systemRulesTitle: "系统内置规则（最高优先级，不可修改）",
  projectRulesTitle: "项目级规则（来自绑定目录 AGENTS.md / .lfaa/rules.md）",
  userRulesTitle: "用户全局规则",
  userRulesPlaceholder: "例如：优先用简练中文回复；修改代码前先列出受影响文件...",
  saveRules: "保存用户规则",
  savedNotice: "已保存",
  addMemoryPlaceholder: "新增一条希望 Agent 长期记住的事实或偏好...",
  addMemory: "写入记忆",
  deleteMemory: "删除",
  globalScope: "全局",
  projectScope: "当前项目",
  emptyMemories: "暂无长期记忆条目。",
  starterInspect: "读取当前绑定项目结构并总结关键模块",
  starterMemory: "记住我偏好使用简练中文和 TypeScript 严格类型",
  starterRules: "检查当前生效的系统规则、项目规则和工具权限边界",
};

const en: ChatLocaleMessages = {
  isZh: false,
  workspaceTitle: "Home",
  welcomeHeadline: "What should we build?",
  welcomeSubtitle: "Powered by LLM thinking, sandboxed workspace tools, memory recall, and layered rules.",
  composerPlaceholder: "Ask anything, type @ to mention, / for actions",
  send: "Send",
  stop: "Stop",
  newChat: "New chat",
  deleteChat: "Delete chat",
  noProjectBound: "No project",
  bindProject: "Project",
  workLocation: "Work location",
  localComputer: "This computer",
  cloudLocation: "Cloud",
  cloudDefaultEnv: "Default environment",
  cloudLocationUnavailable: "Cloud environments are not connected yet. Using local computer.",
  selectProject: "Select project",
  searchProjects: "Search projects",
  noMatchingProjects: "No matching projects",
  noProjectsYet: "No local projects yet",
  createNewProject: "New project",
  workOutsideProject: "Work without a project",
  activeModel: "Model",
  configureModel: "Models & Rules",
  modelKeyMissingHint: "Selected profile has no API Key yet. Configure it in Settings or choose local Ollama.",
  phaseThink: "Think",
  phaseAct: "Act",
  phaseCheck: "Check",
  statusRunning: "Running",
  statusWaitingApproval: "Approval",
  statusDone: "Done",
  statusError: "Error",
  approveAction: "Approve (Yes)",
  rejectAction: "Deny (No)",
  approvalRequiredTitle: "Action requires your confirmation",
  permissionPromptTitle: "How should LFAA approve actions?",
  learnMore: "Learn more",
  permissionAskLabel: "Ask before acting",
  permissionAskDesc: "Always ask when editing files or running commands",
  permissionSmartLabel: "Smart auto-approve",
  permissionSmartDesc: "Auto-approve after 3 approvals; risky commands still ask",
  permissionFullShort: "Full access",
  permissionFullLabel: "Full access",
  permissionFullDesc: "Unrestricted local file access and auto-execution without prompts",
  permissionLearnMoreText: "Ask mode prompts Yes/No on every write or command. Smart mode auto-approves the same operation pattern after 3 approvals while keeping high-risk guards active. Full access removes workspace path limits and runs without asking.",
  permissionLabel: "Permission mode",
  toolsFullAccess: "Full access (unrestricted local files & auto-run)",
  smartTrustedPrefix: "Trusted",
  smartTrustedSuffix: "auto-approved patterns",
  resetSmartTrust: "Reset smart approvals",
  smartProgressPrefix: "Smart mode:",
  smartProgressSuffix: "approvals (auto-yes at 3)",
  highRiskApprovalHint: "High-risk operation detected; manual confirmation required",
  addContextTooltip: "Add files and more",
  addContextMenuTitle: "Add context",
  ctxFile: "Files",
  ctxFolder: "Folder",
  ctxMention: "Mention",
  ctxActions: "Actions",
  ctxBrowser: "Browser",
  ctxCloudDrive: "Cloud Drive",
  ctxSetUp: "Set up",
  mentionAddGroup: "Add",
  mentionFilesAndFolders: "Files & folders",
  mentionUseProject: "Work in project · Pick project",
  mentionGoalTitle: "Goal",
  mentionGoalDesc: "Set a persistent goal to pursue",
  mentionPlanTitle: "Plan mode",
  mentionPlanDesc: "Outline a plan before making edits",
  mentionSessionsGroup: "LFAA Chats",
  mentionSessionTag: "LFAA Chat",
  mentionPluginsGroup: "Plugins",
  mentionUnconnectedTag: "Not connected",
  mentionEmpty: "No matching context, chats, or plugins",
  ctxServiceUnavailable: "This extension is not connected yet. Local files, folders, goal/plan modes, and chat references are ready.",
  recordAudio: "Record Audio",
  stopRecording: "Stop Recording",
  cancelRunTooltip: "Cancel (Ctrl+D)",
  speechUnsupportedNotice: "Microphone recording is unavailable in this browser context.",
  speechErrorPrefix: "Voice input unavailable: ",
  speechLocalRecordingNotice: "Recording locally (offline mode). Click mic or press Ctrl+M to finish...",
  speechTranscribingNotice: "Transcribing locally...",
  speechNoResultNotice: "No clear speech detected. Please try speaking closer to the mic.",
  speechMicPermissionDenied: "Microphone permission was denied. Allow microphone access in browser settings.",
  speechMicNotFound: "No microphone input device was detected on this machine.",
  speechMicBusy: "The microphone is currently in use by another application.",
  speechNetworkFallbackFailed: "Online speech service unreachable and local offline recognition failed: ",
  dismissNoticeLabel: "Dismiss notice",
  libraryTitle: "Library & Assets",
  librarySubtitle: "Unified local vault for Agent memories, Agent-produced artifacts, and project assets.",
  libraryStoragePathLabel: "Storage directory:",
  manageStorageBtn: "Storage Settings",
  openStorageDirBtn: "Open Folder",
  librarySearchPlaceholder: "Search memories, artifacts, filenames, or tags...",
  libraryTabAll: "All",
  libraryTabArtifacts: "Artifacts",
  libraryTabAssets: "Assets",
  libraryTabMemories: "Memories",
  importAssetBtn: "Import File",
  newAssetNoteBtn: "New Asset Note",
  artifactBadge: "Artifact",
  assetBadge: "Asset",
  memoryBadge: "Memory",
  emptyLibraryHint: "No items match. Ask the Agent to produce an artifact or import local files here.",
  selectItemPreviewHint: "Select an artifact or asset on the left to preview its content and path.",
  copyContentBtn: "Copy",
  copiedNotice: "Copied",
  storageTitle: "Storage & Library Location",
  storageSubtitle: "Manage the disk location of Agent memories, outputs, and assets; chat sessions stay fixed in ~/.lfaa/sessions.",
  storageCurrentPath: "Active Library Directory (Migratable)",
  storageFixedSessionsLabel: "Chat Sessions Directory (Fixed to OS user, never moves with projects)",
  storageStatsTitle: "Local Vault Statistics",
  storageSessionsLabel: "Sessions",
  storageArtifactsLabel: "Artifacts",
  storageAssetsLabel: "Assets",
  storageMemoriesLabel: "Memories",
  storageTotalSizeLabel: "Total size",
  storageModeDefaultTitle: "Default location (Current OS user)",
  storageModeDefaultDesc: "Auto-detects the current OS user home folder and stores under .lfaa/data.",
  storageModeProjectTitle: "Project recommended (Follow project)",
  storageModeProjectDesc: "Auto-detects the active project root and stores under its data subfolder.",
  storageModeCustomTitle: "Custom directory",
  storageModeCustomDesc: "Pick or enter any folder; LFAA will create and migrate into its data subfolder.",
  storageCustomPlaceholder: "Enter or browse any folder path (a data subfolder will be created)",
  storageDetectingUserPath: "Detecting OS user folder...",
  storageDetectingProjectPath: "Detecting active project root...",
  storagePickFolderBtn: "Browse Folder",
  storageResolvedPreview: "Resolved target directory:",
  storageApplyMigrateBtn: "Apply & Migrate Losslessly",
  storageMigratingBtn: "Migrating & verifying...",
  storageMigrationDone: "Lossless migration verified:",
  reasoningSummary: "Reasoning",
  stepTimelineTitle: "Agent Loop Trace",
  contextTitle: "Agent Capabilities",
  brainLabel: "Brain (LLM)",
  toolsLabel: "Hands (Tools)",
  memoryLabel: "Memory",
  rulesLabel: "Rules",
  rulesLayersCountSuffix: "rules active",
  memoryCountSuffix: "memories",
  toolsReady: "Sandboxed to bound project directory",
  toolsUnbound: "No project directory bound",
  openAgentSettings: "Configure Models, Rules & Memory",
  settingsTitle: "Models, Rules & Memory",
  settingsSubtitle: "Manage Host-only LLM API credentials, hierarchical rules, and long-term memories.",
  tabModels: "LLM Profiles",
  tabRules: "Rules",
  tabMemory: "Memory",
  providerLabel: "Provider",
  profileNameLabel: "Profile Name",
  baseUrlLabel: "Base URL",
  modelIdLabel: "Model ID",
  apiKeyLabel: "API Key (Host-only)",
  apiKeyKeepPlaceholder: "Enter new key or leave blank to keep existing",
  saveProfile: "Save Profile",
  addProfile: "Add Profile",
  testConnection: "Test Connection",
  deleteProfile: "Delete",
  useProfile: "Use",
  activeBadge: "Active",
  systemRulesTitle: "System Rules (Immutable)",
  projectRulesTitle: "Project Rules (AGENTS.md / .lfaa/rules.md)",
  userRulesTitle: "User Global Rules",
  userRulesPlaceholder: "e.g., Always respond concisely; inspect tests before editing...",
  saveRules: "Save User Rules",
  savedNotice: "Saved",
  addMemoryPlaceholder: "Add a durable fact or preference to remember...",
  addMemory: "Save Memory",
  deleteMemory: "Delete",
  globalScope: "Global",
  projectScope: "Project",
  emptyMemories: "No long-term memories yet.",
  starterInspect: "Inspect the bound project structure and summarize key modules",
  starterMemory: "Remember that I prefer concise replies and strict TypeScript types",
  starterRules: "Explain active system rules, project rules, and tool boundaries",
};

/** 优先使用设置中的语言，未指定时按浏览器语言选择字典。 */
export function getChatLocale(): ChatLocaleMessages {
  const override = readLocaleOverride();
  if (override === "zh") return zh;
  if (override === "en") return en;
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")) {
    return zh;
  }
  return typeof navigator === "undefined" ? zh : en;
}
