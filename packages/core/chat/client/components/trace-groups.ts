// @lfaa/chat 留痕分组：把步骤按「思考 / 读取 / 搜索 / 命令 / 文件变更 / 其他」归并，供展开区成组展示。
import type { AgentStepItem } from "../chat-types";

/** 一个留痕分组：标题、动作行与是否含失败。 */
export interface TraceGroup {
  key: string;
  title: string;
  steps: AgentStepItem[];
  failed: boolean;
}

type GroupKind = "think" | "read" | "search" | "command" | "file" | "other";

const SEARCH_TOOLS = new Set(["glob", "grep", "search_files", "find_files"]);

function kindOf(step: AgentStepItem): GroupKind {
  if (step.phase === "think") return "think";
  if (step.fileChange) return "file";
  if (step.toolName === "run_command") return "command";
  if (step.toolName && SEARCH_TOOLS.has(step.toolName)) return "search";
  if (step.toolName === "read_file" || step.toolName === "list_dir") return "read";
  return "other";
}

const TITLES: Record<GroupKind, { zh: string; en: string }> = {
  think: { zh: "思考过程", en: "Reasoning" },
  read: { zh: "已读取文件", en: "Read files" },
  search: { zh: "已搜索", en: "Searched" },
  command: { zh: "运行命令", en: "Commands" },
  file: { zh: "文件变更", en: "File changes" },
  other: { zh: "其他动作", en: "Other actions" },
};

/** 按出现顺序归并分组，保留每组内步骤原始顺序与失败标记。 */
export function groupTrace(steps: readonly AgentStepItem[], isZh: boolean): TraceGroup[] {
  const order: GroupKind[] = [];
  const buckets = new Map<GroupKind, AgentStepItem[]>();
  for (const step of steps) {
    const kind = kindOf(step);
    if (!buckets.has(kind)) {
      buckets.set(kind, []);
      order.push(kind);
    }
    buckets.get(kind)?.push(step);
  }
  return order.map((kind) => {
    const items = buckets.get(kind) ?? [];
    return {
      key: kind,
      title: TITLES[kind][isZh ? "zh" : "en"],
      steps: items,
      failed: items.some((step) => step.status === "error"),
    };
  });
}
