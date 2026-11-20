// @lfaa/plugins 添加外部插件的流式请求封装：通过 SSE 接收 pnpm 安装日志与最终状态。
import type { PluginRecord } from "../contract/index";
import type { PluginsStatePayload } from "./plugins-client";

/** 安装过程中的回调：日志行、完成状态与失败原因。 */
export interface AddStreamHandlers {
  onLog: (line: string) => void;
  signal?: AbortSignal;
}

/** 订阅一次外部插件安装；返回最终状态，失败时抛错。 */
export function addPluginStream(
  spec: string,
  handlers: AddStreamHandlers,
): Promise<PluginsStatePayload & { plugin: PluginRecord }> {
  return new Promise((resolve, reject) => {
    const url = `/api/plugins/add/stream?spec=${encodeURIComponent(spec)}`;
    const source = new EventSource(url);

    const close = () => source.close();
    handlers.signal?.addEventListener("abort", () => {
      close();
      reject(new Error("已取消安装。"));
    }, { once: true });

    source.addEventListener("log", (event) => {
      handlers.onLog((event as MessageEvent<string>).data);
    });
    source.addEventListener("done", (event) => {
      close();
      resolve(JSON.parse((event as MessageEvent<string>).data) as PluginsStatePayload & { plugin: PluginRecord });
    });
    source.addEventListener("failed", (event) => {
      close();
      const payload = JSON.parse((event as MessageEvent<string>).data) as { error?: string };
      reject(new Error(payload.error ?? "安装失败。"));
    });
    source.addEventListener("error", () => {
      // 服务端已结束时浏览器也会触发 error；连接关闭后忽略。
      if (source.readyState === EventSource.CLOSED) {
        close();
        reject(new Error("安装连接中断。"));
      }
    });
  });
}
