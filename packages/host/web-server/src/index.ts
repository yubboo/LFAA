// @lfaa/web-server：在 Node 环境中装配 bundle、挂载各能力 HTTP 接口并托管 Vite 开发服务器。
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkApiAuth, createApiGateway } from "@lfaa/api-gateway";
import { sandboxLocalPlugin } from "@lfaa/sandbox-local";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Context } from "@deepseek-ai/cordis";
import { createAgentHttpHandler } from "@lfaa/agent";
import { createBrowserHttpHandler } from "@lfaa/browser";
import { webBundlePlugin } from "@lfaa/bundle-web";
import { createChatHttpHandler, createCodingHttpHandler } from "@lfaa/chat";
import { createJobsHttpHandler } from "@lfaa/jobs";
import { createLlmHttpHandler } from "@lfaa/llm";
import { createMemoryHttpHandler } from "@lfaa/memory";
import { createPluginsHttpHandler } from "@lfaa/plugins";
import { createRulesHttpHandler } from "@lfaa/rules";
import { createSectionsHttpHandler } from "@lfaa/sections";
import { createSkillsHttpHandler } from "@lfaa/skills";
import { createSubagentHttpHandler } from "@lfaa/subagent";
import { createWorkspaceHttpHandler } from "@lfaa/workspace";
import { createServer } from "vite";



// 自动向上定位当前 LFAA 项目所在磁盘根目录，不静态写死固定盘符或目录名。
function detectProjectRoot(startDir: string): string {
  let cursor = resolve(startDir);
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(resolve(cursor, "pnpm-workspace.yaml")) || existsSync(resolve(cursor, ".git"))) {
      return cursor;
    }
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return resolve(startDir, "../..");
}

// 启动本机开发服务器，并返回供 CLI 信号处理器调用的幂等关闭函数。
export interface WebServerOptions {
  /** Web 前端根目录（含 index.html 与 vite.config.ts）。 */
  webRoot: string;
}

/** 启动 Web 开发服务器，返回幂等关闭函数。 */
export async function startWeb(options: WebServerOptions): Promise<() => Promise<void>> {
  const appRoot = resolve(options.webRoot);
  const detectedProjectRoot = detectProjectRoot(appRoot);
  // 每次启动生成一次性令牌：只有拿到本进程注入到页面的值才能调用 /api。
  // 这挡住任意网页对 127.0.0.1 的跨站请求，且不进入命令行/日志。
  const apiToken = randomBytes(32).toString("hex");
  const hostContext = new Context();

  // 沙箱先落在根上下文：bundle 内的工具通过父级服务取到判定器。
  const sandboxFiber = hostContext.plugin(sandboxLocalPlugin);
  await sandboxFiber;

  // 装配全部 Host 能力与 Loader：应用层只保留 HTTP 适配与 Vite。
  // Loader 按包名解析插件，基准必须落在「声明了全部可安装插件包」的装配包内；
  // apps/web 只声明前端入口，用它当基准会让 @lfaa/tools 这类插件解析不到。
  const bundleManifest = pathToFileURL(
    resolve(dirname(fileURLToPath(import.meta.resolve("@lfaa/bundle-web"))), "..", "package.json"),
  ).href;
  const bundleFiber = hostContext.plugin(webBundlePlugin, {
    repoRoot: detectedProjectRoot,
    loaderBaseUrl: bundleManifest,
    profile: "web",
  });
  await bundleFiber;

  const handleSectionsRequest = createSectionsHttpHandler(hostContext.sections);
  const handleWorkspaceRequest = createWorkspaceHttpHandler(hostContext.workspace);
  const handleSkillsRequest = createSkillsHttpHandler(hostContext.skills, {
    resolveProjectRoots: async () => {
      const projects = await hostContext.workspace.listProjects();
      const roots = projects
        .flatMap((p) => p.rootPaths ?? (p.rootPath ? [p.rootPath] : []))
        .filter(Boolean);
      return roots.length > 0 ? roots : [detectedProjectRoot];
    },
  });
  const handlePluginsRequest = createPluginsHttpHandler(hostContext.plugins);
  const handleLlmRequest = createLlmHttpHandler(hostContext.llm);
  const handleRulesRequest = createRulesHttpHandler(hostContext.rules);
  const handleMemoryRequest = createMemoryHttpHandler(hostContext.memory, {
    resolveActiveProjectRoot: async (projectId) => {
      if (!projectId) return detectedProjectRoot;
      const projects = await hostContext.workspace.listProjects();
      const matched = projects.find((item) => item.id === projectId);
      return matched?.rootPath || matched?.rootPaths?.[0] || detectedProjectRoot;
    },
  });
  const chatService = hostContext.get("chat");
  if (!chatService) throw new Error("chat 服务未装配，无法提供会话接口。");
  const handleChatRequest = createChatHttpHandler(chatService, {
    resolveSessionPreset: (id) => hostContext.plugins.resolveSessionPreset(id),
    withIdleSession: (sessionId, action) => hostContext.agent.withIdleSession(sessionId, action),
    // 追问建议由模型根据本轮问答生成，不再使用前端模板。
    suggestFollowUps: async ({ userPrompt, assistantReply }) => {
      const output = await hostContext.llm.complete({
        messages: [
          {
            role: "system",
            content: "你是追问建议生成器。根据用户提问与助手回答，给出 3 条用户最可能继续追问的简短问题。只输出 JSON 字符串数组，不要任何解释。",
          },
          {
            role: "user",
            content: `用户提问：${userPrompt.slice(0, 800)}\n\n助手回答：${assistantReply.slice(0, 2000)}`,
          },
        ],
        // 该模型先输出推理再输出正文，200 token 会被推理吃光（finishReason=length），此处放宽。
        maxTokens: 900,
        temperature: 0.7,
      });
      // LlmGenerateOutput 的正文放在 content 字段（不是 text）。
      const text = (output as { content?: string }).content ?? "";
      const start = text.indexOf("[");
      const end = text.lastIndexOf("]");
      if (start < 0 || end <= start) return [];
      let parsed: unknown = [];
      try {
        parsed = JSON.parse(text.slice(start, end + 1));
      } catch {
        return [];
      }
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 3)
        : [];
    },
  });
  const handleCodingRequest = createCodingHttpHandler(chatService, {
    resolveProjectCandidates: async () => {
      const projects = await hostContext.workspace.listProjects();
      return projects
        .map((p) => ({
          rootPath: p.rootPath || p.rootPaths?.[0] || "",
          name: p.name,
          projectId: p.id,
        }))
        .filter((p) => Boolean(p.rootPath));
    },
    resolveTargetRoot: async (projectId) => {
      if (!projectId) return detectedProjectRoot;
      const projects = await hostContext.workspace.listProjects();
      const matched = projects.find((item) => item.id === projectId);
      return matched?.rootPath || matched?.rootPaths?.[0] || detectedProjectRoot;
    },
  });
  const resolveWorkspaceRoots = async (projectId: string | null): Promise<string[]> => {
    if (!projectId) {
      const general = await chatService.getGeneralSettings();
      if (general.outsideProjectFolder) {
        await mkdir(general.outsideProjectFolder, { recursive: true });
        return [general.outsideProjectFolder];
      }
      return [];
    }
    const projects = await hostContext.workspace.listProjects();
    const matched = projects.find((item) => item.id === projectId);
    if (!matched?.exists || !matched.trusted) {
      throw new Error("当前会话绑定的项目不可用，请重新选择已授权的项目目录。");
    }
    const roots = matched.rootPaths?.length ? matched.rootPaths : (matched.rootPath ? [matched.rootPath] : []);
    if (!roots.length) throw new Error("当前会话绑定的项目没有可用工作目录。");
    return roots;
  };
  // 可选服务可能尚未装配（由插件页安装后才出现），处理器惰性创建并在缺失时放行。
  let jobsHandler: ((req: IncomingMessage, res: ServerResponse) => Promise<boolean>) | null = null;
  const handleJobsRequest = async (req: IncomingMessage, res: ServerResponse) => {
    if (!hostContext.jobs) return false;
    jobsHandler ??= createJobsHttpHandler(hostContext.jobs, async (sessionId) => {
      const session = sessionId && sessionId !== "default" ? await hostContext.memory.getSession(sessionId).catch(() => null) : null;
      const roots = await resolveWorkspaceRoots(session?.projectId ?? null).catch(() => []);
      return roots[0] ?? detectedProjectRoot;
    });
    return jobsHandler(req, res);
  };
  let browserHandler: ((req: IncomingMessage, res: ServerResponse) => Promise<boolean>) | null = null;
  const handleBrowserRequest = async (req: IncomingMessage, res: ServerResponse) => {
    if (!hostContext.browser) return false;
    browserHandler ??= createBrowserHttpHandler(hostContext.browser);
    return browserHandler(req, res);
  };
  let subagentHandler: ((req: IncomingMessage, res: ServerResponse) => Promise<boolean>) | null = null;
  const handleSubagentRequest = async (req: IncomingMessage, res: ServerResponse) => {
    if (!hostContext.subagent) return false;
    subagentHandler ??= createSubagentHttpHandler(hostContext.subagent);
    return subagentHandler(req, res);
  };
  const handleAgentRequest = createAgentHttpHandler(hostContext.agent, {
    resolveWorkspaceRoots,
  });

  // 接口边界：所有 Host API 在 api/gateway 中集中登记，顺序有语义。
  const gateway = createApiGateway([
    { id: "sections", handle: handleSectionsRequest },
    { id: "workspace", handle: handleWorkspaceRequest },
    { id: "skills", handle: handleSkillsRequest },
    { id: "plugins", handle: handlePluginsRequest },
    { id: "llm", handle: handleLlmRequest },
    { id: "rules", handle: handleRulesRequest },
    { id: "memory", handle: handleMemoryRequest },
    { id: "coding", handle: handleCodingRequest },
    { id: "chat", handle: handleChatRequest },
    { id: "jobs", handle: handleJobsRequest },
    { id: "browser", handle: handleBrowserRequest },
    { id: "subagent", handle: handleSubagentRequest },
    { id: "agent", handle: handleAgentRequest },
  ]);

  const server = await createServer({
    root: appRoot,
    configFile: resolve(appRoot, "vite.config.ts"),
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
          // 先鉴权再派发：未通过鉴权的请求不会进入任何业务处理器。
          viteServer.middlewares.use((req, res, next) => {
            const decision = checkApiAuth(req, { token: apiToken });
            if (!decision.allowed) {
              res.statusCode = decision.status;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.setHeader("Cache-Control", "no-store");
              res.end(JSON.stringify({ error: decision.reason }));
              return;
            }
            // 路由表集中在 api/gateway 包，顺序即派发顺序；未命中交给 Vite 后续中间件。
            gateway.handle(req, res).then((handled) => {
              if (!handled) next();
            }, next);
          });
        },
      },
    ],
  });

  try {
    await server.listen();
    server.printUrls();
  } catch (error) {
    await server.close();
    await bundleFiber.dispose();
    throw error;
  }

  let isClosed = false;
  return async () => {
    if (isClosed) return;
    isClosed = true;
    await server.close();
    await bundleFiber.dispose();
  };
}
