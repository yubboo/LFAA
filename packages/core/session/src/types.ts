/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-session。
 * LFAA 适配：会话模型类型权威在 kernel.ts；本模块重导出公共类型，使消费方按 DSH 形态从 types 入口引入。
 *
 * 文件：types.ts
 * 功能：会话模型消息、工具 schema、序号、表面操作等公共类型。
 * 作用：fork/preparation/repair/surface 等模块共用。
 */
export type {
  SessionModelMessage,
  SessionToolSchema,
  SessionSurfaceOperation,
  SessionDeveloperBlock,
  SessionSeq,
  SessionLogOffset,
  SessionRequestHeaderReason,
  SessionToolHistory,
  EncodedSessionSeq,
  SessionEventDataMap,
  SessionEventType,
  SessionEvent,
  SessionSurfaceItem,
  SessionForkErrorCode,
} from "./kernel.js";

export { sessionSeq, sessionLogOffset } from "./kernel.js";
