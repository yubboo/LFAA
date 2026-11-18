// 管理 @lfaa/chat 浏览器端界面中英文文案字典。
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
  composerPlaceholder: "输入你的任务或问题（Enter 发送，Shift+Enter 换行）",
  send: "发送",
  stop: "停止",
  newChat: "新聊天",
  deleteChat: "删除会话",
  noProjectBound: "未绑定项目",
  bindProject: "绑定项目",
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
  approveAction: "批准执行",
  rejectAction: "拒绝",
  approvalRequiredTitle: "高风险操作需要你的确认",
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
  composerPlaceholder: "Ask anything or assign a task (Enter to send, Shift+Enter for newline)",
  send: "Send",
  stop: "Stop",
  newChat: "New chat",
  deleteChat: "Delete chat",
  noProjectBound: "No project",
  bindProject: "Project",
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
  approveAction: "Approve",
  rejectAction: "Deny",
  approvalRequiredTitle: "Action requires your confirmation",
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

export function getChatLocale(): ChatLocaleMessages {
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")) {
    return zh;
  }
  return typeof navigator === "undefined" ? zh : en;
}
