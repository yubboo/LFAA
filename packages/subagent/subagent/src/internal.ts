/**
 * 功能：子代理包内部共享的纯工具函数。
 * 作用：有界集合、安全 JSON 快照、运行标识生成——不依赖任何外部服务，可被同包任意模块复用。
 * 关联文件：manager.ts、catalog.ts、inbox.ts、descriptor.ts。
 */
import { randomUUID } from "node:crypto";

/** 生成一个新的子代理运行标识。 */
export function newRunId(): string {
  return randomUUID();
}

/**
 * 把值做一次 JSON 往返，确认其无损可序列化并 detach 引用。
 * @returns 快照副本；不可序列化时返回 undefined。
 */
export function safeJsonSnapshot<T>(value: T): T | undefined {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return undefined;
  }
}

/** 有界最近列表：超过容量时丢弃最旧项，用于活动运行/消息队列防止内存膨胀。 */
export class BoundedRecentList<T> {
  private readonly items: T[] = [];
  constructor(private readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) throw new Error("BoundedRecentList 容量必须为正整数。");
  }
  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.capacity) this.items.shift();
  }
  all(): readonly T[] {
    return this.items;
  }
}

/** 截断字符串到指定字节上限（按 UTF-16 码元粗估，足够诊断用途）。 */
export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
