/**
 * 模块：@lfaa/agent-runtime
 * 作用：LFAA Chat / Work 共用的 Agent Runtime 公共入口。
 * 负责：Runtime contracts、三档权限、官方 Harness bridge 元数据。
 * 不负责：React UI、Config 持久化、OS 特权执行。
 */
export type {
  AgentCapabilityDescriptor,
  AgentCapabilityKind,
  AgentModelBinding,
  AgentRunHandle,
  AgentRunRequest,
  AgentRuntimeHost,
  AgentSurfaceMode,
} from "./core/contracts";
export {
  AGENT_PERMISSION_PROFILES,
  resolvePermissionProfile,
  toCodexPermissionSettings,
} from "./core/permission-profiles";
export type {
  AgentPermissionProfile,
  AgentPermissionProfileId,
  ApprovalReviewer,
  CodexPermissionSettings,
  SandboxScope,
  ToolApprovalMode,
} from "./core/permission-profiles";
export {
  OFFICIAL_HARNESSES,
  createHarnessRegistry,
  resolveOfficialHarness,
} from "./harness/official-harnesses";
export type { OfficialHarnessCapabilitySeam, OfficialHarnessDescriptor, OfficialHarnessId } from "./harness/official-harnesses";

export type {
  LfaaAppPackDescriptor,
  LfaaCapabilityDescriptor,
  LfaaCapabilityKind,
  LfaaExternalAdapter,
  LfaaPluginManifest,
} from "@lfaa/plugin-sdk";
