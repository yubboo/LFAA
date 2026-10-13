/**
 * 功能：把子进程 stdout/stderr 分块转成可被消费方 await 的 AsyncIterable。
 * 作用：解除“生产端（流事件）”与“消费端（异步迭代）”的时序耦合；流结束时自动收尾。
 * 安全边界：PTY 使用显式容量，超过容量拒绝入队，由提供方停止进程，避免静默丢失控制序列。
 * 关联文件：src/spawn.ts。
 */
export interface QueueItem {
  readonly stream: "stdout" | "stderr";
  readonly offset: number;
  readonly bytes: Uint8Array;
}

/** 简单的一次性有界推送队列：push -> end，单消费者异步迭代。 */
export class AsyncChunkQueue implements AsyncIterable<QueueItem> {
  private buffer: QueueItem[] = [];
  private pending: Array<(result: IteratorResult<QueueItem>) => void> = [];
  private finished = false;
  private queuedBytes = 0;
  constructor(private readonly maxBytes = Infinity) {}

  push(item: QueueItem): boolean {
    if (this.finished) return false;
    const waiter = this.pending.shift();
    if (waiter) {
      waiter({ value: item, done: false });
    } else {
      if (this.queuedBytes + item.bytes.byteLength > this.maxBytes) return false;
      this.buffer.push(item);
      this.queuedBytes += item.bytes.byteLength;
    }
    return true;
  }

  end(): void {
    if (this.finished) return;
    this.finished = true;
    while (this.pending.length > 0) {
      const waiter = this.pending.shift()!;
      waiter({ value: undefined as unknown as QueueItem, done: true });
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<QueueItem> {
    while (true) {
      const next = this.buffer.shift();
      if (next) {
        this.queuedBytes -= next.bytes.byteLength;
        yield next;
        continue;
      }
      if (this.finished) return;
      const item = await new Promise<IteratorResult<QueueItem>>((resolve) => this.pending.push(resolve));
      if (item.done) return;
      yield item.value;
    }
  }
}
