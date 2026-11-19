// 在 Node 环境中创建 Host Cordis 上下文与 Vite Web 服务，装配工作区与分区 API 并在关闭时清理生命周期。
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Context } from "@deepseek-ai/cordis";
import { agentPlugin, createAgentHttpHandler } from "@lfaa/agent";
import { resolveBash } from "@lfaa/bash-local";
import { browserPlugin, createBrowserHttpHandler } from "@lfaa/browser";
import { chatPlugin, createChatHttpHandler, createCodingHttpHandler } from "@lfaa/chat";
import { createJobsHttpHandler, jobsPlugin } from "@lfaa/jobs";
import { createLlmHttpHandler, llmPlugin } from "@lfaa/llm";
import { createMemoryHttpHandler, memoryPlugin } from "@lfaa/memory";
import { createPluginsHttpHandler, pluginsPlugin } from "@lfaa/plugins";
import { resolveCmd, resolvePowerShell } from "@lfaa/pwsh-local";
import { createRulesHttpHandler, rulesPlugin } from "@lfaa/rules";
import { createSectionsHttpHandler, sectionsPlugin } from "@lfaa/sections";
import { shellPlugin } from "@lfaa/shell";
import { createSkillsHttpHandler, skillsPlugin } from "@lfaa/skills";
import { createSubagentHttpHandler, subagentPlugin } from "@lfaa/subagent";
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
  const getShellKind = async () => process.platform === "win32"
    ? (await hostContext.chat.getGeneralSettings()).integratedShell : "native" as const;
  const shellNames = { powershell: "PowerShell", cmd: "Windows CMD", git_bash: "Git Bash", wsl: "WSL Bash", native: "Bash" };
  const shellFiber = hostContext.plugin(shellPlugin, {
    resolveInvocation: async (command, cwd) => {
      const shellKind = await getShellKind();
      if (shellKind === "powershell") return resolvePowerShell(command);
      if (shellKind === "cmd") return resolveCmd(command);
      return resolveBash(command, cwd, shellKind);
    },
  });
  const toolsFiber = hostContext.plugin(toolsPlugin, {
    executeCommand: (request) => hostContext.shell.execute(request),
    describeCommandShell: async () => `run_command 的当前 Shell 为 ${shellNames[await getShellKind()]}。请使用该 Shell 的原生命令语法和路径格式。`,
  });
  const skillsFiber = hostContext.plugin(skillsPlugin);
  await Promise.all([sectionsFiber, workspaceFiber, llmFiber, rulesFiber, memoryFiber, shellFiber, toolsFiber, skillsFiber]);

  const pluginsFiber = hostContext.plugin(pluginsPlugin, { profile: "web" });
  const jobsFiber = hostContext.plugin(jobsPlugin, {
    resolveInvocation: (command, cwd) => hostContext.shell.resolveInvocation(command, cwd),
  });
  const browserFiber = hostContext.plugin(browserPlugin);
  const agentFiber = hostContext.plugin(agentPlugin);
  const subagentFiber = hostContext.plugin(subagentPlugin);
  const chatFiber = hostContext.plugin(chatPlugin, { repoRoot: detectedProjectRoot });
  await Promise.all([pluginsFiber, jobsFiber, browserFiber, agentFiber, subagentFiber, chatFiber]);

  hostContext.plugins.setSkillRegistrar((pluginId, list) => hostContext.skills.registerPluginSkills(pluginId, list));
  await hostContext.plugins.restoreEnabledPlugins();
  const offSkillResolver = hostContext.agent.setSkillResolver(async (skillIds, roots) => {
    const resolvedRoots = roots.length > 0
      ? roots
      : (await hostContext.workspace.listProjects())
          .flatMap((p) => p.rootPaths ?? (p.rootPath ? [p.rootPath] : []))
          .filter(Boolean);
    return hostContext.skills.resolveSkillsForRun(skillIds, resolvedRoots);
  });
  const offSkillCatalog = hostContext.agent.setSkillCatalogProvider(async (roots) => {
    const list = await hostContext.skills.listSkills({ projectRoots: roots, includeDisabled: false });
    return list.map((s) => ({ id: s.id, name: s.name, source: s.source, description: s.description }));
  });

  // 应用启动时结算上次退出遗留的流式消息与临时文件，避免界面一直显示“生成中”。
  const reconciled = await hostContext.memory.reconcileInterruptedRuns().catch((error: unknown) => {
    console.warn("结算上次中断运行时出错：", error);
    return null;
  });
  if (reconciled && (reconciled.messages > 0 || reconciled.tmpRemoved > 0)) {
    console.info(`[agent] 已结算中断运行：${reconciled.messages} 条消息，清理 ${reconciled.tmpRemoved} 个临时文件`);
  }

  const offSectionRemoved = hostContext.sections.onSectionRemoved((sectionId) =>
    hostContext.workspace.clearSection(sectionId),
  );
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
  const handleChatRequest = createChatHttpHandler(hostContext.chat, {
    withIdleSession: (sessionId, action) => hostContext.agent.withIdleSession(sessionId, action),
  });
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
  const resolveWorkspaceRoots = async (projectId: string | null): Promise<string[]> => {
    if (!projectId) {
      const general = await hostContext.chat.getGeneralSettings();
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
  const handleJobsRequest = createJobsHttpHandler(hostContext.jobs, async (sessionId) => {
    const session = sessionId && sessionId !== "default" ? await hostContext.memory.getSession(sessionId).catch(() => null) : null;
    const roots = await resolveWorkspaceRoots(session?.projectId ?? null).catch(() => []);
    return roots[0] ?? detectedProjectRoot;
  });
  const handleBrowserRequest = createBrowserHttpHandler(hostContext.browser);
  const handleSubagentRequest = createSubagentHttpHandler(hostContext.subagent);
  const handleAgentRequest = createAgentHttpHandler(hostContext.agent, {
    resolveWorkspaceRoots,
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
              if (await handleSkillsRequest(req, res)) return;
              if (await handlePluginsRequest(req, res)) return;
              if (await handleLlmRequest(req, res)) return;
              if (await handleRulesRequest(req, res)) return;
              if (await handleMemoryRequest(req, res)) return;
              if (await handleCodingRequest(req, res)) return;
              if (await handleChatRequest(req, res)) return;
              if (await handleJobsRequest(req, res)) return;
              if (await handleBrowserRequest(req, res)) return;
              if (await handleSubagentRequest(req, res)) return;
              if (await handleAgentRequest(req, res)) return;
              next();
            })().catch(next);
          });
        },
      },
    ],
  });

  const disposeFibers = async () => {
    offSkillResolver();
    offSkillCatalog();
    await chatFiber.dispose();
    await subagentFiber.dispose();
    await agentFiber.dispose();
    await browserFiber.dispose();
    await jobsFiber.dispose();
    await pluginsFiber.dispose();
    await skillsFiber.dispose();
    await toolsFiber.dispose();
    await shellFiber.dispose();
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
