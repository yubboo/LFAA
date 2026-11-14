/** AI Work 员工目录与活动 Run 只读投影。 */
import { request } from "./http-client.js";
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";

export interface AiOfficeEmployee {
  id: string;
  name: string;
  description: string;
  applicationIds: ApplicationId[];
}

export interface AiOfficeRun {
  id: string;
  sessionId: string;
  appId: ApplicationId;
  parentRunId: string | null;
  employeeId: string;
  label: string;
  task: string;
  status: "queued" | "streaming";
  pauseState: "running" | "pausing" | "paused";
  startedAt: string;
  source: "agent-loop" | "external-subagent";
  driver: string | null;
  activities: Array<{ kind: string; title: string; status: string; startedAt: string; completedAt: string | null }>;
}

export interface AiOfficeSnapshot {
  employees: AiOfficeEmployee[];
  runs: AiOfficeRun[];
  truncated: boolean;
}

/** 读取当前账户的真实员工目录与活动 Run；可在页面隐藏或卸载时取消。 */
export function loadAiOffice(signal?: AbortSignal): Promise<AiOfficeSnapshot> {
  return request<AiOfficeSnapshot>("/ai/office", signal ? { signal } : {});
}
