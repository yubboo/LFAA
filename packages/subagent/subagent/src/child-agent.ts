/**
 * 功能：子代理句柄（child-agent）——把运行句柄、描述与控制/投影打包为一个面向调用方的对象。
 * 作用：对上层（client/工具）暴露统一的子代理视图：等待结果、取消、投影。
 * 关联文件：types.ts、control.ts、projection.ts、descriptor.ts。
 */
import type { SubagentDescriptor } from "./descriptor.js";
import { applyControl } from "./control.js";
import { projectCatalogEntry } from "./projection.js";
import type { SubagentRunHandle } from "./types.js";
import type { SubagentControlCommand, SubagentControlReceipt } from "./control-types.js";
import type { SubagentCatalogEntry } from "./projection-types.js";

/** 面向调用方的子代理句柄。 */
export class ChildAgent {
  constructor(
    readonly descriptor: SubagentDescriptor,
    private readonly handle: SubagentRunHandle
  ) {}

  /** 等待终态结果。 */
  get done(): Promise<unknown> {
    return this.handle.done;
  }

  /** 应用控制指令。 */
  control(command: SubagentControlCommand): SubagentControlReceipt {
    return applyControl(this.handle, command);
  }

  /** 只读目录投影。 */
  project(): SubagentCatalogEntry {
    return projectCatalogEntry(this.handle);
  }
}
