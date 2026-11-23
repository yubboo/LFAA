// @lfaa/agent-group 入口：导出群聊编排、发言计划契约与 HTTP 处理器。
// 本包是纯能力库 + 接口处理器（同 @lfaa/api-gateway），不需要挂 Cordis 服务。
export * from "./orchestrator";
export * from "./speaking-plan";
export { createGroupHttpHandler } from "./http-handler";
