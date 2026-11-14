/** AI Work Host Task 查询与取消适配；执行和进程生命周期由 Host Task Owner 持有。 */
import { request } from "./http-client.js";
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";

export interface AiHostTask {
  id: string; nodeId: string; appId: ApplicationId; shell: string; workingDirectory: string; status: "queued" | "running" | "succeeded" | "failed"; message: string; createdAt: string;
  command?: string; startedAt?: string | null; finishedAt?: string | null; outputSequence?: number;
  result?: { stdout: string; stderr: string; exitCode: number | null; timedOut: boolean; outputTruncated: boolean; cancelled?: boolean } | null;
  cancelRequested?: boolean;
}
export function loadAiHostTasks(signal?: AbortSignal): Promise<{ tasks: AiHostTask[] }> { return request("/ai/host-tasks", signal ? { signal } : {}); }
export function loadAiHostTask(taskId: string, signal?: AbortSignal): Promise<{ task: AiHostTask }> { return request(`/ai/host-tasks/${encodeURIComponent(taskId)}`, signal ? { signal } : {}); }
export function cancelAiHostTask(taskId: string): Promise<{ task: AiHostTask }> { return request(`/ai/host-tasks/${encodeURIComponent(taskId)}/cancel`, { method: "POST" }); }
