// @lfaa/api-gateway：集中登记并派发 Host HTTP 路由，并提供本机接口的访问令牌校验。
import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

/** 单个接口处理器：命中返回 true，未命中返回 false。 */
export type ApiHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;

/** 路由条目：`id` 用于日志与调试，`handle` 负责实际派发。 */
export interface ApiRoute {
  id: string;
  handle: ApiHandler;
}

/**
 * 接口网关：按登记顺序派发请求，第一个返回 true 的处理器生效。
 * 顺序有语义——具体路由必须排在宽泛路由之前（例如 `/api/plugins/install` 先于 `/api/plugins`）。
 * 未命中时返回 false，由宿主决定是否继续走后续中间件。
 */
export class ApiGateway {
  private readonly routes: ApiRoute[];

  constructor(routes: readonly ApiRoute[]) {
    this.routes = routes.map((route) => ({ id: route.id, handle: route.handle }));
  }

  /** 已登记的路由 id，按派发顺序返回，供启动日志与测试断言。 */
  list(): string[] {
    return this.routes.map((route) => route.id);
  }

  /** 派发一次请求；任一处理器抛错时向上抛出，由宿主统一转成 500。 */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    for (const route of this.routes) {
      if (await route.handle(req, res)) return true;
    }
    return false;
  }
}

/** 创建网关；路由顺序即派发顺序。 */
export function createApiGateway(routes: readonly ApiRoute[]): ApiGateway {
  return new ApiGateway(routes);
}

// ---------------------------------------------------------------------------
// 本机接口鉴权：Host 在启动时生成随机令牌并注入页面，浏览器端统一附加到 /api 请求。
// 目的不是防同机其他进程（同权限进程本来就无法防），而是阻断任意网页发起的跨站请求。
// ---------------------------------------------------------------------------

/** 本机接口令牌请求头；页面由 Host 通过 meta 注入，客户端统一附加。 */
export const API_TOKEN_HEADER = "x-lfaa-token";

/** EventSource 无法设置请求头，因此 GET 允许用同名查询参数携带令牌。 */
export const API_TOKEN_QUERY = "token";

/** 令牌校验参数：`token` 由 Host 每次启动随机生成。 */
export interface ApiAuthOptions {
  token: string;
}

/** 判定结果；拒绝时携带 HTTP 状态码与可展示原因，绝不静默放行。 */
export type ApiAuthDecision =
  | { allowed: true }
  | { allowed: false; status: 401 | 403; reason: string };

/** 只有 `/api` 与 `/api/...` 属于需要鉴权的接口面，其余交给 Vite 处理静态资源。 */
export function isApiPath(url: string | undefined): boolean {
  if (!url) return false;
  const pathname = url.split("?")[0] ?? "";
  return pathname === "/api" || pathname.startsWith("/api/");
}

/** 常量时间比较，避免通过响应时间泄漏令牌前缀。 */
function tokenEquals(received: string, expected: string): boolean {
  const left = Buffer.from(received, "utf8");
  const right = Buffer.from(expected, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** 写请求内容类型判定结果；拒绝时给出 415 与可展示原因。 */
export type ApiContentTypeDecision =
  | { allowed: true }
  | { allowed: false; status: 415; reason: string };

/** 请求是否携带请求体：有非零 content-length 或非 identity 的 transfer-encoding。 */
function requestHasBody(req: IncomingMessage): boolean {
  const rawLength = firstHeader(req.headers["content-length"]);
  if (rawLength !== undefined) {
    const length = Number(rawLength);
    if (Number.isFinite(length) && length > 0) return true;
  }
  const encoding = firstHeader(req.headers["transfer-encoding"]);
  if (!encoding) return false;
  const normalized = encoding.trim().toLowerCase();
  return normalized !== "" && normalized !== "identity";
}

/**
 * 写请求内容类型校验：非只读方法只要携带请求体，就必须声明 application/json。
 * 目的不是替代业务校验，而是让所有写入口统一走 JSON 解析路径，避免表单/文本编码绕过。
 * 无请求体的 POST（启停、中止等动作）不受影响；GET/HEAD/OPTIONS 与非 /api 路径直接放行。
 */
export function checkApiWriteContentType(req: IncomingMessage): ApiContentTypeDecision {
  if (!isApiPath(req.url)) return { allowed: true };
  const method = (req.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return { allowed: true };
  if (!requestHasBody(req)) return { allowed: true };
  const raw = firstHeader(req.headers["content-type"]) ?? "";
  const mime = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  if (mime === "application/json") return { allowed: true };
  return { allowed: false, status: 415, reason: "写接口的请求体必须是 application/json。" };
}

/** 取单值请求头；重复头在 Node 中会变成数组，这里只认同名首个值。 */
function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** 从查询串读取令牌，仅供无法设置请求头的 EventSource 使用。 */
function readQueryToken(url: string): string | undefined {
  const queryStart = url.indexOf("?");
  if (queryStart === -1) return undefined;
  return new URLSearchParams(url.slice(queryStart + 1)).get(API_TOKEN_QUERY) ?? undefined;
}

/**
 * 校验一次 Host API 请求，规则按 fail-closed 排列：
 * 1. 非 `/api` 路径直接放行（Vite 资源、HMR 不受影响）；
 * 2. OPTIONS 放行，预检本身不产生副作用；
 * 3. 带 Origin 时必须与请求 Host 同源，`Sec-Fetch-Site: cross-site` 一律拒绝；
 * 4. 令牌缺失或不匹配返回 401；GET 可用查询参数携带令牌以兼容 EventSource。
 */
export function checkApiAuth(req: IncomingMessage, options: ApiAuthOptions): ApiAuthDecision {
  if (!isApiPath(req.url)) return { allowed: true };
  const method = (req.method ?? "GET").toUpperCase();
  if (method === "OPTIONS") return { allowed: true };

  const host = firstHeader(req.headers.host);
  const origin = firstHeader(req.headers.origin);
  // 同源写请求会带 Origin；跨站请求即使能控制 Host 头，Origin 也与本机地址对不上。
  if (origin && host && origin !== `http://${host}` && origin !== `https://${host}`) {
    return { allowed: false, status: 403, reason: "拒绝跨源请求：Origin 与本机服务地址不一致。" };
  }
  if (firstHeader(req.headers["sec-fetch-site"]) === "cross-site") {
    return { allowed: false, status: 403, reason: "拒绝跨站请求：Sec-Fetch-Site 为 cross-site。" };
  }

  const headerToken = firstHeader(req.headers[API_TOKEN_HEADER]);
  const received = headerToken ?? (method === "GET" ? readQueryToken(req.url ?? "") : undefined);
  if (!received || !tokenEquals(received, options.token)) {
    return { allowed: false, status: 401, reason: "缺少或无效的本机接口令牌：请重新启动 LFAA 工作区后再试。" };
  }
  return { allowed: true };
}
