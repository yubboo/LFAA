/** 沙箱范围是执行限制；授权模式仍由 Permission Owner 唯一持有。 */
export const EXECUTION_SANDBOX_MODES = ["read-only", "workspace-write", "danger-full-access"] as const;
export type ExecutionSandboxMode = (typeof EXECUTION_SANDBOX_MODES)[number];
