/**
 * 浏览器侧对 node:module 的明确占位。
 * DSH Cordis Loader 在 Web Runtime 中不应触达 Node createRequire；若以后
 * 启动路径变化导致触达，立即抛错，避免静默运行错误逻辑。
 */
export const createRequire = (): never => {
  throw new Error("node:module 在浏览器中不可用。");
};

/** Loader 的 Node 专用类型，仅供打包解析。 */
export type LoadHookContext = never;
