/**
 * 功能：定义一次进程执行使用的文件与网络沙箱策略合同。
 * 作用：校验调用方已从权威设置与授权 Owner 得到的策略，并按目标主机语义验证工作区路径；本包不授予权限、不提供默认策略。
 * 关联文件：packages/sandbox/sandbox/src/index.ts、未来的 Daemon/本机沙箱提供方与 Agent 执行适配器。
 */
import { isIP } from "node:net";
import { posix as posixPath, win32 as win32Path } from "node:path";
import { EXECUTION_SANDBOX_MODES, type ExecutionSandboxMode } from "lfaa-util-values/src/sandbox-contract.js";

export const SANDBOX_MODES = EXECUTION_SANDBOX_MODES;
export type SandboxMode = ExecutionSandboxMode;
export type SandboxPlatform = "win32" | "linux" | "darwin";
export type SandboxTarget = { kind: "local" } | { kind: "node"; nodeId: string };
export type SandboxNetworkPolicy =
  | { readonly mode: "none" }
  | { readonly mode: "allowlist"; readonly destinations: readonly { readonly host: string; readonly port: number }[] }
  | { readonly mode: "unrestricted" };

/** 一次已由调用方确定的策略；策略本身不是工具授权或用户审批凭证。 */
export interface SandboxExecutionPolicy {
  readonly mode: SandboxMode;
  /** 网络隔离是独立于文件限制的合同；无网络是受限模式默认值。 */
  readonly networkPolicy: SandboxNetworkPolicy;
  readonly platform: SandboxPlatform;
  readonly target: SandboxTarget;
  readonly workspaceRoot: string;
  /** 当前命令目录；由执行 Owner 提供，平台 Host 必须再次检查其位于 workspaceRoot 内。 */
  readonly workingDirectory?: string;
  readonly sessionId?: string;
}

/** 构造策略所需的显式输入；不提供隐式工作目录或权限模式回退。 */
export interface SandboxPolicyInput extends Omit<SandboxExecutionPolicy, "networkPolicy"> {
  readonly networkPolicy?: SandboxNetworkPolicy;
}

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

function normalizeNetworkPolicy(policy: SandboxNetworkPolicy | undefined, mode: SandboxMode): SandboxNetworkPolicy {
  const requested = policy ?? { mode: mode === "danger-full-access" ? "unrestricted" : "none" };
  if (requested.mode === "none" || requested.mode === "unrestricted") return Object.freeze({ mode: requested.mode });
  if (requested.mode !== "allowlist" || !Array.isArray(requested.destinations) || requested.destinations.length === 0 || requested.destinations.length > 32) {
    throw new SandboxPolicyError("网络 allowlist 必须包含 1 至 32 个精确主机和端口。");
  }
  const destinations = requested.destinations.map(destination => {
    const host = destination?.host;
    const port = destination?.port;
    if (typeof host !== "string" || host.length > 253 || host !== host.trim()) {
      throw new SandboxPolicyError("网络 allowlist 主机名无效；只接受精确 DNS 主机名。");
    }
    const normalized = host.toLowerCase();
    const labels = normalized.split(".");
    if (isIP(normalized) !== 0 || labels.length < 2 || labels.some(label => label.length < 1 || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label))) {
      throw new SandboxPolicyError("网络 allowlist 主机名必须是精确 ASCII DNS 名称，不接受通配符、IP 地址或尾点。");
    }
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new SandboxPolicyError("网络 allowlist 端口必须是 1 至 65535 的整数。");
    return Object.freeze({ host: normalized, port });
  });
  destinations.sort((left, right) => (left.host < right.host ? -1 : left.host > right.host ? 1 : 0) || left.port - right.port);
  const keys = destinations.map(({ host, port }) => `${host}:${port}`);
  if (new Set(keys).size !== destinations.length) throw new SandboxPolicyError("网络 allowlist 不得包含重复主机和端口。");
  return Object.freeze({ mode: "allowlist", destinations: Object.freeze(destinations) });
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
  if (input.workingDirectory !== undefined) {
    assertSafeText(input.workingDirectory, "命令工作目录");
    if (!isAbsoluteForPlatform(input.platform, input.workingDirectory)) {
      throw new SandboxPolicyError("命令工作目录必须是目标执行主机上的绝对路径。");
    }
    const pathApi = input.platform === "win32" ? win32Path : posixPath;
    const relative = pathApi.relative(input.workspaceRoot, input.workingDirectory);
    if (input.mode !== "danger-full-access"
      && (relative === ".." || relative.startsWith(`..${pathApi.sep}`) || pathApi.isAbsolute(relative))) {
      throw new SandboxPolicyError("命令工作目录必须位于当前工作区内。");
    }
  }
  if (input.target.kind === "node") assertSafeText(input.target.nodeId, "目标节点 ID");
  else if (input.target.kind !== "local") throw new SandboxPolicyError("执行目标无效。");
  if (input.sessionId !== undefined) assertSafeText(input.sessionId, "会话 ID");
  const networkPolicy = normalizeNetworkPolicy(input.networkPolicy, input.mode);

  return Object.freeze({
    mode: input.mode,
    networkPolicy,
    platform: input.platform,
    target: Object.freeze({ ...input.target }),
    workspaceRoot: input.workspaceRoot,
    ...(input.workingDirectory === undefined ? {} : { workingDirectory: input.workingDirectory }),
    ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId })
  });
}

/** 比较沙箱范围是否变宽；此比较不能替代权限 Owner 的审批。 */
export function isSandboxPolicyWidening(current: SandboxMode, requested: SandboxMode): boolean {
  return SANDBOX_MODES.indexOf(requested) > SANDBOX_MODES.indexOf(current);
}
