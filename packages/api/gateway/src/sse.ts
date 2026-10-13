/**
 * 功能：提供可复用的 Server-Sent Events 流式响应助手。
 * 作用：统一 SSE 响应头、心跳、连接关闭清理与写后守卫，避免每个控制器重复样板。
 * 关联文件：packages/api/gateway/src/index.ts、packages/api/remotes/src/route-contracts.ts（writeSse）、packages/api/session-controller/src/index.ts。
 *
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 @deepseek-ai/dsh-api-gateway 的流式/SSE 响应约定；
 * LFAA 以 Express + text/event-stream 落地，不照搬其 WebSocket mux 传输。
 */
import type { Request, Response } from "express";
import { writeSse } from "lfaa-api-remotes/src/route-contracts.js";

/** 一条已开启的 SSE 流的句柄；关闭心跳并标记结束，重复调用安全。 */
export interface SseStreamHandle {
  /** 清理心跳定时器和连接监听器；不会主动结束响应，结束由业务方在收尾事件后调用。 */
  close(): void;
  /** 连接已被客户端关闭、响应已结束或已销毁。 */
  readonly closed: boolean;
}

/** openSseStream 的可选配置。 */
export interface OpenSseStreamOptions {
  /** 心跳间隔毫秒；传 0 关闭心跳。默认 15000。 */
  readonly heartbeatMs?: number;
  /** 心跳事件名，默认 "keepalive"。 */
  readonly heartbeatEvent?: string;
}

/**
 * 开启一条标准 SSE 响应。
 * 设置 text/event-stream 响应头并立即刷新，启动 unref 的心跳定时器；
 * 当响应关闭时自动清理心跳。控制器随后用 writeSse 写业务事件，
 * 业务收尾（如 "done"）由控制器调用 response.end()。
 *
 * 注意：本助手不替代账户隔离与认证——调用方必须先用 requireAuthentication 校验身份。
 */
export function openSseStream(request: Request, response: Response, options: OpenSseStreamOptions = {}): SseStreamHandle {
  const heartbeatMs = options.heartbeatMs ?? 15_000;
  const heartbeatEvent = options.heartbeatEvent ?? "keepalive";
  response.status(200).set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  response.flushHeaders();

  let closed = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const markClosed = (): void => { closed = true; };
  const cleanup = (): void => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  };
  function cleanupListeners(): void {
    request.off("aborted", onClosed);
    response.off("close", onClosed);
  }

  function onClosed(): void {
    markClosed();
    cleanup();
    cleanupListeners();
  }
  // IncomingMessage.close 也会在请求体正常读完时触发；它不代表 SSE 响应断开。
  request.once("aborted", onClosed);
  response.once("close", onClosed);
  if (request.aborted || response.destroyed || response.writableEnded) onClosed();

  if (!closed && heartbeatMs > 0) {
    timer = setInterval(() => {
      if (!response.destroyed && !response.writableEnded) writeSse(response, heartbeatEvent, {});
    }, heartbeatMs);
    // 心跳定时器不应阻止进程退出。
    timer.unref?.();
  }

  return {
    get closed(): boolean { return closed || response.destroyed || response.writableEnded; },
    close(): void {
      markClosed();
      cleanup();
      cleanupListeners();
    },
  };
}
