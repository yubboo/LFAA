// @lfaa/api-gateway：集中登记并派发 Host HTTP 路由，让接口边界从应用与功能包中独立出来。
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
