// 提供 @lfaa/agent 流式断线续传序号日志、句边界续写裁剪、脱敏日志及可观测性指标统计。

export interface RunChunkRecord {
  seq: number;
  kind: "reasoning" | "text";
  text: string;
  /** 可选：所属思考轮次，供流式思维链按轮次还原。 */
  iteration?: number;
  ts: number;
}

/** 记录运行事件流的发送、重放与连接统计，供诊断使用。 */
export interface AgentStreamMetrics {
  activeStreams: number;
  totalRuns: number;
  totalReconnects: number;
  reconnectRate: number;
  replayedChunks: number;
  lastClientFps: number | null;
}

/** 生成诊断用的运行 ID 片段，降低日志暴露完整标识的风险。 */
export function maskRunId(id: string): string {
  const trimmed = id.trim();
  if (trimmed.length <= 8) return "***";
  return `${trimmed.slice(0, 4)}***${trimmed.slice(-4)}`;
}

// 中断续写时定位最后一个完整句边界，避免从半句话生硬拼接。
export function splitAtCleanSentenceBoundary(partialText: string): {
  cleanPrefix: string;
  incompleteTail: string;
} {
  const trimmed = partialText.replace(/\s+$/u, "");
  if (!trimmed) return { cleanPrefix: "", incompleteTail: "" };
  const boundaryMatches = [...trimmed.matchAll(/[。！？.!?;\n](?:["'”’）)\]]*)/gu)];
  const lastMatch = boundaryMatches[boundaryMatches.length - 1];
  if (!lastMatch || lastMatch.index === undefined) {
    return { cleanPrefix: "", incompleteTail: trimmed };
  }
  const splitIndex = lastMatch.index + lastMatch[0].length;
  return {
    cleanPrefix: trimmed.slice(0, splitIndex),
    incompleteTail: trimmed.slice(splitIndex).trim(),
  };
}

// 指数退避 + 抖动计算（毫秒），防止抖动期大量客户端同时重连引发雪崩。
export function computeReconnectBackoffMs(attempt: number, baseMs = 500, capMs = 12000): number {
  const exp = Math.min(capMs, baseMs * Math.pow(2, Math.max(0, attempt - 1)));
  const jitter = Math.floor(Math.random() * 220);
  return Math.min(capMs, exp + jitter);
}
