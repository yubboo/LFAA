/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-tool-fs/src/session-cwd.ts。
 * 功能：从一次 Agent Run 上下文推导文件工具解析相对路径时使用的根目录与基准目录。
 * 作用：DSH 从 exec.agent.session.header.cwd 取会话 cwd；LFAA 对应 AiBusinessToolContext.workspaceProject.path。
 * 安全边界：存在工作区项目时把它作为强制根（containment），无工作区才退化为进程当前目录且不设强制根。
 * 关联文件：read-target.ts、sandbox.ts、index.ts。
 */
import type { AiBusinessToolContext } from "lfaa-tools/src/business-tools.js";

/** 一次文件工具调用的解析基准：root（强制边界）/ cwd（相对基准）/ signal（取消）。 */
export interface ResolveBasis {
  readonly root: string | undefined;
  readonly cwd: string | undefined;
  readonly signal: AbortSignal;
}

/** 由 Agent Run 上下文推导解析基准；非工作区调用返回 cwd=进程目录、root=undefined。 */
export function resolveBasis(context: AiBusinessToolContext): ResolveBasis {
  const projectPath = context.workspaceProject?.path;
  // 工作区项目存在时把它作为根：模型只能在项目目录内读写。
  if (projectPath) return { root: projectPath, cwd: projectPath, signal: context.signal };
  return { root: undefined, cwd: process.cwd(), signal: context.signal };
}
