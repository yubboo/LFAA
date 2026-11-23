// @lfaa/plugins 添加外部插件的流式请求封装：用 POST + fetch 流读取 SSE 安装日志与最终状态。
import type { PluginRecord } from "@lfaa/plugins/contract";
import type { PluginsStatePayload } from "../plugins-client";

/** 安装过程中的回调：日志行、完成状态与失败原因。 */
export interface AddStreamHandlers {
  onLog: (line: string) => void;
  signal?: AbortSignal;
}

/** SSE 事件块：`event:` 行给出类型，`data:` 行可多行拼接。 */
interface SseEvent {
  event: string;
  data: string;
}

/** 按空行切分 SSE 事件块，返回已完成事件与未完成的尾部缓冲。 */
function parseSseChunk(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = [];
  let rest = buffer;
  let boundary = rest.indexOf("\n\n");
  while (boundary >= 0) {
    const rawBlock = rest.slice(0, boundary);
    rest = rest.slice(boundary + 2);
    let event = "message";
    const dataLines: string[] = [];
    for (const line of rawBlock.split("\n")) {
      if (line.startsWith("event:")) event = line.slice("event:".length).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).trimStart());
    }
    events.push({ event, data: dataLines.join("\n") });
    boundary = rest.indexOf("\n\n");
  }
  return { events, rest };
}

/** 订阅一次外部插件安装；返回最终状态，失败时抛错。 */
export async function addPluginStream(
  spec: string,
  handlers: AddStreamHandlers,
): Promise<PluginsStatePayload & { plugin: PluginRecord }> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  const externalSignal = handlers.signal;
  if (externalSignal?.aborted) throw new Error("已取消安装。");
  externalSignal?.addEventListener("abort", onAbort, { once: true });

  try {
    const res = await fetch("/api/plugins/add/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error || `安装失败 (${res.status})`);
    }
    if (!res.body) throw new Error("安装连接中断。");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let settled: { kind: "done"; value: PluginsStatePayload & { plugin: PluginRecord } } | { kind: "failed"; error: Error } | null = null;

    while (settled === null) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseChunk(buffer);
      buffer = parsed.rest;
      for (const item of parsed.events) {
        if (item.event === "log") {
          handlers.onLog(item.data);
          continue;
        }
        if (item.event === "done") {
          settled = { kind: "done", value: JSON.parse(item.data) as PluginsStatePayload & { plugin: PluginRecord } };
          break;
        }
        if (item.event === "failed") {
          const payload = JSON.parse(item.data) as { error?: string };
          settled = { kind: "failed", error: new Error(payload.error ?? "安装失败。") };
          break;
        }
      }
    }
    reader.cancel().catch(() => {});

    if (settled === null) throw new Error("安装连接中断。");
    if (settled.kind === "failed") throw settled.error;
    return settled.value;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("已取消安装。");
    throw error;
  } finally {
    externalSignal?.removeEventListener("abort", onAbort);
  }
}