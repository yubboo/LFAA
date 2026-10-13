/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-session。
 * 会话请求头：把每个模型请求的 provider/model/权限/工具配置规范化，比较是否需要开启新序列。
 * 实现权威在 kernel.ts；本模块按 DSH 形态重导出。
 *
 * 文件：request-header.ts
 * 功能：canonicalSessionRequestHeader / sessionRequestHeadersEqual / foldSessionRequestHeader。
 */
import {
  canonicalSessionRequestHeader,
  foldSessionRequestHeader,
  sessionRequestHeadersEqual,
} from "./kernel.js";
export { canonicalSessionRequestHeader, foldSessionRequestHeader, sessionRequestHeadersEqual };
export type { SessionEventDataMap } from "./kernel.js";
