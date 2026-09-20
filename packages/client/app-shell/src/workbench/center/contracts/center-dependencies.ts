/**
 * Center 子树的窄依赖入口。
 * 目的：避免 header/conversation/composer 通过 ../../ 深链到 Workbench 祖先模块；
 * 只重导出 Center 子树确实需要的公共契约/Primitive，不持有状态。
 */
export { IconButton, WorkbenchIcon } from "#workbench/shared";
export { RightShellActions, ShellHeaderButton } from "#workbench/shell";
export { resolveReasoningStages, resolveReasoningStageIndex } from "#workbench/reasoning-control";
export type { ReasoningStageBinding } from "#workbench/reasoning-control";
export type { ActiveReasoningControl, LayoutMode, QuickModelOption } from "#workbench/contracts";
