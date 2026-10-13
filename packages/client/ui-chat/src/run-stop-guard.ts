/** 功能：判断当前回复的运行控件是否已完成 Run ID 交接。
 * 作用：避免新消息提交后按钮瞬间切换造成暂停/继续请求落到其他 Run。
 * 关联文件：AiWorkChat.tsx、apps/cli/tests/ai-run-stop-guard.test.mjs。
 */
export const AI_RUN_CONTROL_GUARD_MS = 600;

export function canControlAiRun(runId: string | null, startedAt: number | null, now: number): boolean {
  return Boolean(runId) && startedAt !== null && now - startedAt >= AI_RUN_CONTROL_GUARD_MS;
}
