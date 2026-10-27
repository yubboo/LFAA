import type { SettingsCategory } from "./settings-contract.js";

export type SettingsMenuAccess = "settings" | "settings-and-tools" | "tools" | "read-only" | "user-input" | "partial" | "unavailable";

export interface SettingsCenterMenuDefinition {
  id: string;
  label: string;
  group: string;
  aliases?: readonly string[];
  settingsCategory?: SettingsCategory;
  access: SettingsMenuAccess;
  description: string;
  toolSearchTerms?: readonly string[];
  statusLabel?: string;
}

/** 设置中心菜单语义、设置分类和接入边界的共享只读目录，供 Client 与 Agent 同源读取。 */
export const SETTINGS_CENTER_MENUS = [
  { id: "general", label: "常规", group: "个人", settingsCategory: "general", access: "settings", description: "账户常规偏好由 Settings Owner 保存。" },
  { id: "notifications", label: "通知", group: "个人", settingsCategory: "general", access: "settings", description: "账户通知偏好由 Settings Owner 保存。" },
  { id: "import", label: "导入", group: "个人", access: "settings-and-tools", description: "导出或预览 LFAA 账户资料归档；恢复前选择设置、记忆与会话范围，权限、凭据、插件连接和本机路径不会导入。", toolSearchTerms: ["账户资料导入", "账户资料导出", "设置备份恢复", "会话记忆恢复", "快照预览"] },
  { id: "profile", label: "个人资料", group: "个人", access: "read-only", description: "仅展示当前认证账户的个人资料；敏感身份数据不进入通用设置写入。", toolSearchTerms: ["个人资料", "当前账户资料", "账户身份"] },
  { id: "security", label: "安全", group: "个人", access: "user-input", description: "密码、恢复密钥和通行密钥需要用户在安全表单中直接输入或确认，Agent 不接收秘密值。" },
  { id: "appearance", label: "外观", group: "个人", settingsCategory: "appearance", access: "settings", aliases: ["背景图片", "壁纸", "主题", "颜色", "字号", "字体"], description: "主题、背景、字体、字号、对比度、遮罩、模糊与动效由 Settings Owner 保存。" },
  { id: "wallpaperEngine", label: "壁纸引擎", group: "个人", access: "tools", description: "扩展提供的壁纸引擎设置；先查询当前运行时已登记的 Owner 工具。", toolSearchTerms: ["壁纸引擎", "动态壁纸"] },
  { id: "parental", label: "家长控制", group: "个人", access: "settings-and-tools", description: "管理员为普通成员账户管理每周 Agent 使用时段和每日时长；Agent 执行链会实时执行限制。", toolSearchTerms: ["家长控制", "Agent 使用时长", "每日使用时长", "使用时段", "账户使用限制"] },
  { id: "trustedContacts", label: "受信任联系人", group: "个人", access: "partial", description: "通过当前 LFAA 本机的双向邀请建立单向恢复委托；Agent 可读取联系人、撤销关系并在统一权限模式下批准精确的联系人恢复请求。邀请码、恢复码和新密码由用户直接在界面输入，不能交给 Agent。", toolSearchTerms: ["受信任联系人", "恢复联系人", "批准账户恢复", "撤销受信任关系"], statusLabel: "邀请码与恢复凭据由用户保管" },
  { id: "voice", label: "语音", group: "个人", settingsCategory: "ai-runtime", access: "settings", description: "语音输入和回复播报开关由 AI Runtime 设置保存。" },
  { id: "about", label: "关于与更新", group: "个人", access: "tools", description: "版本和更新状态由当前 Host 提供；执行前查询已登记的版本或更新 Owner 工具。", toolSearchTerms: ["版本", "检查更新", "应用更新"] },
  { id: "personalization", label: "个性化", group: "个人", settingsCategory: "personalization", access: "settings-and-tools", aliases: ["记忆"], description: "记忆开关由 Settings Owner 保存；记忆内容只使用对应账户记忆 Owner 能力。", toolSearchTerms: ["个性化记忆", "会话记忆"] },
  { id: "mini", label: "Mini 与虚拟宠物", group: "个人", settingsCategory: "mini", access: "settings-and-tools", description: "管理桌面 Mini 窗口与虚拟伙伴外观；窗口只由已装配的 Electron Host 打开，Web Host 可管理账户偏好但不伪称拥有原生窗口。", toolSearchTerms: ["Mini 窗口", "虚拟宠物", "迷你窗口", "桌面伙伴"] },
  { id: "canvas", label: "画布", group: "个人", settingsCategory: "canvas", access: "settings", aliases: ["画布设置", "网格", "小地图", "吸附"], description: "画布默认打开模式、网格样式、拖动吸附、小地图与 Agent 面板默认展开由 Settings Owner 按账户保存；图片/视频生成模型继续使用“AI 与模型”设置，不在此复制。", toolSearchTerms: ["画布设置", "画布默认模式", "网格样式", "拖动吸附", "小地图", "Agent 面板"] },
  { id: "shortcuts", label: "键盘快捷键", group: "个人", settingsCategory: "shortcuts", access: "settings", description: "键盘快捷键偏好由 Settings Owner 保存。" },
  { id: "usage", label: "使用情况和计费", group: "个人", access: "read-only", description: "仅展示当前账户可读取的用量数据；Agent 不执行计费或购买操作。", aliases: ["用量", "Token", "费用"], toolSearchTerms: ["账户用量", "Token 统计", "计费摘要"] },
  { id: "account", label: "账号", group: "个人", access: "tools", description: "账户管理受当前账户角色与认证 Owner 限制；先查询实际可用的账户 Owner 工具。", toolSearchTerms: ["账户管理", "用户管理"] },
  { id: "plugins", label: "AI 扩展与 MCP", group: "集成", settingsCategory: "plugins", access: "settings-and-tools", description: "安全偏好由 Settings Owner 保存；扩展、Skill 和 MCP 操作由实际登记的专属 Owner 工具执行。", toolSearchTerms: ["插件", "扩展", "Skill", "MCP"] },
  { id: "profilePlugins", label: "插件", group: "集成", access: "tools", description: "扩展目录和运行操作由已登记的插件或运行时 Owner 工具执行。", toolSearchTerms: ["插件", "扩展", "能力目录", "运行模块"] },
  { id: "computerControl", label: "电脑操控", group: "集成", settingsCategory: "computer-control", access: "settings-and-tools", description: "电脑操控主开关使用能力 Owner；开关不会替代单项工具的权限审批。", toolSearchTerms: ["电脑操控", "桌面交互"] },
  { id: "snapshots", label: "应用快照", group: "集成", access: "settings-and-tools", description: "保存、预览、导出、恢复和删除账户资料快照，包含可移植设置、会话记忆与公开对话文本。", toolSearchTerms: ["应用快照", "创建账户快照", "恢复账户快照", "快照列表"] },
  { id: "browser", label: "浏览器", group: "集成", settingsCategory: "browser-use", access: "settings-and-tools", description: "浏览器偏好由 Settings Owner 保存；页面、历史、凭据和下载等操作由 Browser Owner/Host 执行。", toolSearchTerms: ["浏览器", "Browser Owner", "Browser Use"] },
  { id: "hooks", label: "钩子", group: "编码", access: "tools", description: "当前运行组合中的 AI Runtime 生命周期钩子由受信任插件注册；设置页与 Agent 可读取真实登记状态，钩子代码仍由对应插件 Owner 管理。", toolSearchTerms: ["AI Runtime Hooks", "运行时钩子", "生命周期钩子"] },
  { id: "connections", label: "MCP 连接", group: "集成", settingsCategory: "plugins", access: "tools", description: "MCP 连接配置由连接 Owner 管理；通用设置工具不读取命令、参数或秘密。", toolSearchTerms: ["MCP 连接", "MCP 服务"] },
  { id: "cloudPreferences", label: "偏好存储与共享", group: "编码", access: "tools", description: "查看账户偏好在当前 LFAA 控制端的数据目录中的保存状态和共享范围；不同控制端之间不会自动同步。", toolSearchTerms: ["本地存储", "自托管", "偏好存储", "账户设置保存位置", "LFAA 控制端数据目录"] },
  { id: "codeReview", label: "代码审查", group: "编码", access: "tools", description: "小鱼 Agent 通过当前会话绑定的 Git Owner 读取真实项目差异并进行只读审查；没有可用仓库或差异时必须说明边界。", toolSearchTerms: ["代码审查", "审查当前项目改动", "Git 差异", "project_file_operation"] },
  { id: "git", label: "Git", group: "编码", settingsCategory: "git", access: "settings-and-tools", description: "分支名前缀由 Settings Owner 保存；Git 工作区操作由 Git Owner 工具执行。", toolSearchTerms: ["Git", "分支", "Worktree"] },
  { id: "environment", label: "环境", group: "编码", settingsCategory: "general", access: "partial", description: "本机未绑定项目时，空任务目录继承 Workspace Owner 的默认工作区；填写 general.taskFolder 可覆盖。实际环境扫描需要当前 Host 已登记的节点工具。", toolSearchTerms: ["默认任务文件夹", "项目操作目录", "运行环境", "环境扫描", "Daemon 节点"], statusLabel: "Daemon 节点待接入" },
  { id: "worktrees", label: "Worktrees", group: "编码", access: "tools", description: "隔离工作树由 Git Worktree Owner 管理；执行前查询当前 Host 提供的工具。", toolSearchTerms: ["Git Worktree", "隔离工作树"] },
  { id: "archived", label: "已归档的聊天", group: "已归档", access: "tools", description: "聊天归档操作由 Session Owner 管理；查询并使用当前登记的会话工具。", toolSearchTerms: ["会话归档", "聊天归档", "Session"] },
  { id: "ai", label: "AI 与模型", group: "LFAA 配置", settingsCategory: "ai-runtime", access: "settings-and-tools", description: "模型运行偏好由 Settings Owner 保存；账户、Provider 与凭据由各自 AI/凭据 Owner 管理。", toolSearchTerms: ["AI Provider", "模型账户", "模型路由"] },
  { id: "minecraft", label: "Minecraft 配置", group: "LFAA 配置", settingsCategory: "minecraft-runtime", access: "settings-and-tools", description: "Minecraft 默认值由 Settings Owner 保存；节点、实例和服务配置由 Minecraft Owner 管理。", toolSearchTerms: ["Minecraft 配置", "Minecraft 节点", "Minecraft 实例"] },
  { id: "permissions", label: "用户与权限", group: "LFAA 配置", settingsCategory: "permissions", access: "settings-and-tools", description: "权限模式永远由用户本人控制；Agent 只能读取并按该模式执行，待审批与记忆授权由 Permission Owner 管理。", toolSearchTerms: ["权限模式", "待审批", "记忆授权"] },
  { id: "workspace", label: "项目与存储", group: "LFAA 配置", access: "tools", description: "项目与数据目录由 Storage/Project Owner 管理；必须使用目标账户、Host 和节点的真实路径能力。", toolSearchTerms: ["项目存储", "数据目录", "导入导出", "项目文件"] },
  { id: "developer", label: "开发者", group: "LFAA 配置", access: "read-only", description: "展示当前客户端、控制端和节点诊断；Agent 只能查询本次运行实际提供的状态工具。", toolSearchTerms: ["开发者状态", "服务诊断", "连接状态"] }
] as const satisfies readonly SettingsCenterMenuDefinition[];

export type SettingsMenuId = (typeof SETTINGS_CENTER_MENUS)[number]["id"];

export function getSettingsCenterMenu(id: string): SettingsCenterMenuDefinition | undefined {
  return SETTINGS_CENTER_MENUS.find(menu => menu.id === id);
}
