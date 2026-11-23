// @lfaa/plugins 浏览器端中英文界面文案字典。
import type { PluginRunStatus } from "@lfaa/plugins/contract";

/** 放宽为 string，避免中英字典的字面量类型互相不兼容。 */
export interface PluginsMessages {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  refresh: string;
  installedSection: string;
  catalogSection: string;
  sessionSection: string;
  globalSection: string;
  modeLabel: string;
  emptyInstalled: string;
  emptyCatalog: string;
  install: string;
  installedBadge: string;
  providedBadge: string;
  builtinBadge: string;
  builtinUnremovable: string;
  addTitle: string;
  addHint: string;
  addPlaceholder: string;
  addConfirm: string;
  addWorking: string;
  addCancel: string;
  addEntry: string;
  providedHint: string;
  enable: string;
  disable: string;
  uninstall: string;
  fork: string;
  forkUnavailable: string;
  edit: string;
  save: string;
  cancel: string;
  openDetail: string;
  moduleLabel: string;
  errorLabel: string;
  statusMap: Record<PluginRunStatus, string>;
  /** 每个破坏性或装载类操作的二次确认文案。 */
  confirm: Record<"install" | "enable" | "disable" | "uninstall", { title: string; description: string; confirm: string; working: string }>;
}

export const pluginsMessages: Record<"zh" | "en", PluginsMessages> = {
  zh: {
    title: "插件中心",
    subtitle: "插件由 Cordis Loader 真实装载与卸载，状态取自运行时而非记录。",
    searchPlaceholder: "搜索插件名称、描述或包名…",
    refresh: "刷新",
    installedSection: "已安装",
    catalogSection: "可安装（本仓插件包）",
    sessionSection: "会话插件",
    globalSection: "全局插件",
    modeLabel: "新会话默认模式",
    emptyInstalled: "尚未安装任何插件。从下方目录选择插件包安装后，再点击「启用」真正装载。",
    emptyCatalog: "没有匹配的插件包。",
    install: "安装",
    installedBadge: "已安装",
    providedBadge: "已装配",
    builtinBadge: "内置",
    builtinUnremovable: "内置插件随应用发布，只能停用，不能卸载。",
    addTitle: "添加插件",
    addHint: "输入 npm 包名、GitHub 仓库地址或本地目录绝对路径；安装完成后会立即启用。",
    addPlaceholder: "例如 @scope/plugin、github:owner/repo、C:\\\\plugins\\\\my-plugin",
    addConfirm: "安装",
    addWorking: "安装中…",
    addCancel: "取消安装",
    addEntry: "添加插件",
    providedHint: "该能力已由当前应用装配，无需也无法单独安装。",
    enable: "启用",
    disable: "停用",
    uninstall: "卸载",
    fork: "二创副本",
    forkUnavailable: "二创需要包级复制与依赖解析，尚未实现。",
    edit: "编辑清单",
    save: "保存",
    cancel: "取消",
    openDetail: "打开详情页",
    moduleLabel: "包名：",
    errorLabel: "错误：",
    statusMap: {
      disabled: "已停用",
      enabling: "启用中",
      running: "运行中",
      disabling: "停用中",
      error: "加载失败",
    },
    confirm: {
      install: {
        title: "安装插件",
        description: "确定安装「{name}」？安装完成后会立即启用并装载进当前运行时。",
        confirm: "安装",
        working: "正在安装",
      },
      enable: {
        title: "启用插件",
        description: "将把「{name}」装载进当前运行时，并注册它提供的工具与服务。",
        confirm: "启用",
        working: "正在装载",
      },
      disable: {
        title: "停用插件",
        description: "将卸载「{name}」并释放它注册的工具与服务，已安装记录会保留。",
        confirm: "停用",
        working: "正在停用",
      },
      uninstall: {
        title: "卸载插件",
        description: "将停用并删除「{name}」的记录与副本，此操作不可撤销。",
        confirm: "卸载",
        working: "正在卸载",
      },
    },
  },
  en: {
    title: "Plugins",
    subtitle: "Plugins are mounted and unmounted by the Cordis Loader; status comes from the runtime.",
    searchPlaceholder: "Search by name, description, or package…",
    refresh: "Refresh",
    installedSection: "Installed",
    catalogSection: "Available (repository packages)",
    sessionSection: "Session plugins",
    globalSection: "Global plugins",
    modeLabel: "Default for new chats",
    emptyInstalled: "Nothing installed yet. Install a package below, then press Enable to load it.",
    emptyCatalog: "No matching package.",
    install: "Install",
    installedBadge: "Installed",
    providedBadge: "Bundled",
    builtinBadge: "Builtin",
    builtinUnremovable: "Builtin plugins ship with the app: disable them, do not uninstall.",
    addTitle: "Add plugin",
    addHint: "Enter an npm package name, a GitHub repository URL, or an absolute local path. It is enabled right after installing.",
    addPlaceholder: "e.g. @scope/plugin, github:owner/repo, C:\\\\plugins\\\\my-plugin",
    addConfirm: "Install",
    addWorking: "Installing…",
    addCancel: "Cancel install",
    addEntry: "Add plugin",
    providedHint: "Already mounted by the current application; it cannot be installed separately.",
    enable: "Enable",
    disable: "Disable",
    uninstall: "Uninstall",
    fork: "Fork copy",
    forkUnavailable: "Forking needs package-level copying and dependency resolution; not implemented yet.",
    edit: "Edit manifest",
    save: "Save",
    cancel: "Cancel",
    openDetail: "Open view",
    moduleLabel: "Package: ",
    errorLabel: "Error: ",
    statusMap: {
      disabled: "Disabled",
      enabling: "Enabling",
      running: "Running",
      disabling: "Disabling",
      error: "Load failed",
    },
    confirm: {
      install: {
        title: "Install plugin",
        description: "Install “{name}”? It will be enabled and mounted into the running context right after installing.",
        confirm: "Install",
        working: "Installing",
      },
      enable: {
        title: "Enable plugin",
        description: "“{name}” will be mounted into the running context, registering its tools and services.",
        confirm: "Enable",
        working: "Loading",
      },
      disable: {
        title: "Disable plugin",
        description: "“{name}” will be unmounted and its tools and services released. The record is kept.",
        confirm: "Disable",
        working: "Stopping",
      },
      uninstall: {
        title: "Uninstall plugin",
        description: "“{name}” will be stopped and its record and copy deleted. This cannot be undone.",
        confirm: "Uninstall",
        working: "Uninstalling",
      },
    },
  },
};
