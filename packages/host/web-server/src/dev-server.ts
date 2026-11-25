// @lfaa/web-server：开发模式宿主：启动 Vite 开发服务器，并把同一套 /api 网关与令牌注入挂到它上面。
// Vite 只在开发模式使用，因此用动态导入引入：生产安装包不含 Vite，静态导入会让桌面端启动即失败。
import { resolve } from "node:path";
import { checkApiAuth, checkApiWriteContentType, isApiPath, type ApiGateway } from "@lfaa/api-gateway";
import type { ViteDevServer } from "vite";
import { detectProjectRoot } from "./detect-root";
import { createHostRuntime } from "./runtime";

/** 开发服务器参数；`projectRoot` 缺省时向上自动探测仓库根。 */
export interface WebServerOptions {
  /** Web 前端根目录（含 index.html 与 vite.config.ts）。 */
  webRoot: string;
  /** 用户工作根；不传则按 webRoot 向上探测（保持既有行为）。 */
  projectRoot?: string;
  /** 启动完成后用系统默认浏览器打开开发地址；缺省关闭，避免后台任务/探针弹窗。 */
  open?: boolean;
}

/** 启动 Web 开发服务器，返回幂等关闭函数。 */
export async function startWeb(options: WebServerOptions): Promise<() => Promise<void>> {
  const appRoot = resolve(options.webRoot);
  const projectRoot = options.projectRoot ?? detectProjectRoot(appRoot);
  const runtime = await createHostRuntime({ projectRoot });

  let server: ViteDevServer;
  try {
    server = await createViteServer(appRoot, runtime.token, runtime.gateway, options.open === true);
    await server.listen();
    server.printUrls();
  } catch (error) {
    await runtime.dispose();
    throw error;
  }

  let isClosed = false;
  return async () => {
    if (isClosed) return;
    isClosed = true;
    await server.close();
    await runtime.dispose();
  };
}

/** 创建 Vite 服务器并挂载鉴权、内容类型校验与网关派发。 */
async function createViteServer(appRoot: string, apiToken: string, gateway: ApiGateway, open: boolean): Promise<ViteDevServer> {
  const { createServer } = await import("vite");
  return createServer({
    root: appRoot,
    configFile: resolve(appRoot, "vite.config.ts"),
    // 交给 Vite 打开浏览器：它按本次真实监听地址（端口被占用时会自动顺延）打开，避免写死 5173。
    server: { open },
    plugins: [
      {
        name: "lfaa-api-token",
        // 把本次启动的令牌注入页面 head：客户端从 meta 读取并附加到 /api 请求。
        apply: "serve",
        transformIndexHtml(html) {
          const meta = `<meta name="lfaa-api-token" content="${apiToken}" />`;
          return html.replace("</head>", `    ${meta}\n  </head>`);
        },
      },
      {
        name: "lfaa-host-apis",
        // 在 Vite 内置 SPA 回退中间件之前挂载核心 Agent/聊天、工作区与分区 Host API。
        configureServer(viteServer) {
          // 非 /api 请求（Vite 前端模块、CSS、资源）直接短路放行，避免每个模块空跑 30 个后端 API 处理器。
          viteServer.middlewares.use((req, res, next) => {
            if (!isApiPath(req.url ?? "/")) {
              next();
              return;
            }
            const decision = checkApiAuth(req, { token: apiToken });
            if (!decision.allowed) {
              res.statusCode = decision.status;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.setHeader("Cache-Control", "no-store");
              res.end(JSON.stringify({ error: decision.reason }));
              return;
            }
            // 写接口统一要求 JSON 请求体，避免表单/文本编码绕过 JSON 解析入口。
            const contentTypeDecision = checkApiWriteContentType(req);
            if (!contentTypeDecision.allowed) {
              res.statusCode = contentTypeDecision.status;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.setHeader("Cache-Control", "no-store");
              res.end(JSON.stringify({ error: contentTypeDecision.reason }));
              return;
            }
            // 路由表集中在运行时里，顺序即派发顺序；未命中的 /api/* 直接返回 404 JSON，避免落进 Vite SPA 返回 HTML。
            gateway.handle(req, res).then((handled) => {
              if (handled) return;
              const rawPath = (req.url ?? "/").split("?")[0] ?? "/";
              if (rawPath === "/api" || rawPath.startsWith("/api/")) {
                res.statusCode = 404;
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.setHeader("Cache-Control", "no-store");
                res.end(JSON.stringify({ error: "未找到本机接口。" }));
                return;
              }
              next();
            }, next);
          });
        },
      },
    ],
  });
}