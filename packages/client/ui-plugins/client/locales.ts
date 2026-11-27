// @lfaa/plugins 浏览器端中英文界面文案字典：插件中心只管扩展插件的安装与启停，内置插件在设置中心。
import type { PluginRunStatus } from "@lfaa/plugins/contract";

/** 放宽为 string，避免中英字典的字面量类型互相不兼容。 */
export interface PluginsMessages {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  refresh: string;
  installedSection: string;
  emptyInstalled: string;
  emptyInstalledSearch: string;
  builtinBadge: string;
  addTitle: string;
  addHint: string;
  addPlaceholder: string;
  addConfirm: string;
  addWorking: string;
  addCancel: string;
  addEntry: string;
  enable: string;
  disable: string;
  uninstall: string;
  fork: string;
  forkUnavailable: string;
  edit: string;
  save: string;
  cancel: string;
  moduleLabel: string;
  errorLabel: string;
  statusMap: Record<PluginRunStatus, string>;
  /** 每个破坏性或装载类操作的二次确认文案。 */
  confirm: Record<"install" | "enable" | "disable" | "uninstall", { title: string; description: string; confirm: string; working: string }>;
}

export const pluginsMessages: Record<"zh" | "en", PluginsMessages> = {
  zh: {
    title: "插件中心",
    subtitle: "安装、启停与管理扩展插件。",
    searchPlaceholder: "搜索扩展插件名称、描述或包名…",
    refresh: "刷新",
    installedSection: "已安装的插件",
    emptyInstalled: "还没有安装扩展插件。点「添加插件」安装 npm 包、Git 仓库或本地目录。",
    emptyInstalledSearch: "没有匹配的插件。",
    builtinBadge: "内置",
    addTitle: "添加插件",
    addHint: "输入 npm 包名、GitHub 仓库地址或本地目录绝对路径；安装完成后会立即启用。",
    addPlaceholder: "例如 @scope/plugin、github:owner/repo、C:\\\\plugins\\\\my-plugin",
    addConfirm: "安装",
    addWorking: "安装中…",
    addCancel: "取消安装",
    addEntry: "添加插件",
    enable: "启用",
    disable: "停用",
    uninstall: "卸载",
    fork: "二创副本",
    forkUnavailable: "二创需要包级复制与依赖解析，尚未实现。",
    edit: "编辑清单",
    save: "保存",
    cancel: "取消",
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
    subtitle: "Install, toggle, and manage extension plugins.",
    searchPlaceholder: "Search by name, description, or package…",
    refresh: "Refresh",
    installedSection: "Installed plugins",
    emptyInstalled: "No extension plugins yet. Use Add plugin to install an npm package, Git repository, or local directory.",
    emptyInstalledSearch: "No matching plugins.",
    builtinBadge: "Builtin",
    addTitle: "Add plugin",
    addHint: "Enter an npm package name, a GitHub repository URL, or an absolute local path. It is enabled right after installing.",
    addPlaceholder: "e.g. @scope/plugin, github:owner/repo, C:\\\\plugins\\\\my-plugin",
    addConfirm: "Install",
    addWorking: "Installing…",
    addCancel: "Cancel install",
    addEntry: "Add plugin",
    enable: "Enable",
    disable: "Disable",
    uninstall: "Uninstall",
    fork: "Fork copy",
    forkUnavailable: "Forking needs package-level copying and dependency resolution; not implemented yet.",
    edit: "Edit manifest",
    save: "Save",
    cancel: "Cancel",
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