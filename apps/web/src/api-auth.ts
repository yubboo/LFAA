// 本机接口令牌注入：Host 把一次性令牌写进页面 meta，这里统一为同源 /api 请求附加请求头。
// 覆盖 fetch 与 EventSource 两条通道，业务代码无需感知令牌；非 /api 请求原样透传。
const TOKEN_META_SELECTOR = 'meta[name="lfaa-api-token"]';
const TOKEN_HEADER = "x-lfaa-token";
const TOKEN_QUERY = "token";

/** 读取 Host 注入的令牌；静态预览等未注入场景返回空串。 */
function readInjectedToken(): string {
  const element = document.querySelector<HTMLMetaElement>(TOKEN_META_SELECTOR);
  return element?.content?.trim() ?? "";
}

/** 判断目标地址是否为同源 /api 接口，避免给第三方请求带上令牌。 */
function isSameOriginApi(raw: string): boolean {
  try {
    const url = new URL(raw, window.location.href);
    if (url.origin !== window.location.origin) return false;
    return url.pathname === "/api" || url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

/** 给 EventSource 地址补查询参数：它不支持自定义请求头，只能走 GET 查询令牌。 */
function withQueryToken(raw: string | URL, token: string): string {
  const href = typeof raw === "string" ? raw : raw.href;
  if (!isSameOriginApi(href)) return href;
  const url = new URL(href, window.location.href);
  url.searchParams.set(TOKEN_QUERY, token);
  return url.toString();
}

/** 包装全局 fetch：同源 /api 请求自动附加令牌头，其余请求保持原样。 */
function patchFetch(token: string): void {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = input instanceof Request ? input.url : String(input);
    if (!isSameOriginApi(raw)) return nativeFetch(input, init);
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    headers.set(TOKEN_HEADER, token);
    // Request 输入要保持原 body，因此重建 Request 而不是丢弃它。
    if (input instanceof Request) return nativeFetch(new Request(input, { headers }));
    return nativeFetch(input, { ...init, headers });
  };
}

/** 包装全局 EventSource：同源 /api 地址补上查询令牌。 */
function patchEventSource(token: string): void {
  const NativeEventSource = window.EventSource;
  if (!NativeEventSource) return;
  class TokenEventSource extends NativeEventSource {
    constructor(url: string | URL, init?: EventSourceInit) {
      super(withQueryToken(url, token), init);
    }
  }
  window.EventSource = TokenEventSource;
}

/**
 * 安装令牌注入。必须在装配任何插件之前调用：
 * 插件的 store 会在首次渲染时立即发起 /api 请求。
 */
export function installApiToken(): void {
  const token = readInjectedToken();
  if (!token) {
    console.warn("[lfaa] 页面缺少本机接口令牌，/api 请求将被拒绝；请通过 pnpm lfaa web 启动。");
    return;
  }
  patchFetch(token);
  patchEventSource(token);
}