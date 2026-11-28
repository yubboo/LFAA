// 输入栏「技能 / 插件」内联搜索数据与纯逻辑：目录缓存、常用记录、分组筛选与关键词高亮拆分。
// 关联：packages/client/ui-chat/client/composer/ComposerCapabilityPanel.tsx；运行环境：浏览器与 Node 测试。

export type CapabilityMode = "skill" | "plugin" | "add";

export interface CapabilitySkillItem {
  id: string;
  name: string;
  description: string;
  source?: string;
}

export interface CapabilityPluginItem {
  name: string;
  title?: string;
  description?: string;
  enabled?: boolean;
  kind?: string;
}

export type CapabilityActionId =
  | "manage-skills"
  | "plan"
  | "goal"
  | "canvas"
  | "add-plugin"
  | "manage-plugins"
  | "pick-project"
  | "pick-file"
  | "pick-folder"
  | "pick-media"
  | "trigger-mention"
  | "trigger-slash"
  | "open-browser"
  | "switch-skill";

export interface CapabilityEntry {
  key: string;
  id: string;
  kind: "action" | "skill" | "plugin";
  title: string;
  description: string;
  actionId?: CapabilityActionId;
  skillId?: string;
  pluginName?: string;
}

export interface CapabilitySection {
  id: string;
  label: string;
  items: CapabilityEntry[];
}

export interface HighlightPart {
  text: string;
  match: boolean;
}

const FREQUENT_STORAGE_KEY = "lfaa-composer-frequent-capabilities-v1";
const MAX_FREQUENT = 3;

let cachedSkills: CapabilitySkillItem[] | null = null;
let cachedPlugins: CapabilityPluginItem[] | null = null;

/** 拉取已启用技能列表（短期缓存，供输入栏零延迟展开）。 */
export async function fetchEnabledSkills(force = false): Promise<CapabilitySkillItem[]> {
  if (!force && cachedSkills) return cachedSkills;
  try {
    const res = await fetch("/api/skills?includeDisabled=false");
    if (!res.ok) return cachedSkills ?? [];
    const data = (await res.json()) as { skills?: CapabilitySkillItem[] };
    const list = Array.isArray(data.skills) ? data.skills : [];
    cachedSkills = list;
    return list;
  } catch {
    return cachedSkills ?? [];
  }
}

/** 拉取用户真实可用的插件与连接器（仅包含已连接的 MCP/CLI 连接器与用户安装的外部插件，严禁混入系统内置模块）。 */
export async function fetchInstalledPlugins(force = false): Promise<CapabilityPluginItem[]> {
  if (!force && cachedPlugins) return cachedPlugins;
  try {
    const [connectorsRes, pluginsRes] = await Promise.all([
      fetch("/api/connectors").catch(() => null),
      fetch("/api/plugins").catch(() => null),
    ]);
    const list: CapabilityPluginItem[] = [];
    const seen = new Set<string>();

    if (connectorsRes?.ok) {
      const data = (await connectorsRes.json().catch(() => null)) as {
        connectors?: Array<{ id?: string; name?: string; description?: string; enabled?: boolean; kind?: string }>;
      } | null;
      for (const item of Array.isArray(data?.connectors) ? data.connectors : []) {
        if (!item?.id || !item.name || item.enabled === false) continue;
        const key = `connector:${item.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({
          name: key,
          title: item.name,
          description: item.description || "",
          enabled: true,
          kind: item.kind || "connector",
        });
      }
    }

    if (pluginsRes?.ok) {
      const data = (await pluginsRes.json().catch(() => null)) as {
        installed?: Array<{
          moduleName?: string;
          enabled?: boolean;
          kind?: string;
          manifest?: { name?: string; description?: string };
        }>;
      } | null;
      for (const item of Array.isArray(data?.installed) ? data.installed : []) {
        // 系统内置模块（kind !== "external"）属于软件自身架构，不作为用户可调用插件列出。
        if (!item?.moduleName || item.enabled === false || item.kind !== "external") continue;
        if (seen.has(item.moduleName)) continue;
        seen.add(item.moduleName);
        list.push({
          name: item.moduleName,
          title: item.manifest?.name || item.moduleName,
          description: item.manifest?.description || "",
          enabled: true,
          kind: "external",
        });
      }
    }

    cachedPlugins = list;
    return list;
  } catch {
    return cachedPlugins ?? [];
  }
}

/** 读取输入栏最近使用的技能/插件/快捷功能 id 列表。 */
export function readFrequentCapabilityIds(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(FREQUENT_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** 记录最近使用的能力项，置顶并保留最近 12 条。 */
export function recordFrequentCapability(id: string): string[] {
  const next = [id, ...readFrequentCapabilityIds().filter((item) => item !== id)].slice(0, 12);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(FREQUENT_STORAGE_KEY, JSON.stringify(next));
    } catch { /* 忽略无痕模式存储限制 */ }
  }
  return next;
}

/** 将文本按关键字拆分为普通与命中高亮片段（大小写不敏感）。 */
export function splitHighlightParts(text: string, query: string): HighlightPart[] {
  const needle = query.trim();
  if (!needle || !text) return [{ text, match: false }];
  const lowerText = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const parts: HighlightPart[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const hit = lowerText.indexOf(lowerNeedle, cursor);
    if (hit < 0) {
      parts.push({ text: text.slice(cursor), match: false });
      break;
    }
    if (hit > cursor) parts.push({ text: text.slice(cursor, hit), match: false });
    parts.push({ text: text.slice(hit, hit + needle.length), match: true });
    cursor = hit + needle.length;
  }
  return parts;
}

function buildQuickActions(isZh: boolean): CapabilityEntry[] {
  return [
    {
      key: "action:manage-skills",
      id: "action:manage-skills",
      kind: "action",
      actionId: "manage-skills",
      title: isZh ? "技能管理" : "Manage skills",
      description: isZh ? "查看、启用或配置全部技能" : "View, enable, or configure skills",
    },
    {
      key: "action:plan",
      id: "action:plan",
      kind: "action",
      actionId: "plan",
      title: isZh ? "计划" : "Plan",
      description: isZh ? "描述你的任务，执行前会先输出计划" : "Outline a step-by-step plan before execution",
    },
    {
      key: "action:goal",
      id: "action:goal",
      kind: "action",
      actionId: "goal",
      title: isZh ? "目标" : "Goal",
      description: isZh ? "描述你的目标，成果定义越清晰效果越好" : "Set a persistent goal and keep verifying until done",
    },
    {
      key: "action:canvas",
      id: "action:canvas",
      kind: "action",
      actionId: "canvas",
      title: isZh ? "打开画布" : "Open canvas",
      description: isZh ? "在无限画布中自由创建图片与视频" : "Create images and videos on the infinite canvas",
    },
  ];
}

function matchesQuery(entry: CapabilityEntry, needle: string): boolean {
  return entry.title.toLowerCase().includes(needle)
    || entry.description.toLowerCase().includes(needle);
}

/** 根据当前面板模式（技能 / 插件 / 添加上下文）与搜索词生成分组列表与扁平导航列表。 */
export function buildCapabilitySections(
  mode: CapabilityMode,
  input: {
    skills: readonly CapabilitySkillItem[];
    plugins: readonly CapabilityPluginItem[];
    frequentIds: readonly string[];
    query: string;
    isZh: boolean;
    canPickProject?: boolean;
    canOpenMedia?: boolean;
    canOpenBrowser?: boolean;
  },
): { sections: CapabilitySection[]; flatEntries: CapabilityEntry[] } {
  const { skills, plugins, frequentIds, query, isZh, canPickProject, canOpenMedia, canOpenBrowser } = input;
  const needle = query.trim().toLowerCase();

  const skillEntries: CapabilityEntry[] = skills.map((item) => ({
    key: `skill:${item.id}`,
    id: `skill:${item.id}`,
    kind: "skill",
    skillId: item.id,
    title: item.name,
    description: item.description || "",
  }));

  const pluginEntries: CapabilityEntry[] = plugins
    .filter((item) => item.enabled !== false)
    .map((item) => ({
      key: `plugin:${item.name}`,
      id: `plugin:${item.name}`,
      kind: "plugin",
      pluginName: item.name,
      title: item.title || item.name,
      description: item.description || "",
    }));

  if (mode === "add") {
    const contextActions: CapabilityEntry[] = [
      ...(canPickProject ? [{
        key: "action:pick-project",
        id: "action:pick-project",
        kind: "action" as const,
        actionId: "pick-project" as const,
        title: isZh ? "选择项目" : "Select project",
        description: isZh ? "为当前会话绑定工作区项目" : "Bind a workspace project",
      }] : []),
      {
        key: "action:pick-file",
        id: "action:pick-file",
        kind: "action",
        actionId: "pick-file",
        title: isZh ? "文件" : "File",
        description: isZh ? "从本地添加文件到上下文" : "Attach local files",
      },
      {
        key: "action:pick-folder",
        id: "action:pick-folder",
        kind: "action",
        actionId: "pick-folder",
        title: isZh ? "文件夹" : "Folder",
        description: isZh ? "附加整个文件夹目录结构" : "Attach a folder",
      },
      ...(canOpenMedia ? [{
        key: "action:pick-media",
        id: "action:pick-media",
        kind: "action" as const,
        actionId: "pick-media" as const,
        title: isZh ? "图片" : "Images",
        description: isZh ? "从资料库选取已生成的素材" : "Pick from media library",
      }] : []),
      {
        key: "action:trigger-mention",
        id: "action:trigger-mention",
        kind: "action",
        actionId: "trigger-mention",
        title: isZh ? "提及 @" : "Mention @",
        description: isZh ? "引用历史对话或项目上下文" : "Reference chats or context",
      },
      {
        key: "action:trigger-slash",
        id: "action:trigger-slash",
        kind: "action",
        actionId: "trigger-slash",
        title: isZh ? "操作 /" : "Actions /",
        description: isZh ? "输入斜杠快捷命令" : "Run slash commands",
      },
      {
        key: "action:goal",
        id: "action:goal",
        kind: "action",
        actionId: "goal",
        title: isZh ? "目标" : "Goal",
        description: isZh ? "设置要持续追求的目标" : "Persistent goal",
      },
      {
        key: "action:plan",
        id: "action:plan",
        kind: "action",
        actionId: "plan",
        title: isZh ? "计划模式" : "Plan mode",
        description: isZh ? "开启计划模式" : "Plan before acting",
      },
      {
        key: "action:canvas",
        id: "action:canvas",
        kind: "action",
        actionId: "canvas",
        title: isZh ? "打开画布" : "Open canvas",
        description: isZh ? "无限画布自由创作" : "Infinite canvas",
      },
      ...(canOpenBrowser ? [{
        key: "action:open-browser",
        id: "action:open-browser",
        kind: "action" as const,
        actionId: "open-browser" as const,
        title: isZh ? "浏览器" : "Browser",
        description: isZh ? "打开内置浏览器面板" : "Open in-app browser",
      }] : []),
    ];

    const capabilityShortcuts: CapabilityEntry[] = [
      {
        key: "action:switch-skill",
        id: "action:switch-skill",
        kind: "action",
        actionId: "switch-skill",
        title: isZh ? "选择技能" : "Select skill",
        description: isZh ? "搜索并挂载本轮技能" : "Search enabled skills",
      },
      ...pluginEntries,
      {
        key: "action:add-plugin",
        id: "action:add-plugin",
        kind: "action",
        actionId: "add-plugin",
        title: isZh ? "添加插件" : "Add plugin",
        description: "",
      },
    ];

    if (needle) {
      const matched = [...contextActions, ...capabilityShortcuts].filter((entry) => matchesQuery(entry, needle));
      const sections: CapabilitySection[] = matched.length > 0
        ? [{ id: "search", label: isZh ? `匹配结果 (${matched.length})` : `Matches (${matched.length})`, items: matched }]
        : [];
      return { sections, flatEntries: matched };
    }

    const sections: CapabilitySection[] = [
      { id: "add-context", label: isZh ? "添加上下文" : "Add context", items: contextActions },
      { id: "add-plugins", label: isZh ? "插件与技能" : "Plugins & Skills", items: capabilityShortcuts },
    ];
    return { sections, flatEntries: sections.flatMap((section) => section.items) };
  }

  if (mode === "skill") {
    const actions = buildQuickActions(isZh);
    if (needle) {
      const matched = [...actions, ...skillEntries].filter((entry) => matchesQuery(entry, needle));
      const sections: CapabilitySection[] = matched.length > 0
        ? [{ id: "search", label: isZh ? `匹配结果 (${matched.length})` : `Matches (${matched.length})`, items: matched }]
        : [];
      return { sections, flatEntries: matched };
    }

    const poolById = new Map<string, CapabilityEntry>([...actions, ...skillEntries].map((item) => [item.id, item]));
    const frequentItems = frequentIds
      .map((id) => poolById.get(id))
      .filter((item): item is CapabilityEntry => Boolean(item))
      .slice(0, MAX_FREQUENT)
      .map((item) => ({ ...item, key: `freq:${item.id}` }));

    const sections: CapabilitySection[] = [];
    if (frequentItems.length > 0) {
      sections.push({
        id: "frequent",
        label: isZh ? `常用 (${frequentItems.length})` : `Recent (${frequentItems.length})`,
        items: frequentItems,
      });
    }
    sections.push({
      id: "actions",
      label: isZh ? `快捷功能 (${actions.length})` : `Quick actions (${actions.length})`,
      items: actions,
    });
    if (skillEntries.length > 0) {
      sections.push({
        id: "skills",
        label: isZh ? `技能 (${skillEntries.length})` : `Skills (${skillEntries.length})`,
        items: skillEntries,
      });
    }
    return { sections, flatEntries: sections.flatMap((section) => section.items) };
  }

  // 插件模式：仅展示用户已连接的连接器与外部插件，底部常驻「添加插件」「管理插件」入口。
  const pluginActions: CapabilityEntry[] = [
    {
      key: "action:add-plugin",
      id: "action:add-plugin",
      kind: "action",
      actionId: "add-plugin",
      title: isZh ? "添加插件" : "Add plugin",
      description: "",
    },
    {
      key: "action:manage-plugins",
      id: "action:manage-plugins",
      kind: "action",
      actionId: "manage-plugins",
      title: isZh ? "管理插件" : "Manage plugins",
      description: "",
    },
  ];

  if (needle) {
    const matched = [...pluginEntries, ...pluginActions].filter((entry) => matchesQuery(entry, needle));
    const sections: CapabilitySection[] = matched.length > 0
      ? [{ id: "search", label: isZh ? `匹配插件 (${matched.length})` : `Matching plugins (${matched.length})`, items: matched }]
      : [];
    return { sections, flatEntries: matched };
  }

  const pluginById = new Map<string, CapabilityEntry>(pluginEntries.map((item) => [item.id, item]));
  const frequentPlugins = frequentIds
    .map((id) => pluginById.get(id))
    .filter((item): item is CapabilityEntry => Boolean(item))
    .slice(0, MAX_FREQUENT)
    .map((item) => ({ ...item, key: `freq:${item.id}` }));

  const sections: CapabilitySection[] = [];
  if (frequentPlugins.length > 0) {
    sections.push({
      id: "frequent",
      label: isZh ? `常用 (${frequentPlugins.length})` : `Recent (${frequentPlugins.length})`,
      items: frequentPlugins,
    });
  }
  if (pluginEntries.length > 0) {
    sections.push({
      id: "plugins",
      label: isZh ? `已连接插件 (${pluginEntries.length})` : `Connected plugins (${pluginEntries.length})`,
      items: pluginEntries,
    });
  }
  sections.push({
    id: "plugin-actions",
    label: "",
    items: pluginActions,
  });
  return { sections, flatEntries: sections.flatMap((section) => section.items) };
}
