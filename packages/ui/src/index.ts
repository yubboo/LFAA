/**
 * 文件：index.ts
 * 作用：@lfaa/ui 的公开导出入口。
 * 负责：暴露纯 UI/Layout 组件与类型。
 * 不负责：业务状态、App Shell 编排、系统能力。
 * 状态归属：无运行时状态。
 * 对外接口：ResizableWorkbench、WorkbenchPaneLimits、ResizableWorkbenchProps、响应式布局计算器。
 * 关联文件：workbench/ResizableWorkbench.tsx、workbench/workbench-layout.types.ts、workbench/workbench-layout.config.ts。
 * 修改注意事项：只导出稳定公共 API，内部实现细节不要直接暴露。
 */
export { ResizableWorkbench } from "./workbench/ResizableWorkbench";
export type { ResizableWorkbenchProps, WorkbenchPaneLimits, WorkbenchLayoutMode } from "./workbench/workbench-layout.types";

export { WORKBENCH_LAYOUT_TOKENS, resolveWorkbenchLayoutMetrics } from "./workbench/workbench-layout.config";
export type { WorkbenchLayoutMetrics } from "./workbench/workbench-layout.config";
