import "./ui-overlay/layers.css";
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
export { ResizableWorkbench } from "./workbench/ResizableWorkbench.tsx";
export type { ResizableWorkbenchProps, WorkbenchPaneLimits, WorkbenchLayoutMode } from "./workbench/workbench-layout.types.ts";

export { WORKBENCH_LAYOUT_TOKENS, resolveWorkbenchLayoutMetrics } from "./workbench/workbench-layout.config.ts";
export { WORKBENCH_INTERACTION_TOKENS, normalizeSnapCaptureRatio, resolveSnapCaptureThreshold } from "./workbench/workbench-interaction.config.ts";
export type { WorkbenchLayoutMetrics } from "./workbench/workbench-layout.config.ts";
export { AiSettingsPage } from "./features/settings/ai/AiSettingsPage.tsx";
export type { AiSettingsPageProps, AiSettingsProviderView, AiSettingsAuthView, AiSettingsFieldView, AiSettingsAccountView, AiSettingsDraftInput, AiSettingsProbeView, AiSettingsModelView, AiSettingsModelSettingValue } from "./features/settings/ai/ai-settings.types.ts";
export { ThemeModeMenu } from "./features/appearance/ThemeModeMenu.tsx";
export { useDismissibleLayer } from "./ui-overlay/useDismissibleLayer.ts";
export type { DismissibleLayerOptions } from "./ui-overlay/useDismissibleLayer.ts";
export { DiscreteSlider } from "./ui-controls/DiscreteSlider.tsx";
export type { DiscreteSliderProps, DiscreteSliderStep } from "./ui-controls/DiscreteSlider.tsx";
export { UiEffectHost, UiEffectRegistry, builtinUiEffectRegistry } from "./ui-effects/index.ts";
export type { UiEffectDefinition, UiEffectRegistration, UiEffectRendererKind, UiEffectVariant } from "./ui-effects/index.ts";
export { UiExtensionRegistry } from "./ui-extension/registry.ts";
export type { UiExtensionContribution, UiExtensionKind } from "./ui-extension/contracts.ts";
export type { ThemeModeMenuProps, ThemePreference } from "./features/appearance/ThemeModeMenu.tsx";
export { AiSettingsPanel } from "./features/settings/ai/AiSettingsPanel.tsx";
export type { AiSettingsPanelProps } from "./features/settings/ai/AiSettingsPanel.tsx";

export { InfiniteCanvas, INFINITE_CANVAS_DEFAULT_VIEWPORT, INFINITE_CANVAS_SCALE_RANGE } from "./features/workbench/InfiniteCanvas.tsx";
export type { InfiniteCanvasEdge, InfiniteCanvasNode, InfiniteCanvasNodeKind, InfiniteCanvasProps, InfiniteCanvasViewport } from "./features/workbench/infinite-canvas.types.ts";

export { AnimatedDisclosure } from "./ui-motion/index.ts";
export type { AnimatedDisclosureProps } from "./ui-motion/AnimatedDisclosure.tsx";
export { useShortcut } from "./ui-shortcuts/index.ts";
export type { ShortcutSpec } from "./ui-shortcuts/useShortcut.ts";
export { stepDampedValue, DEFAULT_DAMPED_RESIZE_MOTION } from "./ui-resize/index.ts";
export { UI_LAYER } from "./ui-overlay/layers.ts";
