/**
 * 文件：runtime-control-dependencies.ts
 * 作用：Center 父模块向 RuntimeControl 深子模块暴露最小 Workbench 依赖门面。
 * 负责：重导出 WorkbenchIcon、reasoning helper 与 RuntimeControl 需要的共享 ViewModel 类型。
 * 不负责：状态、业务逻辑、CSS、Provider 真值；不得反向导入 runtime-control 内部文件。
 * 修改注意事项：保持窄接口，防止深子模块使用 ../../ 穿透祖父级目录。
 */
export { WorkbenchIcon } from "../center-dependencies";
export { resolveReasoningStageIndex, resolveReasoningStages } from "../center-dependencies";
export type { ReasoningStageBinding } from "../center-dependencies";
export type { ActiveReasoningControl, LayoutMode, QuickModelOption } from "../center-dependencies";
