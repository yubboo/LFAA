// 浏览器端高可用流式订阅器：提供按片段序号幂等去重、RAF 节流批量渲染、心跳看门狗、指数退避重连与完整句边界续写辅助。
import type { AgentStepItem, PendingApprovalBanner } from "./chat-types";

/** 设置无事件时触发流连接超时判断的间隔。 */
export const HEARTBEAT_TIMEOUT_MS = 25_000;
/** 限制单次运行流在断开后自动重试的次数。 */
export const MAX_RECONNECT_ATTEMPTS = 5;

/** 聚合同一批可交给视图的内容增量，降低频繁刷新。 */
export interface StreamDeltaBatch {
  text: string;
  reasoning: string;
}

/** 描述重连时恢复消息和步骤所需的运行快照。 */
export interface StreamRunSnapshotPayload {
  content: string;
  reasoning: string;
  steps: AgentStepItem[];
  lastSeq?: number;
  pendingApprovals?: PendingApprovalBanner[];
}

/** 约定流客户端交给聊天 Store 的通知与错误回调。 */
export interface AgentStreamClientHandlers {
  onSnapshot: (run: StreamRunSnapshotPayload, isReconnect: boolean) => void;
  onDeltaBatch: (batch: StreamDeltaBatch) => void;
  onStepUpdate: (step: AgentStepItem) => void;
  onApprovalRequired: (approval: Omit<PendingApprovalBanner, "runId">) => void;
  onStatusNotice: (notice: string) => void;
  onFinished: (payload: { status: "done" | "error" | "aborted"; error?: string; fps?: number }) => void;
  onDegraded: (lastSeq: number, reason: string) => void;
}

/** 从未完整显示的流式文本中取出到最近完整句子的部分。 */
export function splitCleanSentenceBoundary(partialText: string): {
  cleanPrefix: string;
  incompleteTail: string;
} {
  const trimmed = partialText.replace(/\s+$/u, "");
  if (!trimmed) return { cleanPrefix: "", incompleteTail: "" };
  const matches = [...trimmed.matchAll(/[。！？.!?;\n](?:["'”’）)\]]*)/gu)];
  const last = matches[matches.length - 1];
  if (!last || last.index === undefined) {
    return { cleanPrefix: "", incompleteTail: trimmed };
  }
  const idx = last.index + last[0].length;
  return {
    cleanPrefix: trimmed.slice(0, idx),
    incompleteTail: trimmed.slice(idx).trim(),
  };
}

/** 计算带抖动的退避延时，避免断线客户端同时重连。 */
export function computeBackoffWithJitter(attempt: number, baseMs = 500, capMs = 12_000): number {
  const exp = Math.min(capMs, baseMs * Math.pow(2, Math.max(0, attempt - 1)));
  return Math.min(capMs, exp + Math.floor(Math.random() * 220));
}

/** 订阅 Host 运行流，协调心跳监测、断线恢复和增量批处理。 */
export class AgentStreamClient {
  private es: EventSource | null = null;
  private closed = false;
  private finished = false;
  private seenSeqs = new Set<number>();
  private lastSeq = 0;
  private retryAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;

  private pendingText = "";
  private pendingReasoning = "";
  private rafHandle: number | null = null;
  private timerFlushHandle: ReturnType<typeof setTimeout> | null = null;
  private flushCount = 0;
  private startTs = Date.now();

  constructor(
    private readonly runId: string,
    private readonly handlers: AgentStreamClientHandlers,
    initialLastSeq = 0,
  ) {
    this.lastSeq = initialLastSeq;
  }

  start(isResume = false): void {
    this.closed = false;
    this.connect(isResume);
  }

  getLastSeq(): number {
    return this.lastSeq;
  }

  dispose(): void {
    this.closed = true;
    this.clearTimers();
    this.flushNow();
    this.es?.close();
    this.es = null;
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.rafHandle !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    if (this.timerFlushHandle !== null) {
      clearTimeout(this.timerFlushHandle);
      this.timerFlushHandle = null;
    }
  }

  private resetWatchdog(): void {
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    if (this.closed || this.finished) return;
    this.watchdogTimer = setTimeout(() => {
      if (!this.closed && !this.finished) {
        this.es?.close();
        this.es = null;
        this.scheduleReconnect("流式心跳超时");
      }
    }, HEARTBEAT_TIMEOUT_MS);
  }

  // 将高频到达的 token 合并到下一帧（~16ms），避免逐字全量 setState 引发掉帧
  private scheduleBatchFlush(): void {
    if (this.rafHandle !== null || this.timerFlushHandle !== null) return;
    if (typeof requestAnimationFrame === "function") {
      this.rafHandle = requestAnimationFrame(() => {
        this.rafHandle = null;
        this.flushNow();
      });
    } else {
      this.timerFlushHandle = setTimeout(() => {
        this.timerFlushHandle = null;
        this.flushNow();
      }, 16);
    }
  }

  private flushNow(): void {
    if (!this.pendingText && !this.pendingReasoning) return;
    const batch: StreamDeltaBatch = {
      text: this.pendingText,
      reasoning: this.pendingReasoning,
    };
    this.pendingText = "";
    this.pendingReasoning = "";
    this.flushCount += 1;
    this.handlers.onDeltaBatch(batch);
  }

  private connect(isResume: boolean): void {
    if (this.closed || this.finished) return;
    this.es?.close();
    const qs = isResume || this.lastSeq > 0 ? `?afterSeq=${this.lastSeq}` : "";
    const es = new EventSource(`/api/agent/runs/${encodeURIComponent(this.runId)}/events${qs}`);
    this.es = es;
    this.resetWatchdog();

    es.addEventListener("heartbeat", () => {
      this.retryAttempt = 0;
      this.resetWatchdog();
    });

    es.onmessage = (event) => {
      this.retryAttempt = 0;
      this.handlers.onStatusNotice("");
      this.resetWatchdog();

      const data = JSON.parse(event.data) as {
        type: string;
        seq?: number;
        reconnect?: boolean;
        kind?: "reasoning" | "text";
        text?: string;
        step?: AgentStepItem;
        approvalId?: string;
        toolName?: string;
        permissionLevel?: "write" | "exec";
        argsPreview?: string;
        permissionMode?: PendingApprovalBanner["permissionMode"];
        approvalPattern?: string;
        approvalCount?: number;
        approvalThreshold?: number;
        highRisk?: boolean;
        riskReason?: string;
        status?: "done" | "error" | "aborted";
        error?: string;
        run?: StreamRunSnapshotPayload;
      };

      if (data.type === "snapshot" && data.run) {
        if (typeof data.run.lastSeq === "number" && data.run.lastSeq > this.lastSeq && data.run.content) {
          this.lastSeq = data.run.lastSeq;
          for (let i = 1; i <= data.run.lastSeq; i += 1) {
            this.seenSeqs.add(i);
          }
        }
        this.handlers.onSnapshot(data.run, Boolean(data.reconnect));
      } else if (data.type === "delta" && data.text) {
        const seq = typeof data.seq === "number" ? data.seq : 0;
        // 幂等去重：重连补发与实时推送并发到达同一 seq 时直接丢弃重复片段
        if (seq > 0) {
          if (this.seenSeqs.has(seq)) return;
          this.seenSeqs.add(seq);
          if (seq > this.lastSeq) this.lastSeq = seq;
        }
        if (data.kind === "reasoning") this.pendingReasoning += data.text;
        else this.pendingText += data.text;
        this.scheduleBatchFlush();
      } else if (data.type === "step_update" && data.step) {
        this.flushNow();
        this.handlers.onStepUpdate(data.step);
      } else if (data.type === "approval_required" && data.approvalId && data.toolName && data.permissionLevel) {
        this.flushNow();
        this.handlers.onApprovalRequired({
          approvalId: data.approvalId,
          toolName: data.toolName,
          permissionLevel: data.permissionLevel,
          argsPreview: data.argsPreview ?? "{}",
          ...(data.permissionMode !== undefined ? { permissionMode: data.permissionMode } : {}),
          ...(data.approvalPattern !== undefined ? { approvalPattern: data.approvalPattern } : {}),
          ...(data.approvalCount !== undefined ? { approvalCount: data.approvalCount } : {}),
          ...(data.approvalThreshold !== undefined ? { approvalThreshold: data.approvalThreshold } : {}),
          ...(data.highRisk !== undefined ? { highRisk: data.highRisk } : {}),
          ...(data.riskReason !== undefined ? { riskReason: data.riskReason } : {}),
        });
      } else if (data.type === "run_finished") {
        this.finished = true;
        this.flushNow();
        this.clearTimers();
        es.close();
        this.es = null;
        const elapsedSec = Math.max(0.1, (Date.now() - this.startTs) / 1000);
        const fps = this.flushCount > 0 ? Math.min(120, this.flushCount / elapsedSec) : undefined;
        this.handlers.onFinished({
          status: data.status ?? "done",
          ...(data.error ? { error: data.error } : {}),
          ...(fps !== undefined ? { fps } : {}),
        });
      }
    };

    es.onerror = () => {
      if (this.closed || this.finished) return;
      es.close();
      this.es = null;
      this.scheduleReconnect("连接中断");
    };
  }

  private scheduleReconnect(reason: string): void {
    if (this.closed || this.finished) return;
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    this.retryAttempt += 1;
    if (this.retryAttempt > MAX_RECONNECT_ATTEMPTS) {
      this.flushNow();
      this.handlers.onStatusNotice("");
      this.handlers.onDegraded(this.lastSeq, reason);
      return;
    }
    const waitMs = computeBackoffWithJitter(this.retryAttempt);
    this.handlers.onStatusNotice(`网络波动（${reason}），${Math.ceil(waitMs / 100) / 10}s 后进行第 ${this.retryAttempt}/${MAX_RECONNECT_ATTEMPTS} 次断点重连…`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(true);
    }, waitMs);
  }
}
