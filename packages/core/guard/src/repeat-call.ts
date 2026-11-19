// 重复工具调用提醒：同一工具以完全相同的参数连续调用时，在阈值处生成建议性提醒，不阻断执行。
// 设计参考 DSH 的 guard/repeat-tool-reminder，但按 LFAA 的对话结构独立实现。

/** 连续重复的默认提醒阈值：温和提醒 → 详细提醒 → 强提醒。 */
export const REPEAT_THRESHOLDS: readonly number[] = [3, 5, 8];
/** 详细提醒里参数预览的最大字符数。 */
export const ARGUMENTS_PREVIEW_CHARS = 500;

export interface RepeatObservation {
  /** 当前连续重复次数。 */
  count: number;
  /** 本次命中的阈值；未命中时缺省。 */
  threshold?: number;
  /** 需要追加给模型的提醒文本；未命中时缺省。 */
  reminder?: string;
}

/** 深度按键排序，保证参数对象属性顺序不同也能识别为同一次调用。 */
function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) sorted[key] = sortJsonValue(record[key]);
    return sorted;
  }
  return value;
}

/** 规范化参数：解析成功时排序键，失败时保留原始字符串。 */
export function canonicalizeArguments(argumentsJson: string): string {
  try {
    return JSON.stringify(sortJsonValue(JSON.parse(argumentsJson)));
  } catch {
    return argumentsJson;
  }
}

function preview(canonical: string, cap: number): string {
  if (canonical.length <= cap) return canonical;
  return `${canonical.slice(0, cap)}…(+${canonical.length - cap} chars)`;
}

function gentleReminder(toolName: string, count: number): string {
  return `你正在用完全相同的参数连续调用「${toolName}」（已连续 ${count} 次），当前没有产生新的进展。`
    + "请先检查上一条工具结果，再决定：换一种做法、调整参数，或在证据足够时直接结束任务。";
}

function detailedReminder(toolName: string, count: number, canonical: string, cap: number): string {
  return "检测到重复工具调用，且没有取得新进展：\n"
    + `- 工具：${toolName}\n`
    + `- 连续次数：${count}\n`
    + `- 参数：${preview(canonical, cap)}\n`
    + "不要再用完全相同的参数调用该工具；请查看最新结果，改变方法或参数，或在信息足够时结束任务。";
}

/** 校验阈值：非空、整数、至少为 2、无重复，并按升序返回。 */
function normalizeThresholds(values: readonly number[]): number[] {
  if (values.length === 0) throw new Error("repeat-call: thresholds 不能为空");
  for (const value of values) {
    if (!Number.isInteger(value) || value < 2) throw new Error(`repeat-call: 非法阈值 ${value}`);
  }
  if (new Set(values).size !== values.length) throw new Error("repeat-call: thresholds 不能重复");
  return [...values].sort((a, b) => a - b);
}

/** 单个运行内的连续重复调用链；不同参数或不同工具会重置计数。 */
export class RepeatCallTracker {
  private readonly thresholds: number[];
  private readonly previewChars: number;
  private key: string | undefined;
  private count = 0;
  private fired = new Set<number>();

  constructor(thresholds: readonly number[] = REPEAT_THRESHOLDS, previewChars = ARGUMENTS_PREVIEW_CHARS) {
    this.thresholds = normalizeThresholds(thresholds);
    this.previewChars = Math.max(0, Math.floor(previewChars));
  }

  /** 记录一次工具调用；命中新阈值时返回提醒文本。 */
  observe(toolName: string, argumentsJson: string): RepeatObservation {
    const canonical = canonicalizeArguments(argumentsJson);
    const key = `${toolName}\u0000${canonical}`;
    if (key !== this.key) {
      this.key = key;
      this.count = 0;
      this.fired.clear();
    }
    this.count += 1;
    const threshold = this.thresholds.find((value) => value === this.count && !this.fired.has(value));
    if (threshold === undefined) return { count: this.count };
    this.fired.add(threshold);
    const first = this.thresholds[0]!;
    return {
      count: this.count,
      threshold,
      reminder: threshold === first
        ? gentleReminder(toolName, this.count)
        : detailedReminder(toolName, this.count, canonical, this.previewChars),
    };
  }
}
