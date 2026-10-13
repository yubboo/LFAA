/** 功能：SDK 共用公开会话/任务协议。作用：只导出权威 Owner 的类型，不载入服务端、身份或数据库。关联文件：sdk-client、api/session-controller、core/session。 */
export type { AiRunInput } from "lfaa-agent-loop/src/runs.js";
export type { AiRunView, AiSessionView, AiMessageView, AiActivityItem, AiUsageSummary } from "lfaa-session/src/sessions.js";
export type { ApplicationId } from "lfaa-util-values/src/application-id.js";
export interface LfaaRunEvent { event: string; data: Record<string, unknown> }
