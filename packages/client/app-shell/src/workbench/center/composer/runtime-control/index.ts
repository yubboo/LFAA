/** RuntimeControl 子模块唯一父级入口。禁止 Composer 深链导入内部实现。 */
export { RuntimeControl } from "./view/RuntimeControl";
export { useRuntimeControlController } from "./logic/useRuntimeControlController";
export type { RuntimeControlController, RuntimeControlExecutionContext, RuntimeControlProps } from "./contracts/runtime-control.types";
