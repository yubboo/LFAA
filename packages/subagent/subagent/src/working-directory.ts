/** 功能：验证并规范化外部子 Agent 的工作目录。作用：只接受绝对、现存目录，禁止退回宿主 cwd。关联文件：subagent-claude-code、subagent-codex。 */
import { stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

export async function resolveSubagentWorkingDirectory(value: string | undefined): Promise<string> {
  if (typeof value !== "string" || !value.trim() || !isAbsolute(value)) {
    throw new Error("外部子 Agent 缺少 AgentGit Owner 提供的绝对工作目录，已拒绝启动。");
  }
  const workingDirectory = resolve(value);
  let directory;
  try {
    directory = await stat(workingDirectory);
  } catch {
    throw new Error("当前 Session 绑定的 Agent Git 工作目录不存在或不可访问，已拒绝启动。");
  }
  if (!directory.isDirectory()) throw new Error("当前 Session 绑定的 Agent Git 工作目录不是目录，已拒绝启动。");
  return workingDirectory;
}
