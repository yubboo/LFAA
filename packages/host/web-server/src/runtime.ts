// @lfaa/web-server：装配 Host 运行时（沙箱、bundle、各能力处理器与统一网关），并生成一次性接口令牌。
// dev（Vite）与生产（静态托管）都复用同一个运行时，保证两边的接口面与行为完全一致。
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Context } from "@deepseek-ai/cordis";
import { createApiGateway, type ApiGateway } from "@lfaa/api-gateway";
import { createAgentProfileHttpHandler } from "@lfaa/agent-profile";
import { createGroupHttpHandler, buildPlanPrompt } from "@lfaa/agent-group";
import { createRoutedLlm } from "@lfaa/agent-profile";
import { webBundlePlugin } from "@lfaa/bundle-web";
import { createGoalHttpHandler } from "@lfaa/goal";
import { createHandoffHttpHandler } from "@lfaa/handoff";
import { createMcpHttpHandler } from "@lfaa/mcp";
import { sandboxLocalPlugin } from "@lfaa/sandbox";
import { createAgentHandlers } from "./handlers/handlers-chat";
import { createCommonHandlers } from "./handlers/handlers";
import { createBackgroundsHttpHandler } from "./handlers/handlers-backgrounds";
import { createNotificationSoundsHttpHandler } from "./handlers/handlers-notifications";
import { createDesktopDownloadReceiver } from "./desktop-downloads";

/** 装配运行时所需参数。 */
export interface HostRuntimeOptions {
  /** 用户工作根：项目未绑定时的回退根，绝不传安装目录。 */
  projectRoot: string;
  /** Loader 解析基准；缺省按 @lfaa/bundle-web 的 package.json 推导。 */
  loaderBaseUrl?: string;
  /** 插件 profile 名称，默认 web。 */
  profile?: string;
  desktopDownloadDirectory?: string;
}

/** 已装配的 Host 运行时；`dispose` 幂等，关闭顺序与装配顺序相反。 */
export interface HostRuntime {
  /** 本进程启动时生成的一次性接口令牌。 */
  token: string;
  gateway: ApiGateway;
  receiveDesktopDownload?: ReturnType<typeof createDesktopDownloadReceiver>;
  dispose(): Promise<void>;
}

// Loader 按包名解析插件，基准必须落在声明了全部可安装插件包的装配包内；
// apps/web 只声明前端入口，用它当基准会让 @lfaa/tools 这类插件解析不到。
export function resolveLoaderBaseUrl(): string {
  return pathToFileURL(
    resolve(dirname(fileURLToPath(import.meta.resolve("@lfaa/bundle-web"))), "..", "package.json"),
  ).href;
}

/** 装配运行时：沙箱先落根上下文，再挂 bundle 与处理器，最后生成网关。 */
export async function createHostRuntime(options: HostRuntimeOptions): Promise<HostRuntime> {
  // 每次启动生成一次性令牌：只有拿到本进程注入到页面的值才能调用 /api。
  // 这挡住任意网页对 127.0.0.1 的跨站请求，且不进入命令行/日志。
  const token = randomBytes(32).toString("hex");
  const hostContext = new Context();

  // 沙箱先落在根上下文：bundle 内的工具通过父级服务取到判定器。
  const sandboxFiber = hostContext.plugin(sandboxLocalPlugin);
  await sandboxFiber;

  const bundleFiber = hostContext.plugin(webBundlePlugin, {
    repoRoot: options.projectRoot,
    loaderBaseUrl: options.loaderBaseUrl ?? resolveLoaderBaseUrl(),
    profile: options.profile ?? "web",
  });
  await bundleFiber;

  const chatService = hostContext.get("chat");
  if (!chatService) throw new Error("chat 服务未装配，无法提供会话接口。");
  const goalService = hostContext.get("goal");
  const goalHandler = goalService ? createGoalHttpHandler(goalService) : null;
  // agent 定义与模型绑定：P1 起由 bundle 装配，接口在这里登记。
  const agentProfileService = hostContext.get("agentProfile");
  const agentProfileHandler = agentProfileService ? createAgentProfileHttpHandler(agentProfileService) : null;
  const handoffService = hostContext.get("handoff");
  const memoryService = hostContext.get("memory");
  const handoffHandler = handoffService && memoryService
    ? createHandoffHttpHandler(handoffService, memoryService, goalService)
    : null;
  const reviewService = hostContext.get("review");
  if (!reviewService) throw new Error("review 服务未装配，无法提供 Git 与代码审查接口。");

  const common = createCommonHandlers({ context: hostContext, projectRoot: options.projectRoot, chatService });
  // 群聊回合：串行编排多个 agent，依赖 agent 服务的 startRun/waitForRun；
  // 代理人调度走 agentProfile 的绑定派发，用一次小请求出「本轮发言计划」。
  const agentService = hostContext.get("agent");
  const llmService = hostContext.get("llm");
  const groupHandler = agentService && memoryService
    ? createGroupHttpHandler({
        memory: memoryService,
        agent: agentService,
        ...(agentProfileService ? {
          describeMembers: async (ids) => {
            const agents = await agentProfileService.listAgents();
            return ids.map((id) => {
              const agent = agents.find((item) => item.id === id);
              return {
                id,
                name: agent?.name ?? id,
                ...(agent?.description ? { description: agent.description } : {}),
              };
            });
          },
          ...(llmService ? {
            plan: async ({ hostAgentId, userMessage, members, maxSpeakers }) => {
              const routed = createRoutedLlm({ llm: llmService, bindings: agentProfileService, agentId: hostAgentId });
              const output = await routed.complete({
                messages: [{ role: "user", content: buildPlanPrompt({ userMessage, members, maxSpeakers }) }],
                maxTokens: 2048,
                reasoningEffort: "low",
                temperature: 0.2,
              });
              return output.content.trim() || output.reasoningContent?.trim() || "";
            },
          } : {}),
        } : {}),
      })
    : null;
  const sessions = createAgentHandlers({
    context: hostContext,
    projectRoot: options.projectRoot,
    chatService,
    reviewService,
    resolveWorkspaceRoots: common.resolveWorkspaceRoots,
    resolveSessionWorkspace: common.resolveSessionWorkspace,
  });
  const notificationSounds = createNotificationSoundsHttpHandler();
  const backgrounds = createBackgroundsHttpHandler();

  // 接口边界：所有 Host API 在此集中登记，顺序有语义（具体路由先于宽泛路由）。
  const gateway = createApiGateway([
    { id: "sections", handle: common.sections },
    { id: "workspace", handle: common.workspace },
    { id: "worktrees", handle: common.worktrees },
    { id: "skills", handle: common.skills },
    { id: "mcp", handle: createMcpHttpHandler(hostContext.mcp) },
    { id: "plugins", handle: common.plugins },
    { id: "llm", handle: common.llm },
    { id: "rules", handle: common.rules },
    { id: "memory", handle: common.memory },
    { id: "tools", handle: common.tools },
    { id: "feedback", handle: common.feedback },
    { id: "attachments", handle: common.attachments },
    { id: "session-title", handle: common.sessionTitle },
    { id: "commands", handle: common.commands },
    { id: "media", handle: common.mediaFile },
    { id: "media-library", handle: common.mediaLibrary },
    { id: "media-thumb", handle: common.mediaThumb },
    { id: "media-generate", handle: sessions.mediaGenerate },
    { id: "media-plan", handle: sessions.mediaPlan },
    { id: "coding", handle: sessions.coding },
    { id: "notification-sounds", handle: notificationSounds },
    { id: "backgrounds", handle: backgrounds },
    ...(goalHandler ? [{ id: "goal", handle: goalHandler }] : []),
    ...(handoffHandler ? [{ id: "handoffs", handle: handoffHandler }] : []),
    ...(agentProfileHandler ? [{ id: "agent-profile", handle: agentProfileHandler }] : []),
    ...(groupHandler ? [{ id: "group", handle: groupHandler }] : []),
    { id: "chat", handle: sessions.chat },
    { id: "jobs", handle: common.jobs },
    { id: "browser", handle: common.browser },
    { id: "subagent", handle: common.subagent },
    { id: "agent", handle: sessions.agent },
  ]);

  let disposed = false;
  return {
    token,
    gateway,
    ...(options.desktopDownloadDirectory ? {
      receiveDesktopDownload: createDesktopDownloadReceiver(options.desktopDownloadDirectory, () => hostContext.get("browser")),
    } : {}),
    async dispose() {
      if (disposed) return;
      disposed = true;
      await bundleFiber.dispose();
      await sandboxFiber.dispose();
    },
  };
}