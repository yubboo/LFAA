/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-agent。
 * LFAA 适配：DSH 挂 workspace/session-activity 事件；LFAA 不引入该事件总线，改为导出纯判定函数，
 * 供会话归档逻辑在归档前查询 Agent 是否仍在运行。
 *
 * 文件：archive-admission.ts
 * 功能：会话归档准入——该 Agent 是否正处在一个回合中（含等待审批/回答）。
 * 作用：归档一个仍在跑的会话前，调用方应先取消其活动回合。
 */
import type { AgentStatus } from "./runtime-types.js";

/** 一个可查询运行状态的 Agent 句柄（最小接口）。 */
export interface ArchiveAdmissionAgent {
  readonly status: AgentStatus;
  cancel(cause: "user"): void;
}

/** Agent 是否处在一个回合中（running 即包含等待审批/回答）。 */
export function agentIsRunning(agent: ArchiveAdmissionAgent | undefined): boolean {
  return agent?.status === "running";
}

/**
 * 归档一个会话：若其 Agent 仍在运行，按用户停止的方式取消（丢弃排队输入）。
 * 不等待结算。
 */
export function admitArchive(agent: ArchiveAdmissionAgent | undefined): void {
  if (agent?.status === "running") agent.cancel("user");
}
