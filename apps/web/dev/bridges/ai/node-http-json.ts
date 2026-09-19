/**
 * 文件：node-http-json.ts
 * 作用：Web 开发宿主的 Provider HTTP JSON Adapter。
 * 负责：超时、状态码、响应大小与 JSON 解析。
 * 不负责：构造认证 Header、保存 Secret、Provider URL 决策。
 * 状态归属：无持久状态。
 * 对外接口：NodeAiHttpJsonPort。
 * 关联文件：ai-config-bridge.ts、@lfaa/config-system AiHttpJsonPort。
 * 修改注意事项：错误中不得拼接请求 Header，避免 Secret 泄漏。
 */
import type { AiHttpJsonPort, AiHttpRequestDescriptor } from "@lfaa/config-system";

const MAX_BODY = 2 * 1024 * 1024;

export class NodeAiHttpJsonPort implements AiHttpJsonPort {
  async requestJson(request: AiHttpRequestDescriptor): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: { Accept: "application/json", ...request.headers },
        signal: controller.signal,
        redirect: "follow",
      });
      const text = await response.text();
      if (text.length > MAX_BODY) throw new Error("Provider 响应过大，已停止读取。");
      if (!response.ok) {
        // Provider 错误体可能回显请求信息。Host 不把错误体带回 UI，避免凭证/请求细节泄漏。
        throw new Error(`Provider 返回 HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`);
      }
      try { return JSON.parse(text); }
      catch { throw new Error("Provider 返回的不是有效 JSON。"); }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("Provider 连接超时。");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
