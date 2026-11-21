// @lfaa/web-server：构造常规能力 HTTP 处理器（工作区、技能、插件、模型、记忆、媒体文件等），并集中提供
// 「工作区根」与「媒体目录允许列表」两个跨处理器复用的解析函数，供 dev 与生产宿主共用。
import { mkdir } from "node:fs/promises";
import type { Context } from "@deepseek-ai/cordis";
import type { ApiHandler } from "@lfaa/api-gateway";
import { createAttachmentHttpHandler } from "@lfaa/attachment-local";
import { createBrowserHttpHandler } from "@lfaa/browser";
import { createCommandsHttpHandler } from "@lfaa/commands";
import { createJobsHttpHandler } from "@lfaa/jobs";
import { createLlmHttpHandler } from "@lfaa/llm";
import { createFeedbackHttpHandler } from "@lfaa/message-feedback";
import { createMemoryHttpHandler } from "@lfaa/memory";
import { createPluginsHttpHandler } from "@lfaa/plugins";
import { createRulesHttpHandler } from "@lfaa/rules";
import { createSectionsHttpHandler } from "@lfaa/sections";
import { createSessionTitleHttpHandler } from "@lfaa/session-title";
import { createSkillsHttpHandler } from "@lfaa/skills";
import { createSubagentHttpHandler } from "@lfaa/subagent";
import { createMediaHttpHandler, createMediaLibraryHttpHandler } from "@lfaa/tool-media";
import { createWorkspaceHttpHandler } from "@lfaa/workspace";

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
  jobs: ApiHandler;
  browser: ApiHandler;
  subagent: ApiHandler;
  /** 解析会话绑定的工作区根；未绑定项目时退回「项目外聊天目录」。 */
  resolveWorkspaceRoots(projectId: string | null): Promise<string[]>;
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

  // 媒体读取边界：项目根、已存在项目根、默认工作根与项目外聊天目录。
  const resolveMediaAllowedRoots = async (): Promise<string[]> => {
    const projects = await context.workspace.listProjects().catch(() => []);
    const general = await chatService.getGeneralSettings().catch(() => null);
    return [...projects.flatMap((project) => [project.rootPath, ...(project.rootPaths ?? [])]), projectRoot, general?.outsideProjectFolder]
      .filter((root): root is string => Boolean(root && root.trim()));
  };

  // 可选服务可能尚未装配（由插件页安装后才出现），处理器惰性创建并在缺失时放行。
  let jobsHandler: ApiHandler | null = null;
  const jobs: ApiHandler = async (req, res) => {
    const jobsService = context.jobs;
    if (!jobsService) return false;
    jobsHandler ??= createJobsHttpHandler(jobsService, async (sessionId) => {
      const session = sessionId && sessionId !== "default" ? await context.memory.getSession(sessionId).catch(() => null) : null;
      const roots = await resolveWorkspaceRoots(session?.projectId ?? null).catch(() => []);
      return roots[0] ?? projectRoot;
    });
    return jobsHandler(req, res);
  };

  let browserHandler: ApiHandler | null = null;
  const browser: ApiHandler = async (req, res) => {
    const browserService = context.browser;
    if (!browserService) return false;
    browserHandler ??= createBrowserHttpHandler(browserService);
    return browserHandler(req, res);
  };

  let subagentHandler: ApiHandler | null = null;
  const subagent: ApiHandler = async (req, res) => {
    const subagentService = context.subagent;
    if (!subagentService) return false;
    subagentHandler ??= createSubagentHttpHandler(subagentService);
    return subagentHandler(req, res);
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
    jobs,
    browser,
    subagent,
    resolveWorkspaceRoots,
    resolveMediaAllowedRoots,
  };
}