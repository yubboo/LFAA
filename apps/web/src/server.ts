// 在 Node 环境中创建 Host Cordis 上下文与 Vite Web 服务，装配工作区与分区 API 并在关闭时清理生命周期。
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Context } from "@deepseek-ai/cordis";
import { agentPlugin, createAgentHttpHandler } from "@lfaa/agent";
import { chatPlugin, createChatHttpHandler, createCodingHttpHandler } from "@lfaa/chat";
import { createLlmHttpHandler, llmPlugin } from "@lfaa/llm";
import { createMemoryHttpHandler, memoryPlugin } from "@lfaa/memory";
import { createRulesHttpHandler, rulesPlugin } from "@lfaa/rules";
import { createSectionsHttpHandler, sectionsPlugin } from "@lfaa/sections";
import { toolsPlugin } from "@lfaa/tools";
import { createWorkspaceHttpHandler, workspacePlugin } from "@lfaa/workspace";
import { createServer } from "vite";

const appRoot = fileURLToPath(new URL("../", import.meta.url));

// 自动向上定位当前 LFAA 项目所在磁盘根目录，不静态写死固定盘符或目录名。
function detectAppProjectRoot(startDir: string): string {
  let cursor = resolve(startDir);
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(resolve(cursor, "pnpm-workspace.yaml")) || existsSync(resolve(cursor, ".git"))) {
      return cursor;
    }
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return resolve(appRoot, "../..");
}

// 启动本机开发服务器，并返回供 CLI 信号处理器调用的幂等关闭函数。
export async function startWeb(): Promise<() => Promise<void>> {
  const detectedProjectRoot = detectAppProjectRoot(appRoot);
  const hostContext = new Context();
  const sectionsFiber = hostContext.plugin(sectionsPlugin);
  const workspaceFiber = hostContext.plugin(workspacePlugin, {
    defaultProjectsDirResolver: async () => {
      const chatSvc = (hostContext as { chat?: { getGeneralSettings: () => Promise<{ defaultProjectsFolder: string }> } }).chat;
      if (!chatSvc) return undefined;
      const cfg = await chatSvc.getGeneralSettings();
      return cfg.defaultProjectsFolder;
    },
  });
  const llmFiber = hostContext.plugin(llmPlugin);
  const rulesFiber = hostContext.plugin(rulesPlugin);
  const memoryFiber = hostContext.plugin(memoryPlugin, {
    recommendedProjectDataRoot: resolve(detectedProjectRoot, "data"),
  });
  const toolsFiber = hostContext.plugin(toolsPlugin);
  await Promise.all([sectionsFiber, workspaceFiber, llmFiber, rulesFiber, memoryFiber, toolsFiber]);

  const agentFiber = hostContext.plugin(agentPlugin);
  const chatFiber = hostContext.plugin(chatPlugin, { repoRoot: detectedProjectRoot });
  await Promise.all([agentFiber, chatFiber]);

  const offSectionRemoved = hostContext.sections.onSectionRemoved((sectionId) =>
    hostContext.workspace.clearSection(sectionId),
  );
  const handleSectionsRequest = createSectionsHttpHandler(hostContext.sections);
  const handleWorkspaceRequest = createWorkspaceHttpHandler(hostContext.workspace);
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
  const handleChatRequest = createChatHttpHandler(hostContext.chat);
  const handleCodingRequest = createCodingHttpHandler(hostContext.chat, {
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
  const handleAgentRequest = createAgentHttpHandler(hostContext.agent, {
    resolveWorkspaceRoots: async (projectId) => {
      if (!projectId) {
        const general = await hostContext.chat.getGeneralSettings();
        if (general.outsideProjectFolder) {
          await mkdir(general.outsideProjectFolder, { recursive: true }).catch(() => {});
          return [general.outsideProjectFolder];
        }
        return [];
      }
      const projects = await hostContext.workspace.listProjects();
      const matched = projects.find((item) => item.id === projectId);
      if (!matched) return [];
      return matched.rootPaths?.length ? matched.rootPaths : (matched.rootPath ? [matched.rootPath] : []);
    },
  });

  const server = await createServer({
    root: appRoot,
    configFile: resolve(appRoot, "vite.config.ts"),
    plugins: [
      {
        name: "lfaa-host-apis",
        // 在 Vite 内置 SPA 回退中间件之前挂载核心 Agent/聊天、工作区与分区 Host API。
        configureServer(viteServer) {
          viteServer.middlewares.use((req, res, next) => {
            void (async () => {
              if (await handleSectionsRequest(req, res)) return;
              if (await handleWorkspaceRequest(req, res)) return;
              if (await handleLlmRequest(req, res)) return;
              if (await handleRulesRequest(req, res)) return;
              if (await handleMemoryRequest(req, res)) return;
              if (await handleCodingRequest(req, res)) return;
              if (await handleChatRequest(req, res)) return;
              if (await handleAgentRequest(req, res)) return;
              next();
            })().catch(next);
          });
        },
      },
    ],
  });

  const disposeFibers = async () => {
    await chatFiber.dispose();
    await agentFiber.dispose();
    await toolsFiber.dispose();
    await memoryFiber.dispose();
    await rulesFiber.dispose();
    await llmFiber.dispose();
    await workspaceFiber.dispose();
    await sectionsFiber.dispose();
  };

  try {
    await server.listen();
    server.printUrls();
  } catch (error) {
    offSectionRemoved();
    await server.close();
    await disposeFibers();
    throw error;
  }

  let isClosed = false;
  return async () => {
    if (isClosed) return;
    isClosed = true;
    offSectionRemoved();
    await server.close();
    await disposeFibers();
  };
}
