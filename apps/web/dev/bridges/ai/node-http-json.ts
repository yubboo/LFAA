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
import http from "node:http";
import tls from "node:tls";
import type { AiHttpJsonPort, AiHttpRequestDescriptor } from "@lfaa/config-system";

const MAX_BODY = 2 * 1024 * 1024;
const PROXY_ENV_NAMES = ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "ALL_PROXY", "all_proxy"] as const;
let nodeNetworkInitialized = false;

function hasConfiguredProxy(): boolean {
  return PROXY_ENV_NAMES.some((name) => Boolean(process.env[name]?.trim()));
}

function initializeNodeNetwork(): void {
  if (nodeNetworkInitialized) return;
  nodeNetworkInitialized = true;
  // Node/Vite Host 不应因为使用系统代理/企业证书而与浏览器形成两套网络事实。
  // 保留 Node 默认 CA，同时加入 Windows/macOS/Linux 系统信任根；绝不关闭 TLS 校验。
  try {
    const current = tls.getCACertificates("default");
    const system = tls.getCACertificates("system");
    tls.setDefaultCACertificates([...current, ...system]);
  } catch { /* Node 版本/平台不支持时继续使用默认 CA，由请求错误负责诊断。 */ }
  // Node 24 fetch 需要显式启用环境代理；浏览器代理不会自动传给 Node Host。
  if (hasConfiguredProxy()) {
    try { http.setGlobalProxyFromEnv(); } catch { /* 由实际请求给出安全诊断。 */ }
  }
}

function nestedErrorCode(error: unknown): string | null {
  const first = error as { code?: unknown; cause?: unknown } | null;
  if (first && typeof first.code === "string") return first.code;
  const cause = first?.cause as { code?: unknown; cause?: unknown } | null | undefined;
  if (cause && typeof cause.code === "string") return cause.code;
  const inner = cause?.cause as { code?: unknown } | null | undefined;
  return inner && typeof inner.code === "string" ? inner.code : null;
}

function providerNetworkError(error: unknown): Error {
  const code = nestedErrorCode(error);
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return new Error(`Provider DNS 解析失败（${code}）。请检查网络、DNS 或代理设置。`);
  if (code === "ECONNREFUSED") return new Error("Provider 连接被拒绝（ECONNREFUSED）。请检查代理/VPN 是否已启动以及目标网络是否可达。");
  if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") {
    return new Error(hasConfiguredProxy()
      ? `Provider 连接超时（${code}）。已检测到 Node 代理环境，请检查代理是否可用。`
      : `Provider 连接超时（${code}）。Node Host 未检测到 HTTP(S)_PROXY；浏览器代理不会自动共享给 Node。`);
  }
  if (code === "ECONNRESET" || code === "UND_ERR_SOCKET") return new Error(`Provider 连接被重置（${code}）。请检查网络/代理稳定性。`);
  if (["SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "DEPTH_ZERO_SELF_SIGNED_CERT", "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID"].includes(code ?? "")) {
    return new Error(`Provider TLS 证书校验失败（${code}）。LFAA 不会关闭 TLS 校验；请检查系统证书或受信代理。`);
  }
  if (error instanceof TypeError && error.message === "fetch failed") {
    return new Error(hasConfiguredProxy()
      ? `Provider 网络请求失败${code ? `（${code}）` : ""}。Node Host 已检测到代理环境，请检查代理/DNS/TLS。`
      : `Provider 网络请求失败${code ? `（${code}）` : ""}。Node Host 未检测到代理；如果浏览器依赖代理/VPN，请让 LFAA Host 继承系统/环境代理。`);
  }
  return error instanceof Error ? error : new Error("Provider 网络请求失败。");
}

function providerHttpError(status: number, statusText: string): Error {
  if (status === 401) return new Error("Provider 认证失败（HTTP 401）。请确认 API Key 属于当前 Provider、复制完整且仍有效。");
  if (status === 403) return new Error("Provider 拒绝访问（HTTP 403）。凭据已被识别，但当前账户/项目没有所需权限。");
  if (status === 429) return new Error("Provider 请求受限（HTTP 429）。请检查速率限制、额度或账户状态后重试。");
  if (status >= 500) return new Error(`Provider 服务暂时异常（HTTP ${status}）。请稍后重试。`);
  return new Error(`Provider 返回 HTTP ${status}${statusText ? ` ${statusText}` : ""}`);
}

export class NodeAiHttpJsonPort implements AiHttpJsonPort {
  constructor() { initializeNodeNetwork(); }

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
        throw providerHttpError(response.status, response.statusText);
      }
      try { return JSON.parse(text); }
      catch { throw new Error("Provider 返回的不是有效 JSON。"); }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw new Error("Provider 连接超时（15 秒）。请检查网络或代理设置。");
      throw providerNetworkError(error);
    } finally {
      clearTimeout(timeout);
    }
  }
}
