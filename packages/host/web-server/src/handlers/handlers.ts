// @lfaa/web-server：构造常规能力 HTTP 处理器（工作区、技能、插件、模型、记忆、媒体文件等），并集中提供
// 「工作区根」与「媒体目录允许列表」两个跨处理器复用的解析函数，供 dev 与生产宿主共用。
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import type { ApiHandler } from "@lfaa/api-gateway";
import { createAttachmentHttpHandler } from "@lfaa/attachment-local";
import { createBrowserHttpHandler } from "@lfaa/browser";
import { createCommandsHttpHandler } from "@lfaa/commands";
import { createJobsHttpHandler } from "@lfaa/jobs";
import { createLlmHttpHandler } from "@lfaa/llm";
import { createFeedbackHttpHandler } from "@lfaa/message-feedback";
import { createMemoryHttpHandler, type SessionWorktree } from "@lfaa/memory";
import { createPluginsHttpHandler } from "@lfaa/plugins";
import { createRulesHttpHandler } from "@lfaa/rules";
import { createSectionsHttpHandler } from "@lfaa/sections";
import { createSessionTitleHttpHandler } from "@lfaa/session-title";
import { createSkillsHttpHandler } from "@lfaa/skills";
import { createSubagentHttpHandler } from "@lfaa/subagent";
import { createMediaHttpHandler, createMediaLibraryHttpHandler, createMediaThumbHttpHandler } from "@lfaa/tool-media";
import { createWorkspaceHttpHandler } from "@lfaa/workspace";
import { createWorktreeHttpHandler } from "@lfaa/worktree";

/** 构造常规处理器所需的已装配上下文、默认工作根与会话服务。 */
export interface CommonHandlerDeps {
  context: Context;
  /** 用户工作根：未绑定项目、或目录信息缺失时的回退位置。 */
  projectRoot: string;
  /** 会话服务（启动时已断言存在）。 */
  chatService: Context["chat"];
}

/** 常规能力处理器集合；键名即网关里的路由 id，顺序由 runtime 统一编排。 */
export interface CommonHandlers {
  sections: ApiHandler;
  workspace: ApiHandler;
  /** 工作树接口；工作树插件未装配时直接放行给后续处理器。 */
  worktrees: ApiHandler;
  skills: ApiHandler;
  plugins: ApiHandler;
  llm: ApiHandler;
  rules: ApiHandler;
  memory: ApiHandler;
  feedback: ApiHandler;
  attachments: ApiHandler;
  sessionTitle: ApiHandler;
  commands: ApiHandler;
  mediaFile: ApiHandler;
  mediaLibrary: ApiHandler;
  mediaThumb: ApiHandler;
  /** 工具清单：Agents 页用它渲染工具权限选择。 */
  tools: ApiHandler;
  jobs: ApiHandler;
  browser: ApiHandler;
  subagent: ApiHandler;
  /** 解析会话绑定的工作区根；未绑定项目时退回「项目外聊天目录」。 */
  resolveWorkspaceRoots(projectId: string | null): Promise<string[]>;
  /** 解析会话实际运行根：绑定工作树时用工作树，否则沿用项目根。 */
  resolveSessionWorkspace(sessionId: string): Promise<{ roots: string[]; worktree: SessionWorktree | null }>;
  /** 媒体文件与素材库允许读取的根目录（项目根 + 默认工作根 + 项目外聊天目录）。 */
  resolveMediaAllowedRoots(): Promise<string[]>;
}

/** 创建常规处理器；任何服务缺失都在这里显式失败，不静默降级。 */
export function createCommonHandlers(deps: CommonHandlerDeps): CommonHandlers {
  const { context, projectRoot, chatService } = deps;

  // 未绑定项目时只允许「项目外聊天目录」；绑定项目时要求目录存在且已授权。
  const resolveWorkspaceRoots = async (projectId: string | null): Promise<string[]> => {
    if (!projectId) {
      const general = await chatService.getGeneralSettings();
      if (general.outsideProjectFolder) {
        await mkdir(general.outsideProjectFolder, { recursive: true });
        return [general.outsideProjectFolder];
      }
      return [];
    }
    const projects = await context.workspace.listProjects();
    const matched = projects.find((item) => item.id === projectId);
    if (!matched?.exists || !matched.trusted) {
      throw new Error("当前会话绑定的项目不可用，请重新选择已授权的项目目录。");
    }
    const roots = matched.rootPaths?.length ? matched.rootPaths : (matched.rootPath ? [matched.rootPath] : []);
    if (!roots.length) throw new Error("当前会话绑定的项目没有可用工作目录。");
    return roots;
  };

  // 绑定工作树时必须通过记录与目录双重校验，失效即报错，绝不静默回退项目主目录。
  const resolveSessionWorkspace = async (sessionId: string): Promise<{ roots: string[]; worktree: SessionWorktree | null }> => {
    const session = await context.memory.getSession(sessionId);
    if (!session) throw new Error("找不到聊天会话。");
    const worktree = session.worktree;
    if (!worktree) return { roots: await resolveWorkspaceRoots(session.projectId), worktree: null };
    const status = await context.worktree.get(worktree.id).catch(() => null);
    if (
      !status
      || !status.exists
      || status.path !== worktree.path
      || status.projectId !== worktree.projectId
      || status.repositoryRoot !== worktree.repositoryRoot
    ) {
      throw new Error("会话绑定的工作树不可用（目录缺失或已变更），请解绑或重新创建工作树。");
    }
    return { roots: [worktree.path], worktree };
  };

  // 媒体读取边界：项目根、工作树、默认工作根、统一资料库存储目录（data）与项目外聊天目录。
  const resolveMediaAllowedRoots = async (): Promise<string[]> => {
    const projects = await context.workspace.listProjects().catch(() => []);
    const worktrees = await context.worktree.list().catch(() => []);
    const general = await chatService.getGeneralSettings().catch(() => null);
    return [
      ...projects.flatMap((project) => [project.rootPath, ...(project.rootPaths ?? [])]),
      ...worktrees.map((worktree) => worktree.path),
      projectRoot,
      join(projectRoot, "data"),
      general?.outsideProjectFolder,
    ].filter((root): root is string => Boolean(root && root.trim()));
  };

  // 可选服务可能尚未装配或被热重载替换，缓存按服务实例失效，避免热重载后继续调用已卸载旧实例。
  let cachedWorktree: { service: unknown; handler: ApiHandler } | null = null;
  const worktrees: ApiHandler = async (req, res) => {
    const worktreeService = context.worktree;
    if (!worktreeService) {
      cachedWorktree = null;
      return false;
    }
    if (cachedWorktree?.service !== worktreeService) {
      cachedWorktree = { service: worktreeService, handler: createWorktreeHttpHandler(worktreeService) };
    }
    return cachedWorktree.handler(req, res);
  };

  // 工具清单：供 Agents 页做工具权限选择，直接按注册表的 permissionLevel 标记写入/执行类工具。
  const tools: ApiHandler = async (req, res) => {
    const { pathname } = new URL(req.url ?? "/", "http://127.0.0.1");
    if (pathname !== "/api/tools") return false;
    if (req.method !== "GET") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "工具清单只支持 GET。" }));
      return true;
    }
    const list = context.tools.listDefinitions().map(({ name, description, permissionLevel }) => ({
      name,
      description,
      write: permissionLevel !== "read",
    }));
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ tools: list }));
    return true;
  };

  let cachedJobs: { service: unknown; handler: ApiHandler } | null = null;
  const jobs: ApiHandler = async (req, res) => {
    const jobsService = context.jobs;
    if (!jobsService) {
      cachedJobs = null;
      return false;
    }
    if (cachedJobs?.service !== jobsService) {
      cachedJobs = {
        service: jobsService,
        handler: createJobsHttpHandler(jobsService, async (sessionId) => {
          if (!sessionId || sessionId === "default") return projectRoot;
          const resolved = await resolveSessionWorkspace(sessionId);
          return resolved.roots[0] ?? projectRoot;
        }),
      };
    }
    return cachedJobs.handler(req, res);
  };

  let cachedBrowser: { service: unknown; handler: ApiHandler } | null = null;
  const browser: ApiHandler = async (req, res) => {
    const browserService = context.browser;
    if (!browserService) {
      cachedBrowser = null;
      return false;
    }
    if (cachedBrowser?.service !== browserService) {
      cachedBrowser = {
        service: browserService,
        handler: createBrowserHttpHandler(browserService, {
          pickDownloadFolder: (title, initialDir) => context.workspace.pickLocalFolder(title, initialDir),
        }),
      };
    }
    return cachedBrowser.handler(req, res);
  };

  let cachedSubagent: { service: unknown; handler: ApiHandler } | null = null;
  const subagent: ApiHandler = async (req, res) => {
    const subagentService = context.subagent;
    if (!subagentService) {
      cachedSubagent = null;
      return false;
    }
    if (cachedSubagent?.service !== subagentService) {
      cachedSubagent = { service: subagentService, handler: createSubagentHttpHandler(subagentService) };
    }
    return cachedSubagent.handler(req, res);
  };

  const skills = createSkillsHttpHandler(context.skills, {
    resolveProjectRoots: async () => {
      const projects = await context.workspace.listProjects();
      const roots = projects
        .flatMap((project) => project.rootPaths ?? (project.rootPath ? [project.rootPath] : []))
        .filter(Boolean);
      return roots.length > 0 ? roots : [projectRoot];
    },
  });

  const memory = createMemoryHttpHandler(context.memory, {
    resolveActiveProjectRoot: async (projectId) => {
      if (!projectId) return projectRoot;
      const projects = await context.workspace.listProjects();
      const matched = projects.find((item) => item.id === projectId);
      return matched?.rootPath || matched?.rootPaths?.[0] || projectRoot;
    },
  });

  return {
    sections: createSectionsHttpHandler(context.sections),
    workspace: createWorkspaceHttpHandler(context.workspace),
    worktrees,
    skills,
    plugins: createPluginsHttpHandler(context.plugins),
    llm: createLlmHttpHandler(context.llm),
    rules: createRulesHttpHandler(context.rules),
    memory,
    feedback: createFeedbackHttpHandler(context.feedback),
    attachments: createAttachmentHttpHandler(context.attachment),
    sessionTitle: createSessionTitleHttpHandler(context.sessionTitle),
    commands: createCommandsHttpHandler(context.commands),
    mediaFile: createMediaHttpHandler({ resolveAllowedRoots: resolveMediaAllowedRoots }),
    mediaLibrary: createMediaLibraryHttpHandler({ resolveAllowedRoots: resolveMediaAllowedRoots }),
    mediaThumb: createMediaThumbHttpHandler({ resolveAllowedRoots: resolveMediaAllowedRoots }),
    tools,
    jobs,
    browser,
    subagent,
    resolveWorkspaceRoots,
    resolveSessionWorkspace,
    resolveMediaAllowedRoots,
  };
}