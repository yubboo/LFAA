// 可安装插件目录：本仓已具备默认导出的插件包清单，以及包名到稳定记录 id 的规整规则。
import type { PluginCatalogItem, PluginManifest, PresetSummary } from "../../contract/index";

/** 可安装目录：本仓已具备默认导出的插件包，安装时直接按包名交给 Loader。 */
export const INSTALLABLE_PACKAGES: ReadonlyArray<{ moduleName: string; name: string; description: string }> = [
  { moduleName: "@lfaa/tools", name: "工具注册表", description: "文件读写、检索与命令执行等内置工具。" },
  { moduleName: "@lfaa/tool-todo", name: "任务清单", description: "让 AI 创建和更新任务待办清单。" },
  { moduleName: "@lfaa/web", name: "网页能力", description: "网页抓取 seam、HTTP 实现与 fetch_url 工具。" },
  { moduleName: "@lfaa/goal", name: "目标能力", description: "会话目标的持久化服务与新建/更新/查看工具。" },
  { moduleName: "@lfaa/timeout-policy", name: "工具超时策略", description: "为每次工具执行套统一超时，超时中止并给出可读提示。" },
  { moduleName: "@lfaa/spill-local", name: "长结果落盘", description: "超长工具输出写入本机文件，只回窗口与路径。" },
  { moduleName: "@lfaa/plan-mode", name: "计划模式", description: "先规划再执行：写与命令工具被拦截，只留只读探查。" },
  { moduleName: "@lfaa/fs-observation-policy", name: "写前必读", description: "改已存在文件前必须先读，避免盲改。" },
  { moduleName: "@lfaa/compaction", name: "上下文治理", description: "上下文压缩服务、工具结果精简与 /compact 命令。" },
  { moduleName: "@lfaa/system-prompt", name: "系统提示装配", description: "插件按顺序追加系统提示段落，Agent 统一合并。" },
  { moduleName: "@lfaa/sandbox", name: "安全边界", description: "沙箱契约、逐次执行策略与工具层本地后端。" },
  { moduleName: "@lfaa/tool-schedule", name: "定时任务", description: "登记一次性或重复任务，到期由工具领取。" },
  { moduleName: "@lfaa/message-feedback", name: "消息反馈", description: "记录对助手回复的赞/踩与备注。" },
  { moduleName: "@lfaa/attachment-local", name: "会话附件", description: "附件存本机，支持按会话列出与读取。" },
  { moduleName: "@lfaa/session-title", name: "会话标题", description: "启发式 / 模型双通道生成会话标题。" },
  { moduleName: "@lfaa/commands", name: "斜杠命令", description: "插件注册命令，输入栏发现并执行。" },
  { moduleName: "@lfaa/tool-media", name: "媒体生成", description: "用套餐生图模型生成图片并保存到工作区。" },
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
