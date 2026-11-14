/**
 * 功能：提供设置页分类、导航及本地视图状态映射。
 * 作用：集中设置页面自身的路由和显示模型；不定义设置数据 schema、默认值或持久化服务。
 * 关联文件：SettingsPage.tsx、settings-menu-catalog.ts、Settings Owner。
 */
import type { AiExtension, UserSettings } from "lfaa-client-connection/src/api.js";
import type { WorkbenchIconName } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { getSettingsCenterMenu, SETTINGS_CENTER_MENUS, type SettingsMenuId } from "lfaa-util-values/src/settings-menu-catalog.js";

export type SectionId = SettingsMenuId | "configuration";
export type AccountSettingsSectionId = Extract<SectionId, "profile" | "security" | "account">;
export type PluginWorkspaceTab = "overview" | "catalog" | "knowledge" | "mcp" | "diagnostics";
export type StandalonePluginWorkspaceView = "all" | "applications" | "tools" | "skills" | "prompts" | "mcp" | "knowledge" | "diagnostics" | "experts";

export function resolveStandalonePluginWorkspaceView(view: StandalonePluginWorkspaceView): { tab: PluginWorkspaceTab; kind: AiExtension["kind"] | "all" } {
  switch (view) {
    case "all": return { tab: "catalog", kind: "all" };
    case "applications": return { tab: "overview", kind: "all" };
    case "tools": return { tab: "catalog", kind: "tool" };
    case "skills": return { tab: "catalog", kind: "skill" };
    case "prompts": return { tab: "catalog", kind: "prompt" };
    case "mcp": return { tab: "mcp", kind: "all" };
    case "knowledge": return { tab: "knowledge", kind: "all" };
    case "diagnostics": return { tab: "diagnostics", kind: "all" };
    case "experts": return { tab: "catalog", kind: "expert" };
  }
}

export const PLUGIN_WORKSPACE_TABS: Array<{ id: PluginWorkspaceTab; label: string }> = [
  { id: "overview", label: "总览" },
  { id: "catalog", label: "能力目录" },
  { id: "knowledge", label: "我的资料库" },
  { id: "mcp", label: "MCP 连接" },
  { id: "diagnostics", label: "运行诊断" }
];

export const ACCOUNT_SETTINGS_TABS: Array<{ id: AccountSettingsSectionId; label: string }> = [
  { id: "profile", label: "个人资料" },
  { id: "security", label: "安全" },
  { id: "account", label: "账号管理" }
];

export function isAccountSettingsSection(section: SectionId): section is AccountSettingsSectionId {
  return section === "profile" || section === "security" || section === "account";
}

export function getSettingsSectionSearchText(section: { id: string; title: string; group: string }): string {
  // 分类搜索词与 Agent 设置目录共用 settings-menu-catalog 的别名/工具搜索词，避免两套中文字典。
  const menu = getSettingsCenterMenu(section.id);
  const aliases = section.id === "account" ? "账户 个人资料 安全 账号管理" : "";
  const catalogTerms = [...(menu?.aliases ?? []), ...(menu?.toolSearchTerms ?? [])].join(" ");
  return `${section.title} ${section.group} ${aliases} ${catalogTerms}`.trim();
}

// 只在进入需要真实数据的分类时请求专属数据，避免首次打开设置就并发加载全部分类。
export const SETTINGS_DATA_SECTIONS = new Set<SectionId>(["appearance", "usage", "plugins", "hooks", "archived", "ai", "minecraft", "permissions", "workspace", "developer"]);

export const EXTENSION_CATEGORIES: Array<{ kind: AiExtension["kind"]; label: string; description: string; icon: WorkbenchIconName }> = [
  { kind: "agent", label: "Agent", description: "承担任务规划与执行的 Agent 配置。", icon: "spark" },
  { kind: "expert", label: "领域专家", description: "围绕特定领域提供专业分析和建议。", icon: "book" },
  { kind: "prompt", label: "提示词", description: "为 Agent 提供角色、边界和任务指引。", icon: "file" },
  { kind: "skill", label: "技能", description: "可复用的专业知识与工作流程。", icon: "book" },
  { kind: "tool", label: "工具", description: "供模型按任务选择并调用的执行能力。", icon: "tools" },
  { kind: "llm-provider", label: "模型提供方", description: "登记给 AI Runtime 使用的模型服务能力。", icon: "browser" }
];

const SETTINGS_SECTION_ICONS: Record<SettingsMenuId, WorkbenchIconName> = {
  general: "settings", notifications: "history", import: "file", profile: "user", security: "shield", appearance: "sun",
  wallpaperEngine: "sun", parental: "shield", trustedContacts: "user", voice: "spark", about: "refresh", personalization: "sun",
  mini: "bolt", canvas: "grid", shortcuts: "keyboard", usage: "bolt", account: "user", plugins: "grid", profilePlugins: "extension",
  computerControl: "tools", snapshots: "archive", browser: "browser", hooks: "review", connections: "tools",
  cloudPreferences: "browser", codeReview: "review", git: "refresh", environment: "terminal", worktrees: "folder",
  archived: "archive", ai: "spark", minecraft: "settings", permissions: "shield", workspace: "folder", developer: "terminal"
};

export const sections: Array<{ id: SectionId; title: string; group: string; icon: WorkbenchIconName }> = SETTINGS_CENTER_MENUS.map((section) => ({
  id: section.id,
  title: section.label,
  group: section.group,
  icon: SETTINGS_SECTION_ICONS[section.id]
}));

export const LFAA_CONFIGURATION_SECTION_IDS = new Set<SectionId>(["ai", "minecraft", "permissions", "workspace", "developer"]);
export const LFAA_CONFIGURATION_SECTIONS = sections.filter((section) => LFAA_CONFIGURATION_SECTION_IDS.has(section.id));
export const SETTINGS_NAV_GROUPS = [...new Set(sections.map((section) => section.group))];

const SETTINGS_ACTIVE_SECTION_STORAGE_KEY = "lfaa.settings.active-section.v1";
const SETTINGS_LEGACY_SCROLL_POSITION_STORAGE_KEY = "lfaa.settings.scroll-position.v1";
const SETTINGS_APPEARANCE_ADVANCED_STORAGE_KEY = "lfaa.settings.appearance-advanced-open.v1";
const SETTINGS_BACKGROUND_TARGET_STORAGE_KEY = "lfaa.settings.background-target.v1";
const SETTINGS_NAV_COLLAPSED_GROUPS_STORAGE_KEY = "lfaa.settings.navigation-collapsed-groups.v1";
export const SETTINGS_AUTOSAVE_DELAY_MS = 300;
export const SETTINGS_BACKGROUND_TARGETS = ["login", "appCenter", "steamcmd", "minecraft", "writing", "settings"] as const;
export type SettingsBackgroundTarget = typeof SETTINGS_BACKGROUND_TARGETS[number];

function isSettingsSection(value: string | null): value is SectionId {
  return value === "configuration" || sections.some((section) => section.id === value);
}

export function resolveSettingsSection(section: SectionId): SectionId {
  if (section === "configuration") return "workspace";
  if (section === "plugins") return "profilePlugins";
  return section;
}

export function settingsCategoryForSection(section: SectionId): keyof UserSettings | null {
  if (section === "general" || section === "notifications") return "general";
  if (section === "appearance") return "appearance";
  if (section === "shortcuts") return "shortcuts";
  if (section === "ai" || section === "voice") return "aiRuntime";
  if (section === "minecraft") return "minecraftRuntime";
  if (section === "permissions") return "permissions";
  if (section === "computerControl") return "computerControl";
  if (section === "browser") return "browserUse";
  if (section === "plugins" || section === "connections") return "plugins";
  if (section === "personalization") return "personalization";
  if (section === "git") return "git";
  if (section === "canvas") return "canvas";
  return null;
}

function settingsSectionStorageKey(userId: string): string {
  return `${SETTINGS_ACTIVE_SECTION_STORAGE_KEY}:${userId}`;
}

export function legacySettingsScrollPositionStorageKey(userId: string, section: SectionId): string {
  return `${SETTINGS_LEGACY_SCROLL_POSITION_STORAGE_KEY}:${encodeURIComponent(userId)}:${section}`;
}

export function settingsAppearanceAdvancedStorageKey(userId: string): string {
  return `${SETTINGS_APPEARANCE_ADVANCED_STORAGE_KEY}:${encodeURIComponent(userId)}`;
}

export function settingsBackgroundTargetStorageKey(userId: string): string {
  return `${SETTINGS_BACKGROUND_TARGET_STORAGE_KEY}:${encodeURIComponent(userId)}`;
}

export function settingsNavCollapsedGroupsStorageKey(userId: string): string {
  return `${SETTINGS_NAV_COLLAPSED_GROUPS_STORAGE_KEY}:${encodeURIComponent(userId)}`;
}

export function readExpandedSettingsGroups(userId: string): Set<string> {
  try {
    const stored = window.localStorage.getItem(settingsNavCollapsedGroupsStorageKey(userId));
    if (stored === null) return new Set(SETTINGS_NAV_GROUPS);
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return new Set(SETTINGS_NAV_GROUPS);
    const collapsedGroups = new Set(parsed.filter((group): group is string => typeof group === "string"));
    return new Set(SETTINGS_NAV_GROUPS.filter((group) => !collapsedGroups.has(group)));
  } catch {
    return new Set(SETTINGS_NAV_GROUPS);
  }
}

export function readSettingsAppearanceAdvancedOpen(userId: string): boolean {
  try {
    return window.localStorage.getItem(settingsAppearanceAdvancedStorageKey(userId)) === "true";
  } catch {
    return false;
  }
}

export function readSettingsBackgroundTarget(userId: string): SettingsBackgroundTarget {
  try {
    const target = window.localStorage.getItem(settingsBackgroundTargetStorageKey(userId));
    return SETTINGS_BACKGROUND_TARGETS.find((item) => item === target) ?? "login";
  } catch {
    return "login";
  }
}

export function getInitialSettingsSection(initialSection: SectionId | undefined, userId: string, standalonePluginWorkspace = false, standalonePluginSection: "plugins" | "wallpaperEngine" = "plugins"): SectionId {
  if (standalonePluginWorkspace) return standalonePluginSection;
  const querySection = new URLSearchParams(window.location.search).get("section");
  if (isSettingsSection(querySection) && querySection !== "connections" && querySection !== "wallpaperEngine") return resolveSettingsSection(querySection);
  if (initialSection && initialSection !== "connections" && initialSection !== "wallpaperEngine") return resolveSettingsSection(initialSection);

  try {
    const storedSection = window.localStorage.getItem(settingsSectionStorageKey(userId));
    if (isSettingsSection(storedSection) && storedSection !== "connections" && storedSection !== "wallpaperEngine") return resolveSettingsSection(storedSection);
  } catch {
    // 浏览器禁用本地存储时仍可通过 URL 保留当前分类。
  }
  return "general";
}

export function persistSettingsSection(section: SectionId, userId: string): void {
  try {
    window.localStorage.setItem(settingsSectionStorageKey(userId), section);
  } catch {
    // 分类不是账户业务数据；存储不可用时仍尝试将其保存在地址栏中。
  }

  try {
    const routeSection = section === "profilePlugins" ? "plugins" : section;
    const url = new URL(window.location.href);
    if (url.searchParams.get("section") === routeSection) return;
    url.searchParams.set("section", routeSection);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // URL 更新失败不影响设置分类切换。
  }
}
