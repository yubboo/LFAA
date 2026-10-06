/** 功能：声明构建指纹工具。作用：供 Vite 类型检查使用同一运行实现。关联文件：runtime-build-state.mjs。 */
export function runtimeBuildFingerprint(kind: "host" | "web", repository?: string): string;
export function recordRuntimeBuild(kind: "host" | "web", repository?: string, expectedFingerprint?: string): void;
export function staleRuntimeBuilds(profile?: string, repository?: string): Array<"host" | "web">;
