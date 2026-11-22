// @lfaa/sandbox-local 本地后端：在工具层按模式判定写入与命令，明确标注不具备进程级强制。
import { type Context } from "@deepseek-ai/cordis";
import { isAbsolute, relative, resolve } from "node:path";
import { analyzeCommand } from "./command-policy";
import {
  SandboxEnforcer,
  type SandboxDecision,
  type SandboxEnforcement,
  type SandboxMode,
  type SandboxPolicy,
} from "../seam";

/** 判断目标路径是否位于任一允许根之内（按解析后的绝对路径比较，拒绝路径穿越）。 */
function isInsideRoots(targetPath: string, roots: readonly string[]): boolean {
  if (!isAbsolute(targetPath)) return false;
  const resolved = resolve(targetPath);
  return roots.some((root) => {
    const resolvedRoot = resolve(root);
    const rel = relative(resolvedRoot, resolved);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  });
}

/**
 * 工具层后端。它只能拦住本进程内的工具调用（写入、命令），
 * 不能约束绕过工具的进程行为；`enforcement` 如实报告为 `policy`。
 */
export class LocalSandboxEnforcer extends SandboxEnforcer {
  readonly enforcement: SandboxEnforcement = "policy";

  constructor(ctx: Context) {
    super(ctx);
  }

  checkWrite(targetPath: string, policy: SandboxPolicy): SandboxDecision {
    if (policy.mode === "danger-full-access") return { allowed: true };
    if (policy.mode === "read-only") {
      return { allowed: false, reason: "当前为只读模式，禁止写入文件。" };
    }
    if (!isAbsolute(targetPath)) {
      return { allowed: false, reason: `写入路径必须是绝对路径：${targetPath}` };
    }
    if (!isInsideRoots(targetPath, policy.workspaceRoots)) {
      return { allowed: false, reason: `写入超出工作区范围：${targetPath}` };
    }
    return { allowed: true };
  }

  checkCommand(command: string, policy: SandboxPolicy): SandboxDecision {
    if (policy.mode === "read-only") {
      // 无法证明命令是只读的，就一律拒绝——fail-closed。
      return { allowed: false, reason: "当前为只读模式，禁止执行命令。请切换到工作区可写模式。" };
    }
    const verdict = analyzeCommand(command, {
      mode: policy.mode,
      workspaceRoots: policy.workspaceRoots,
    });
    return verdict.allowed ? { allowed: true } : { allowed: false, reason: verdict.reason };
  }
}

/** 把配置里的字符串收窄为合法模式，非法值按最严格的只读处理。 */
export function normalizeMode(value: unknown): SandboxMode {
  return value === "workspace-write" || value === "danger-full-access" || value === "read-only"
    ? value
    : "read-only";
}

/** 注册工具层沙箱后端。 */
export function sandboxLocalPlugin(ctx: Context): void {
  new LocalSandboxEnforcer(ctx);
}

export default sandboxLocalPlugin;
