// 可安装插件目录：本仓已具备默认导出的插件包清单，以及包名到稳定记录 id 的规整规则。
import type { PluginCatalogItem, PluginManifest, PresetSummary } from "../contract/index";

/** 可安装目录：本仓已具备默认导出的插件包，安装时直接按包名交给 Loader。 */
export const INSTALLABLE_PACKAGES: ReadonlyArray<{ moduleName: string; name: string; description: string }> = [
  { moduleName: "@lfaa/tools", name: "工具注册表", description: "文件读写、检索与命令执行等内置工具。" },
  { moduleName: "@lfaa/tool-todo", name: "任务清单", description: "让 AI 创建和更新任务待办清单。" },
  { moduleName: "@lfaa/tool-web", name: "网页读取", description: "抓取公开网页并转成可读正文。" },
  { moduleName: "@lfaa/rules", name: "规则装配", description: "系统规则、项目规则与用户规则的提示词拼装。" },
  { moduleName: "@lfaa/llm", name: "模型接入", description: "多提供商大模型接入与流式推理。" },
  { moduleName: "@lfaa/memory", name: "记忆", description: "会话轨迹持久化与长期记忆检索。" },
  { moduleName: "@lfaa/subagent", name: "子智能体", description: "进程内子智能体与并发协作。" },
  { moduleName: "@lfaa/jobs", name: "后台任务", description: "会话隔离的后台命令与日志流。" },
  { moduleName: "@lfaa/browser", name: "内置浏览器", description: "本机 Edge/Chrome 驱动的浏览器工具。" },
  { moduleName: "@lfaa/agent", name: "Agent 循环", description: "Think → Act → Check 任务闭环。" },
  { moduleName: "@lfaa/shell", name: "Shell 运行时", description: "进程执行、取消与输出收集。" },
  { moduleName: "@lfaa/skills", name: "技能中心", description: "按需加载技能与 Git 安装。" },
  { moduleName: "@lfaa/plugins", name: "插件管理", description: "插件安装、启停与二创。" },
  { moduleName: "@lfaa/workspace", name: "工作区", description: "本地项目增删改与路径绑定。" },
  { moduleName: "@lfaa/sections", name: "自定义分区", description: "侧栏分区持久化与编辑。" },
  { moduleName: "@lfaa/chat", name: "聊天工作台", description: "会话、流式输出与工作台界面。" },
];

/** 把包名或路径规整成稳定的记录 id。 */
export function toRecordId(moduleName: string): string {
  return moduleName
    .replace(/^@lfaa\//u, "")
    .replace(/[^a-z0-9-]+/giu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase();
}

/** 把目录条目映射成前端契约的目录项，补上安装与装配状态。 */
export function buildCatalog(
  provided: ReadonlySet<string>,
  installedIds: ReadonlySet<string>,
): PluginCatalogItem[] {
  return INSTALLABLE_PACKAGES.map((item) => ({
    moduleName: item.moduleName,
    // 内置插件来自本仓 packages（bundle 清单）：只能启停，不存在安装/卸载。
    kind: "builtin" as const,
    provided: provided.has(item.moduleName),
    manifest: {
      id: toRecordId(item.moduleName),
      name: item.name,
      version: "0.1.0",
      description: item.description,
      entryType: "builtin-local",
      compatibleLfaa: ">=0.1.0",
      capabilities: { tools: [], skills: [], views: [] },
    } satisfies PluginManifest,
    installed: installedIds.has(toRecordId(item.moduleName)),
  }));
}

/** 插件模式预设：由 bundle 提供，插件包不反向依赖 bundle。 */
export interface PluginPresetDefinition {
  id: string;
  name: Record<"zh" | "en", string>;
  description: Record<"zh" | "en", string>;
  sessionModules: readonly string[];
  unavailable?: boolean;
}

/** 把预设定义汇总为前端契约的摘要列表。 */
export function summaryOfPresets(presets: readonly PluginPresetDefinition[]): PresetSummary[] {
  return presets.map((preset) => ({
    id: preset.id,
    name: preset.name.zh,
    nameEn: preset.name.en,
    description: preset.description.zh,
    descriptionEn: preset.description.en,
    ...(preset.unavailable ? { unavailable: true } : {}),
    modules: [...preset.sessionModules],
  }));
}
