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
export { WORKBENCH_INTERACTION_TOKENS, normalizeSnapCaptureRatio, resolveSnapCaptureThreshold } from "./workbench/workbench-interaction.config";
export type { WorkbenchLayoutMetrics } from "./workbench/workbench-layout.config";
export { AiSettingsPage } from "./features/settings/ai/AiSettingsPage";
export type { AiSettingsPageProps, AiSettingsProviderView, AiSettingsAuthView, AiSettingsFieldView, AiSettingsAccountView, AiSettingsDraftInput, AiSettingsProbeView, AiSettingsModelView } from "./features/settings/ai/ai-settings.types";
export { UserMenu } from "./features/account/UserMenu";
export type { UserMenuProps } from "./features/account/UserMenu";
export { ThemeModeMenu } from "./features/appearance/ThemeModeMenu";
export type { ThemeModeMenuProps, ThemePreference } from "./features/appearance/ThemeModeMenu";
export { SettingsPage } from "./features/settings/SettingsPage";
export type { SettingsPageProps, SettingsSectionId } from "./features/settings/settings.types";
export { AiSettingsPanel } from "./features/settings/ai/AiSettingsPanel";
export type { AiSettingsPanelProps } from "./features/settings/ai/AiSettingsPanel";

export { InfiniteCanvas } from "./features/workbench/InfiniteCanvas";
export type { InfiniteCanvasEdge, InfiniteCanvasNode, InfiniteCanvasNodeKind, InfiniteCanvasProps } from "./features/workbench/infinite-canvas.types";
