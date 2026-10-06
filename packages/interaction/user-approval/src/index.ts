/** 功能：为一次性审批结果提供可撤销、按账户隔离的等待通知。作用：让运行循环等待真实权限 Owner 的状态变化，不再定时轮询持久层。关联文件：permission-presets、agent-loop、session-controller。 */
import type { Context } from "@deepseek-ai/cordis";

export const name = "lfaaUserApproval";

export type ApprovalWakeResult = "changed" | "timeout" | "aborted" | "closed";

export interface ApprovalWatchInput {
  readonly userId: string;
  readonly approvalId: string;
  readonly signal: AbortSignal;
  readonly timeoutMs: number;
}

export interface ApprovalWatch {
  readonly result: Promise<ApprovalWakeResult>;
  dispose(): void;
}

export interface UserApprovalNotifications {
  /** 订阅一个已持久化审批的下一次状态变化；调用方必须在注册后重读唯一持久化 Owner。 */
  watch(input: ApprovalWatchInput): ApprovalWatch;
  /** 在权限 Owner 完成状态提交后唤醒相同账户的等待者。 */
  notify(userId: string, approvalId: string): void;
}

declare module "@deepseek-ai/cordis" {
  interface Context { lfaaUserApproval: UserApprovalNotifications }
}

interface PendingWatch {
  settle(result: ApprovalWakeResult): void;
}

const approvalIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const maximumWaitMs = 5 * 60 * 1000;

function watchKey(userId: string, approvalId: string): string {
  if (typeof userId !== "string" || !userId.trim() || userId.length > 160 || /[\u0000-\u001f\u007f]/u.test(userId)) {
    throw new Error("审批通知的账户标识无效。");
  }
  if (!approvalIdPattern.test(approvalId)) throw new Error("审批通知的请求标识无效。");
  return `${userId}\0${approvalId}`;
}

class ApprovalNotificationService implements UserApprovalNotifications {
  private readonly watches = new Map<string, PendingWatch>();
  private closed = false;

  watch(input: ApprovalWatchInput): ApprovalWatch {
    const key = watchKey(input.userId, input.approvalId);
    if (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 0 || input.timeoutMs > maximumWaitMs) {
      throw new Error("审批等待时限必须在 0 至 5 分钟之间。");
    }
    if (this.closed) return { result: Promise.resolve("closed"), dispose() {} };
    if (input.signal.aborted) return { result: Promise.resolve("aborted"), dispose() {} };
    if (this.watches.has(key)) throw new Error("同一账户的审批请求已存在等待者。");
    if (input.timeoutMs === 0) return { result: Promise.resolve("timeout"), dispose() {} };

    let resolveResult!: (result: ApprovalWakeResult) => void;
    const result = new Promise<ApprovalWakeResult>((resolve) => { resolveResult = resolve; });
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: PendingWatch;
    const onAbort = () => settle("aborted");
    const settle = (outcome: ApprovalWakeResult) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      input.signal.removeEventListener("abort", onAbort);
      if (this.watches.get(key) === pending) this.watches.delete(key);
      resolveResult(outcome);
    };
    pending = { settle };
    this.watches.set(key, pending);
    input.signal.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => settle("timeout"), input.timeoutMs);
    if (timer && "unref" in timer && typeof timer.unref === "function") timer.unref();
    if (input.signal.aborted) settle("aborted");
    return { result, dispose: () => settle("closed") };
  }

  notify(userId: string, approvalId: string): void {
    const key = watchKey(userId, approvalId);
    this.watches.get(key)?.settle("changed");
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const pending of [...this.watches.values()]) pending.settle("closed");
  }
}

export function apply(ctx: Context): void {
  const notifications = new ApprovalNotificationService();
  ctx.provide(name, notifications);
  ctx.effect(() => () => notifications.close());
}
