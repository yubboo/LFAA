/**
 * 文件：types.ts
 * 功能：定时任务的领域视图、工具错误与计时选择器类型。
 * 作用：把持久化行（store.ts）与模型可见视图（tools.ts）解耦；模型工具只消费 ScheduleView，
 *       不直接暴露内部 rule_json。
 * 关联文件：packages/schedule/schedule/src/domain.ts、store.ts、tools.ts。
 * 移植参考：DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）
 *          packages/schedule/schedule/src/types.ts 的视图/错误语义。
 */

/** 模型创建时可选择的计时输入（恰好一个生效）。 */
export interface TimingSelectorInput {
  readonly afterSeconds?: number;
  readonly atMs?: number;
  readonly everySeconds?: number;
  readonly daily?: { readonly time: string; readonly timeZone: string };
  readonly weekly?: { readonly time: string; readonly weekdays: readonly number[]; readonly timeZone: string };
  readonly cron?: { readonly expression: string; readonly timeZone: string };
}

/** 模型可见的任务视图（无损 JSON，便于直接作为工具输出）。 */
export interface ScheduleView {
  readonly id: string;
  readonly title: string;
  readonly prompt: string;
  readonly kind: "after" | "at" | "every" | "daily" | "weekly" | "cron";
  /** 下一次触发时刻的 ISO 字符串。 */
  readonly scheduledAt: string;
  readonly state: "scheduled" | "overdue";
  readonly everySeconds?: number;
  readonly time?: string;
  readonly timeZone?: string;
  readonly weekdays?: readonly number[];
  readonly expression?: string;
}

/** 稳定的工具错误码（与 DSH 对齐，避免把内部错误细节漏给模型）。 */
export type ScheduleToolErrorCode =
  | "invalid_prompt"
  | "invalid_selector"
  | "invalid_rule"
  | "invalid_time_zone"
  | "frequency_too_high"
  | "schedule_not_found"
  | "internal_error";

export interface ScheduleToolError {
  readonly code: ScheduleToolErrorCode;
  readonly message: string;
}

export type ScheduleCreateResult = ScheduleView | ScheduleToolError;
export type ScheduleListResult = readonly ScheduleView[] | ScheduleToolError;

export interface ScheduleDeleteResult {
  readonly id: string;
  readonly deleted: boolean;
  readonly code?: "schedule_not_found";
}

export type ScheduleUpdateResult =
  | ScheduleView
  | (ScheduleToolError & { readonly updated: false; readonly code?: "schedule_not_found" });

/** 一次投递（到点触发）的历史记录。 */
export interface ScheduleDeliveryRecord {
  readonly id: string;
  readonly taskId: string;
  readonly firedAtMs: number;
  readonly status: "success" | "failed";
  readonly error: string | null;
  /** 投递后由会话分片回填的消息 id（暂未接线时为 null）。 */
  readonly messageId: string | null;
}
