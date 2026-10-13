/** 功能：登记唯一 LLM 请求服务。作用：隔离 Provider 协议与 Agent 工具执行。关联文件：completion.ts、core/agent-loop、Settings Owner。 */
import type { Context } from "@deepseek-ai/cordis";
import * as completion from "./completion.js";
export * from "./completion.js";
export * from "./image-generation.js";
export * from "./video-generation.js";
// Provider 无关的流式协议/块组装/错误分类/退避策略/密钥与归因等原语（移植自 DSH dsh-llm，MIT）。
export * from "./types.js";
export * from "./error.js";
export * from "./api-key.js";
export * from "./attribution.js";
export * from "./retry-policy.js";
export * from "./assembler.js";
export * from "./assistant-stream.js";
export * from "./sse.js";
export const name = "lfaaLlm";
export function apply(ctx: Context): void { ctx.provide(name, completion); }
