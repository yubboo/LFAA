/**
 * 文件：index.ts
 * 功能：登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。
 * 关联文件：本包实现、package.json、组合补丁。
 * LFAA 适配：保留既有 extension-registry 默认导出（aiExtensions 服务，api 分片在用），
 * 同时导出 DSH 对齐的 Agent 类型/模型选择/投影/已消耗工作等能力面。
 */
export { default } from "./extension-registry.js";
export { AiExtensionRegistry } from "./extension-registry.js";
export type { AiExtensionKind, AiExtensionManifest } from "./extension-registry.js";

// DSH 对齐的 Agent 能力面（types / runtime-types / model-selection / projection / consumed-work / archive-admission / dispatch / invariant）
export type { Agent, InboxTarget, InboxState, TurnBoundaryProjection } from "./types.js";
export type { AgentOptions, AgentStatus, CancelOptions, Inbox, SessionStartSource } from "./runtime-types.js";
export type { ModelSelection, ModelSelectionRef } from "./model-selection.js";
export {
  sameRoute,
  modelSwitchNotice,
  modelSwitchNoticeIfChanged,
  createModelSelectionRef,
} from "./model-selection.js";
export { foldConsumedWork, type ConsumedWork } from "./consumed-work.js";
export { foldTurnBoundary } from "./projection.js";
export { agentIsRunning, admitArchive, type ArchiveAdmissionAgent } from "./archive-admission.js";
export { agentCarrier, emitAgentEvent } from "./dispatch.js";
export { assertValidModelSelection, assertKnownTurnEndStatus } from "./invariant.js";
