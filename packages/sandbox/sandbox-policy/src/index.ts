/**
 * 功能：定义一次进程执行使用的文件沙箱策略合同。
 * 作用：校验调用方已从权威设置与授权 Owner 得到的策略，并按目标主机语义验证工作区路径；本包不授予权限、不提供默认策略。
 * 关联文件：packages/sandbox/sandbox/src/index.ts、未来的 Daemon/本机沙箱提供方与 Agent 执行适配器。
 */

export const SANDBOX_MODES = ["read-only", "workspace-write", "danger-full-access"] as const;
export type SandboxMode = (typeof SANDBOX_MODES)[number];
export type SandboxPlatform = "win32" | "linux" | "darwin";
export type SandboxTarget = { kind: "local" } | { kind: "node"; nodeId: string };

/** 一次已由调用方确定的策略；策略本身不是工具授权或用户审批凭证。 */
export interface SandboxExecutionPolicy {
  readonly mode: SandboxMode;
  readonly platform: SandboxPlatform;
  readonly target: SandboxTarget;
  readonly workspaceRoot: string;
  readonly sessionId?: string;
}

/** 构造策略所需的显式输入；不提供隐式工作目录或权限模式回退。 */
export interface SandboxPolicyInput extends SandboxExecutionPolicy {}

export class SandboxPolicyError extends Error {
  readonly code = "SANDBOX_POLICY_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "SandboxPolicyError";
  }
}

function isAbsoluteForPlatform(platform: SandboxPlatform, path: string): boolean {
  if (platform === "win32") {
    return /^(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)/u.test(path);
  }
  return path.startsWith("/");
}

function assertSafeText(value: string, label: string): void {
  if (!value || value.includes("\0")) throw new SandboxPolicyError(`${label} 不能为空或包含空字符。`);
}

/** 校验并冻结调用方从 Owner 得到的逐次执行策略。 */
export function createSandboxExecutionPolicy(input: SandboxPolicyInput): SandboxExecutionPolicy {
  if (!SANDBOX_MODES.includes(input.mode)) throw new SandboxPolicyError("沙箱模式无效。");
  if (!(input.platform === "win32" || input.platform === "linux" || input.platform === "darwin")) {
    throw new SandboxPolicyError("执行目标的平台无效。");
  }
  assertSafeText(input.workspaceRoot, "工作区根目录");
  if (!isAbsoluteForPlatform(input.platform, input.workspaceRoot)) {
    throw new SandboxPolicyError("工作区根目录必须是目标执行主机上的绝对路径。");
  }
  if (input.target.kind === "node") assertSafeText(input.target.nodeId, "目标节点 ID");
  else if (input.target.kind !== "local") throw new SandboxPolicyError("执行目标无效。");
  if (input.sessionId !== undefined) assertSafeText(input.sessionId, "会话 ID");

  return Object.freeze({
    mode: input.mode,
    platform: input.platform,
    target: Object.freeze({ ...input.target }),
    workspaceRoot: input.workspaceRoot,
    ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId })
  });
}

/** 比较沙箱范围是否变宽；此比较不能替代权限 Owner 的审批。 */
export function isSandboxPolicyWidening(current: SandboxMode, requested: SandboxMode): boolean {
  return SANDBOX_MODES.indexOf(requested) > SANDBOX_MODES.indexOf(current);
}
