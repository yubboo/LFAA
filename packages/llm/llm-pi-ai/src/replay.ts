/**
 * 移植参考：DeepSeek Harness dsh-llm-pi-ai（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）。
 * 文件：replay.ts
 * 功能：最小化请求重放/去重。
 * 与 DSH 差异说明：DSH 的 replay.ts 用于把已成功的流式对话在会话重放时精确复现 SSE（含 compact 记录）；
 *   LFAA 的 agent-loop 已自带幂等重试与会话持久化，无需在 Provider 层做事件重放。
 *   本模块提供最小等价：对完全相同的请求键缓存最近一次成功结果，避免同一轮内重复探测/请求。
 * 关联文件：llm-retry（真正的失败重试）、discovery.ts。
 */
import type { AiCompletionResult } from "lfaa-llm/src/completion.js";

/** 有界的「最近一次成功结果」缓存（按请求键）。 */
export class DoubaoReplayCache {
  private readonly entries = new Map<string, AiCompletionResult>();
  private readonly maxEntries: number;

  constructor(maxEntries = 16) {
    this.maxEntries = maxEntries;
  }

  /** 读取缓存；未命中返回 undefined。 */
  get(key: string): AiCompletionResult | undefined {
    return this.entries.get(key);
  }

  /** 写入一次成功结果；超出容量淘汰最旧项。 */
  set(key: string, result: AiCompletionResult): void {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, result);
  }

  clear(): void {
    this.entries.clear();
  }
}
