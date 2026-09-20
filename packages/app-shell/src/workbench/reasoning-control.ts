/**
 * 文件：workbench/reasoning-control.ts
 * 作用：给 RuntimeControl 子模块提供单层 reasoning 投影入口，避免跨两级目录读取父级实现。
 * 负责：原样转发 v0.0.91 reasoning-control 纯函数与类型。
 * 不负责：过滤、补齐、排序或重命名 Provider reasoning option。
 * 状态归属：无状态；真实算法仍由 ../reasoning-control.ts 持有。
 * 对外接口：resolveReasoningStages、resolveReasoningStageIndex、ReasoningStageBinding。
 * 修改注意事项：本轮只建立模块边界，不得在此改变 reasoning 行为。
 */
export { resolveReasoningStages, resolveReasoningStageIndex, type ReasoningStageBinding } from "../reasoning-control";
