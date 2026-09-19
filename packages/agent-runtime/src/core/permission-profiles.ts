/**
 * 文件：permission-profiles.ts
 * 作用：定义 LFAA 用户可见的三档权限，以及映射到 Harness 的原子权限快照。
 * 负责：Ask / Approve for me / Full access 的单一事实、Codex 权限元组映射。
 * 不负责：实际审批 UI、风险分类、OS 沙箱实现、Secret 授权。
 * 状态归属：纯配置事实；Run 启动时由 Agent Runtime 固化为不可变快照。
 * 对外接口：AGENT_PERMISSION_PROFILES、resolvePermissionProfile、toCodexPermissionSettings。
 * 关联文件：ARCHITECTURE.md、packages/app-shell/src/AgentWorkbench.tsx。
 * 修改注意事项：approval / reviewer / sandbox 必须原子更新，禁止只切换一个字段造成 UI 与真实权限漂移。
 */

export type AgentPermissionProfileId = "ask" | "approve-for-me" | "full-access";

export type ToolApprovalMode = "prompt-every-capability" | "auto-review" | "no-prompt";
export type SandboxScope = "workspace" | "unrestricted";
export type ApprovalReviewer = "user" | "model-reviewer" | "disabled";

export interface AgentPermissionProfile {
  readonly id: AgentPermissionProfileId;
  readonly label: string;
  readonly description: string;
  /** LFAA Runtime 在任何 capability 真正执行前使用的审批策略。 */
  readonly toolApproval: ToolApprovalMode;
  /** 审批请求最终交给谁；Ask 由人处理，Auto 由 Reviewer 处理。 */
  readonly reviewer: ApprovalReviewer;
  /** 执行沙箱范围；最终仍需 Rust/OS re-validation。 */
  readonly sandbox: SandboxScope;
  /** 是否允许 Tool Runtime 请求升级到当前 Profile 允许的更高执行范围。 */
  readonly allowEscalation: boolean;
  /** Trust Core/Secret/Audit 永远不受 Full access 放宽。 */
  readonly trustCoreMutableByRun: false;
}

export const AGENT_PERMISSION_PROFILES: Readonly<Record<AgentPermissionProfileId, AgentPermissionProfile>> = {
  ask: {
    id: "ask",
    label: "请求审批",
    description: "每次能力调用或执行步骤都先向你请求 Yes / No；模型推理本身不制造伪审批。",
    toolApproval: "prompt-every-capability",
    reviewer: "user",
    sandbox: "workspace",
    allowEscalation: true,
    trustCoreMutableByRun: false,
  },
  "approve-for-me": {
    id: "approve-for-me",
    label: "替我审批",
    description: "在工作区沙箱内由模型审查器判断低风险操作，需要时再升级审批。",
    toolApproval: "auto-review",
    reviewer: "model-reviewer",
    sandbox: "workspace",
    allowEscalation: true,
    trustCoreMutableByRun: false,
  },
  "full-access": {
    id: "full-access",
    label: "完全权限",
    description: "允许 Runtime 在当前 OS 用户权限内直接执行，不逐次弹审批。",
    toolApproval: "no-prompt",
    reviewer: "disabled",
    sandbox: "unrestricted",
    allowEscalation: false,
    trustCoreMutableByRun: false,
  },
};

export function resolvePermissionProfile(id: AgentPermissionProfileId): AgentPermissionProfile {
  return AGENT_PERMISSION_PROFILES[id];
}

export interface CodexPermissionSettings {
  readonly approvalPolicy: "on-request" | "never";
  readonly approvalsReviewer: "user" | "auto_review";
  readonly sandboxMode: "workspace-write" | "danger-full-access";
}

/**
 * Codex 官方运行时的权限是一个元组而不是一个 UI label。
 * 每次切换都返回完整对象，Host 必须把三项一起应用到 thread/turn，禁止 field-wise merge。
 * 注意：LFAA “请求审批”比 Codex on-request 更严格；LFAA 还必须在 Harness 之前执行 every-capability gate。
 */
export function toCodexPermissionSettings(id: AgentPermissionProfileId): CodexPermissionSettings {
  switch (id) {
    case "ask":
      return {
        approvalPolicy: "on-request",
        approvalsReviewer: "user",
        sandboxMode: "workspace-write",
      };
    case "approve-for-me":
      return {
        approvalPolicy: "on-request",
        approvalsReviewer: "auto_review",
        sandboxMode: "workspace-write",
      };
    case "full-access":
      return {
        approvalPolicy: "never",
        approvalsReviewer: "user",
        sandboxMode: "danger-full-access",
      };
  }
}
