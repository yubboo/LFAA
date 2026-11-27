// 设置中心「内置插件」页的中英文文案：只放用户需要看到的词，不写实现说明。
export interface InventoryMessages {
  title: string;
  description: string;
  search: string;
  sessionSection: string;
  sessionSubtitle: string;
  globalSection: string;
  globalSubtitle: string;
  modeLabel: string;
  empty: string;
  emptySearch: string;
  loadError: string;
  retry: string;
  reading: string;
  toggleEnable: string;
  toggleDisable: string;
  toggleFailed: string;
  moduleLabel: string;
  fromPreset: string;
  configuration: string;
  runtime: string;
  enabled: string;
  running: string;
  disabled: string;
  failed: string;
  pending: string;
  loading: string;
  unloading: string;
  unobserved: string;
  metadataError: string;
}

export const inventoryMessages: Record<"zh" | "en", InventoryMessages> = {
  zh: {
    title: "内置插件",
    description: "查看内置部署的插件列表",
    search: "搜索插件",
    sessionSection: "会话插件",
    sessionSubtitle: "由 Agent 预设按会话组成",
    globalSection: "全局插件",
    globalSubtitle: "系统与所有会话共用",
    modeLabel: "查看预设",
    empty: "暂无插件。",
    emptySearch: "没有匹配的插件。",
    loadError: "暂时无法读取插件清单。",
    retry: "重试",
    reading: "正在读取插件…",
    toggleEnable: "启用",
    toggleDisable: "停用",
    toggleFailed: "操作失败，请重试。",
    moduleLabel: "完整名称",
    fromPreset: "来自",
    configuration: "配置状态",
    runtime: "运行状态",
    enabled: "已启用",
    running: "运行中",
    disabled: "已停用",
    failed: "启动失败",
    pending: "等待依赖",
    loading: "加载中",
    unloading: "卸载中",
    unobserved: "未运行",
    metadataError: "包元信息错误：{error}",
  },
  en: {
    title: "Plugins",
    description: "Built-in plugins shipped with this app",
    search: "Search plugins",
    sessionSection: "Session plugins",
    sessionSubtitle: "Composed per session by agent presets",
    globalSection: "Global plugins",
    globalSubtitle: "Shared by the system and every session",
    modeLabel: "Preset",
    empty: "No plugins are available.",
    emptySearch: "No matching plugins.",
    loadError: "Plugins are temporarily unavailable.",
    retry: "Retry",
    reading: "Reading plugins…",
    toggleEnable: "Enable",
    toggleDisable: "Disable",
    toggleFailed: "That did not work. Try again.",
    moduleLabel: "Module",
    fromPreset: "From",
    configuration: "Configuration",
    runtime: "Status",
    enabled: "Enabled",
    running: "Running",
    disabled: "Disabled",
    failed: "Failed",
    pending: "Waiting for dependencies",
    loading: "Loading",
    unloading: "Unloading",
    unobserved: "Not running",
    metadataError: "Package metadata error: {error}",
  },
};