/**
 * 功能：调用方客户端接口——对子代理能力的一个更窄、面向调用方的门面。
 * 作用：把 manager 的 start/list/cancel 收拢为一个对象，供工具层与未来 API 层复用。
 * 关联文件：manager.ts、tool-subagent、tool-subagent-control。
 * 移植自 DeepSeek Harness subagent/client（MIT License，commit 639ed01），按 LFAA manager 适配。
 */
import type { SubagentManager } from "./manager.js";
import { listChildren } from "./list-children.js";
import type { SubagentRunHandle, SubagentRunResult, SubagentTask, SubagentDriverContext } from "./types.js";

/** 窄门面：只暴露委派、列表、取消。 */
export class SubagentClient {
  constructor(private readonly manager: SubagentManager) {}

  /** 派发一个一次性子任务。 */
  start(task: SubagentTask, ctx: SubagentDriverContext): SubagentRunHandle {
    return this.manager.start(task, ctx);
  }

  /** 等待并结算结果（便捷方法）。 */
  async runToCompletion(task: SubagentTask, ctx: SubagentDriverContext): Promise<SubagentRunResult> {
    return this.manager.start(task, ctx).done;
  }

  /** 列出某账户的子代理。 */
  list(userId: string) {
    return listChildren(this.manager, userId);
  }

  /** 取消某账户的一个子任务。 */
  cancel(userId: string, runId: string): boolean {
    return this.manager.cancelRun(userId, runId);
  }

  /** 列出可用驱动。 */
  drivers() {
    return this.manager.listDrivers();
  }
}
