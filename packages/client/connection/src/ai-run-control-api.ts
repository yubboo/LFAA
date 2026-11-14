/**
 * AI Run 状态控制与追加输入/回答请求。执行状态仍由 Agent Loop/Session Owner 管理。
 */
import { request } from "./http-client.js";
import type { AiMessage } from "./ai-session-api.js";



/** 显式停止后台 Agent；断开流式连接只结束订阅。 */
export function cancelAiRun(runId: string): Promise<unknown> { return request(`/ai/runs/${encodeURIComponent(runId)}/cancel`, { method: "POST" }); }


export type AiRunPauseState = "running" | "pausing" | "paused";


/** 请求当前 Run 在安全检查点暂停；正在执行的 Provider/工具操作会先完成。 */
export function pauseAiRun(runId: string): Promise<{ pauseState: AiRunPauseState }> {
  return request(`/ai/runs/${encodeURIComponent(runId)}/pause`, { method: "POST" });
}


/** 继续同一个 Run；不创建新的用户消息或运行。 */
export function resumeAiRun(runId: string): Promise<{ pauseState: AiRunPauseState }> {
  return request(`/ai/runs/${encodeURIComponent(runId)}/resume`, { method: "POST" });
}


export function appendAiRunInput(runId: string, content: string): Promise<{ mode: "queue" | "steer"; run: { id: string; message: AiMessage }; userMessage: AiMessage }> { return request(`/ai/runs/${encodeURIComponent(runId)}/input`, { method: "POST", body: JSON.stringify({ content }) }); }


/** 回答当前 Run 的模型澄清问题；答案作为原工具结果返回，不新增普通用户消息。 */
export function answerAiRunQuestion(runId: string, questionId: string, answer: string, skipped = false): Promise<{ mode: "answered" }> {
  return request(`/ai/runs/${encodeURIComponent(runId)}/answer`, { method: "POST", body: JSON.stringify({ questionId, answer, skipped }) });
}