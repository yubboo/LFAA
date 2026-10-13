/**
 * 功能：子代理收件箱——为可续接子任务缓存排队中的后续消息。
 * 作用：活动运行未结束时，续接请求先入队；运行结束激活时按序取出。
 * 关联文件：continuation.ts、continuation-messages.ts。
 */
import { BoundedRecentList } from "./internal.js";
import type { ContinuationMessage } from "./continuation-messages.js";

/** 一个子任务的续接收件箱。 */
export class SubagentInbox {
  private readonly queue = new BoundedRecentList<ContinuationMessage>(16);

  /** 追加一条后续消息。 */
  enqueue(followup: string): void {
    this.queue.push({ at: new Date().toISOString(), followup });
  }

  /** 取出全部排队消息（保留供拼接，不清除——一次性模型续接语义由调用方决定）。 */
  pending(): readonly ContinuationMessage[] {
    return this.queue.all();
  }

  /** 是否有待处理消息。 */
  hasPending(): boolean {
    return this.queue.all().length > 0;
  }
}

/** 运行标识 → 收件箱。 */
export class InboxRegistry {
  private readonly inboxes = new Map<string, SubagentInbox>();

  for(runId: string): SubagentInbox {
    let inbox = this.inboxes.get(runId);
    if (!inbox) {
      inbox = new SubagentInbox();
      this.inboxes.set(runId, inbox);
    }
    return inbox;
  }

  drop(runId: string): void {
    this.inboxes.delete(runId);
  }
}
