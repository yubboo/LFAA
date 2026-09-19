/**
 * 文件：index.ts
 * 作用：@lfaa/ui/workbench 稳定公共子入口。
 * 负责：向 UI package 内外统一暴露可复用 Workbench 布局组件、几何计算器与公共类型。
 * 不负责：Settings/App Shell 状态、宿主路由、业务逻辑。
 * 状态归属：无运行时状态。
 * 对外接口：ResizableWorkbench、resolveWorkbenchLayoutMetrics、Workbench 公共类型。
 * 关联文件：ResizableWorkbench.tsx、workbench-layout.config.ts、workbench-layout.types.ts、packages/ui/package.json。
 * 修改注意事项：跨 Feature 复用 Workbench 必须从本公共子入口导入，禁止依赖 tsconfig-only 私有 alias。
 */
export { ResizableWorkbench } from "./ResizableWorkbench";
export type { ResizableWorkbenchProps, WorkbenchPaneLimits, WorkbenchLayoutMode } from "./workbench-layout.types";
export { WORKBENCH_LAYOUT_TOKENS, resolveWorkbenchLayoutMetrics } from "./workbench-layout.config";
export type { WorkbenchLayoutMetrics } from "./workbench-layout.config";
