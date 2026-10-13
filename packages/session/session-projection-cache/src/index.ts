/**
 * 文件：index.ts
 * 功能：会话投影缓存——按「会话 ID + 修订令牌」缓存轻量视图，避免控制器重复折叠。
 * 作用：缓存键带修订令牌，修订一变即视为失效；容量有界，防止长会话撑爆内存。
 * 边界：只缓存投影后的视图值，不缓存原始正文；不持久化到磁盘。
 * 关联文件：session-projection、session-persistence（修订令牌来源）。
 */
import type { Context } from "@deepseek-ai/cordis";

/** 一条缓存项：视图值与它依赖的修订令牌。 */
interface CacheEntry {
  readonly revision: string;
  readonly value: unknown;
}

/** 有界 LRU 投影缓存（Map 迭代序即访问序）。 */
export class SessionProjectionCache {
  private readonly entries = new Map<string, CacheEntry>();
  constructor(private readonly maxEntries = 128) {}

  /** 取缓存；修订令牌不一致时返回 undefined 并淘汰旧项。 */
  get(sessionId: string, revision: string): unknown | undefined {
    const key = `${sessionId}\u0000${revision}`;
    const hit = this.entries.get(key);
    if (hit === undefined) return undefined;
    // 命中后重排到队尾（最近使用）。
    this.entries.delete(key);
    this.entries.set(key, hit);
    return hit.value;
  }

  /** 写入并按容量淘汰最久未用项。 */
  set(sessionId: string, revision: string, value: unknown): void {
    const key = `${sessionId}\u0000${revision}`;
    this.entries.delete(key);
    this.entries.set(key, { revision, value });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  /** 丢弃某会话的全部缓存（会话被删除/重写时调用）。 */
  invalidateSession(sessionId: string): void {
    const prefix = `${sessionId}\u0000`;
    for (const key of this.entries.keys()) if (key.startsWith(prefix)) this.entries.delete(key);
  }

  get size(): number { return this.entries.size; }
}

export const name = "lfaaSessionProjectionCache";
export function apply(ctx: Context): void {
  const cache = new SessionProjectionCache();
  ctx.provide(name, cache);
}
