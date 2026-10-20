/**
 * 功能：导出 Agent 本机 Git Host 的受限操作合同。
 * 作用：Control Plane 只调用固定 Git 操作；具体参数化执行由 git-workspace.mjs 承担。
 * 不负责：Daemon 调度、账户与凭据持久化或任意 Git 命令。
 */
export { executeGitWorkspace, readGitRemoteUrl, resolveGitProjectDirectory, resolveGitWorkspaceDirectory } from "./git-workspace.mjs";
