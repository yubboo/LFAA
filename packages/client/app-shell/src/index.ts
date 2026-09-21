/**
 * 文件：index.ts
 * 作用：@lfaa/app-shell 的公开导出入口。
 * 负责：只暴露允许跨 package 使用的工作台组件与类型。
 * 不负责：实现组件逻辑。
 * 状态归属：无运行时状态。
 * 对外接口：AgentWorkbench 及其公开类型。
 * 关联文件：AgentWorkbench.tsx、workbench.types.ts。
 * 修改注意事项：跨 workspace 依赖必须从本入口导入，不允许深链 src/internal。
 */
export { AgentWorkbench } from "./AgentWorkbench";
export type { AgentWorkbenchProps, AgentAiSettingsHost, AgentPluginSettingsHost, AgentIdentitySettingsHost, AgentIdentityProjection, DevResourceItem, ResourceKind } from "./workbench.types";

export { LfaaIdentityGate } from "./identity";
export type { IdentityClientHost } from "./identity";
export { LfaaAppHub } from "./app-hub";
export type { AppHubEntry } from "./app-hub";
