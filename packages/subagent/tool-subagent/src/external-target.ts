/** 功能：验证外部 Coding Agent 的执行前置条件。作用：确认本机执行器、所需的 LFAA 动作授权桥、沙箱设置与 Session 仓库绑定。 */
import { isAbsolute, resolve } from "node:path";

export interface ExternalSubagentTargetInput {
  driver: string;
  localHostExecution: boolean;
  permissionBridgeAvailable: boolean;
  executionSandboxMode: string;
  sessionRepository: { id: string; path: string; title: string } | null;
  runRepository: { id: string; path: string; title: string } | null;
}

export interface ExternalSubagentTarget {
  repositoryId: string;
  title: string;
  workingDirectory: string;
}

export function resolveExternalSubagentTarget(input: ExternalSubagentTargetInput): ExternalSubagentTarget {
  if (!input.localHostExecution) throw new Error("外部 Coding Agent 只支持 LFAA 本机 Host；当前运行位置未接入本机执行器。");
  if (input.driver !== "claude-code" || !input.permissionBridgeAvailable) throw new Error("此外部 Coding Agent 尚未接入 LFAA Permission Owner 的逐动作授权桥，已拒绝启动。");
  if (input.executionSandboxMode !== "danger-full-access") {
    throw new Error("Claude Agent SDK 尚未接入 LFAA 沙箱；当前 aiRuntime.executionSandboxMode 不是 danger-full-access，已拒绝启动。");
  }
  const repository = input.sessionRepository;
  if (!repository || !input.runRepository || repository.id !== input.runRepository.id || repository.path !== input.runRepository.path) {
    throw new Error("外部 Coding Agent 必须绑定当前 Session 的 AgentGit 本机仓库；绑定缺失或运行期间已变化，已拒绝启动。");
  }
  if (!repository.id.trim() || !repository.title.trim() || !repository.path.trim() || !isAbsolute(repository.path)) {
    throw new Error("当前 Session 的 AgentGit 仓库目标无效，已拒绝启动。");
  }
  return { repositoryId: repository.id, title: repository.title, workingDirectory: resolve(repository.path) };
}
