/**
 * 文件：domain.ts
 * 功能：模型计时输入 → 内部规则的校验与归一；持久化任务 → 模型视图的渲染。
 * 作用：集中处理“恰好一个选择器”“标题/提示规范化”“时区合法”“间隔下限”等业务规则，
 *       让 tools.ts 只负责编排、store.ts 只负责持久化。
 * 边界：时区用 Intl.DateTimeFormat 探测合法性；不做任何业务派发。
 * 关联文件：packages/schedule/schedule/src/cron.ts、store.ts、types.ts、tools.ts。
 * 移植参考：DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）
 *          packages/schedule/schedule/src/domain.ts 的选择器与校验语义。
 */
import { MIN_EVERY_INTERVAL_SECONDS, ScheduleRuleError, parseWallClockTime } from "./cron.js";
import type { ScheduleTask } from "./store.js";
import type { ScheduleRule } from "./store.js";
import type { ScheduleToolError, ScheduleView, TimingSelectorInput } from "./types.js";

export const MAX_TITLE_LENGTH = 120;
export const REQUIRED_TITLE_MESSAGE = "任务标题为必填，且不超过 120 个字符。";

/** 带稳定错误码的领域输入错误（tools.ts 据此转成模型可见错误，不泄露内部异常）。 */
export class ScheduleInputError extends Error {
  constructor(readonly code: ScheduleToolError["code"], message: string) {
    super(message);
    this.name = "ScheduleInputError";
  }
}

/** 用 Intl 验证时区字符串是否合法（非法时区会抛 RangeError）。 */
export function assertTimeZone(timeZone: string): void {
  try {
    // 仅构造以触发非法时区 RangeError；不消费结果。
    void new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new ScheduleInputError("invalid_time_zone", `无效时区：${timeZone}`);
  }
}

/** 规范化标题；空或超长抛 ScheduleInputError。 */
export function normalizeTitle(title: string): string {
  const value = title.trim();
  if (value.length === 0) throw new ScheduleInputError("invalid_prompt", REQUIRED_TITLE_MESSAGE);
  if (value.length > MAX_TITLE_LENGTH) throw new ScheduleInputError("invalid_prompt", `标题最多 ${MAX_TITLE_LENGTH} 个字符。`);
  return value;
}

/** 规范化提示内容；空抛错。 */
export function normalizePrompt(prompt: string): string {
  const value = prompt.trim();
  if (value.length === 0) throw new ScheduleInputError("invalid_prompt", "提示内容不能为空。");
  return value;
}

/** 数一下选择器个数（after/at/every/daily/weekly/cron）。 */
function countSelectors(input: TimingSelectorInput): number {
  return [
    input.afterSeconds !== undefined,
    input.atMs !== undefined,
    input.everySeconds !== undefined,
    input.daily !== undefined,
    input.weekly !== undefined,
    input.cron !== undefined
  ].filter(Boolean).length;
}

/**
 * 把模型计时输入归一为内部 ScheduleRule。
 * @param input 模型选择器（恰好一个生效）
 * @param nowMs 创建/更新时刻（after 相对偏移在此刻展开）
 */
export function ruleFromSelector(input: TimingSelectorInput, nowMs: number): ScheduleRule {
  if (countSelectors(input) !== 1) {
    throw new ScheduleInputError("invalid_selector", "必须且只能提供一种计时方式：after_seconds、at、every_seconds、daily、weekly 或 cron。");
  }
  if (input.afterSeconds !== undefined) {
    if (!Number.isSafeInteger(input.afterSeconds) || input.afterSeconds <= 0) {
      throw new ScheduleInputError("invalid_rule", "after_seconds 必须为正整数（秒）。");
    }
    // after 展开为一次性 at。
    return { kind: "at", atMs: nowMs + input.afterSeconds * 1000 };
  }
  if (input.atMs !== undefined) {
    if (!Number.isFinite(input.atMs) || input.atMs <= 0) {
      throw new ScheduleInputError("invalid_rule", "at 时刻无效。");
    }
    return { kind: "at", atMs: input.atMs };
  }
  if (input.everySeconds !== undefined) {
    if (!Number.isSafeInteger(input.everySeconds)) {
      throw new ScheduleInputError("invalid_rule", "every_seconds 必须为安全整数。");
    }
    if (input.everySeconds < MIN_EVERY_INTERVAL_SECONDS) {
      throw new ScheduleInputError("frequency_too_high", `every_seconds 不得小于 ${MIN_EVERY_INTERVAL_SECONDS} 秒。`);
    }
    return { kind: "every", seconds: input.everySeconds };
  }
  if (input.daily !== undefined) {
    parseWallClockTime(input.daily.time);
    assertTimeZone(input.daily.timeZone);
    return { kind: "daily", time: input.daily.time, timeZone: input.daily.timeZone };
  }
  if (input.weekly !== undefined) {
    parseWallClockTime(input.weekly.time);
    assertTimeZone(input.weekly.timeZone);
    if (!Array.isArray(input.weekly.weekdays) || input.weekly.weekdays.length === 0) {
      throw new ScheduleInputError("invalid_selector", "weekly 至少选择一个星期（周一=1…周日=7）。");
    }
    for (const day of input.weekly.weekdays) {
      if (!Number.isInteger(day) || day < 1 || day > 7) {
        throw new ScheduleInputError("invalid_rule", `星期必须在 1（周一）到 7（周日）之间：${String(day)}`);
      }
    }
    return { kind: "weekly", time: input.weekly.time, weekdays: [...new Set(input.weekly.weekdays)], timeZone: input.weekly.timeZone };
  }
  if (input.cron !== undefined) {
    assertTimeZone(input.cron.timeZone);
    // 仅校验表达式可解析性。
    try {
      parseCronOrThrow(input.cron.expression);
    } catch (error) {
      if (error instanceof ScheduleRuleError) {
        throw new ScheduleInputError("invalid_rule", error.message);
      }
      throw error;
    }
    return { kind: "cron", expression: input.cron.expression, timeZone: input.cron.timeZone };
  }
  throw new ScheduleInputError("invalid_selector", "未识别的计时方式。");
}

// 延迟引入避免循环依赖：cron 解析在 cron.ts。
import { parseCronExpression as parseCronOrThrow } from "./cron.js";

/** 把内部任务渲染为模型可见视图。 */
export function viewFromTask(task: ScheduleTask, nowMs: number): ScheduleView {
  const base = {
    id: task.id,
    title: task.title,
    prompt: task.prompt,
    scheduledAt: new Date(task.nextFireAtMs).toISOString(),
    state: task.nextFireAtMs <= nowMs ? ("overdue" as const) : ("scheduled" as const)
  };
  switch (task.rule.kind) {
    case "at":
      return { ...base, kind: "at" };
    case "every":
      return { ...base, kind: "every", everySeconds: task.rule.seconds };
    case "daily":
      return { ...base, kind: "daily", time: task.rule.time, timeZone: task.rule.timeZone };
    case "weekly":
      return { ...base, kind: "weekly", time: task.rule.time, timeZone: task.rule.timeZone, weekdays: task.rule.weekdays };
    case "cron":
      return { ...base, kind: "cron", expression: task.rule.expression, timeZone: task.rule.timeZone };
  }
}

/** 把领域输入错误转成模型可见错误（其余异常一律收敛为 internal_error）。 */
export function toToolError(error: unknown): ScheduleToolError {
  if (error instanceof ScheduleInputError) return { code: error.code, message: error.message };
  return { code: "internal_error", message: "定时任务操作失败。" };
}
