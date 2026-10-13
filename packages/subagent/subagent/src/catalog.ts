/**
 * 功能：子代理目录——已登记驱动的元信息与可委派能力清单。
 * 作用：给模型/客户端列出"能委派给谁、各自模式"，本身不执行任务。
 * 关联文件：manager.ts、projection.ts、descriptor.ts。
 */
import type { SubagentDriver } from "./types.js";

/** 一条目录中的驱动条目。 */
export interface DriverCatalogEntry {
  readonly name: string;
  readonly displayName: string;
  /** 该驱动是否支持续接（外部 CLI 一次性模型默认不支持）。 */
  readonly continuable: boolean;
}

/** 把驱动集合折叠为只读目录。 */
export function buildDriverCatalog(drivers: readonly SubagentDriver[]): DriverCatalogEntry[] {
  return drivers.map(driver => ({
    name: driver.name,
    displayName: driver.displayName,
    // 一次性驱动为默认；是否可续接由驱动元信息决定，当前实现统一按不可续接处理。
    continuable: false
  }));
}
