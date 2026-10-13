/**
 * 文件：kernel-adapter.ts
 * 功能：把 LFAA 会话内核的事件类型适配给 core/agent 的消费方。
 * 作用：consumed-work/projection 等只依赖这一层，不直接耦合 lfaa-session 内部细节。
 * 关联文件：packages/core/session/src/kernel.ts。
 */
export type { SessionEvent, SessionModelMessage } from "lfaa-session/src/kernel.js";
