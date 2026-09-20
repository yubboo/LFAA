/**
 * 文件：index.ts
 * 作用：@lfaa/workspace 唯一跨 package 公共入口。
 * 负责：导出 Chat / Work 两种 Workspace 投影与共享 Session Controller/契约。
 * 不负责：Shell、Settings、Provider、宿主 Bridge、UI Kit 内部实现。
 */
export * from "./chat";
export * from "./work";
export * from "./shared";
