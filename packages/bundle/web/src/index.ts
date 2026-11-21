// @lfaa/bundle-web 装配插件：把 Web Host 的基础能力、Loader 与跨服务联线组合成一个 bundle。
import { type Context, type Plugin } from "@deepseek-ai/cordis";
import { CORE_MODULES, OPTIONAL_MODULES, PRESETS, resolveLegacySessionModules } from "./presets";
import Loader from "@deepseek-ai/cordis-plugin-loader";
import { agentPlugin } from "@lfaa/agent";
import { resolveBash } from "@lfaa/bash-local";
import { browserPlugin } from "@lfaa/browser";
import { chatPlugin } from "@lfaa/chat";
import commandCompactPlugin from "@lfaa/command-compact";
import compactionBasicPlugin from "@lfaa/compaction-basic";
import fsObservationPlugin from "@lfaa/fs-observation-policy";
import { goalPlugin } from "@lfaa/goal";
import { jobsPlugin } from "@lfaa/jobs";
import { llmPlugin } from "@lfaa/llm";
import { memoryPlugin } from "@lfaa/memory";
import { pluginsPlugin } from "@lfaa/plugins";
import planModePlugin from "@lfaa/plan-mode";
import { resolveCmd, resolvePowerShell } from "@lfaa/pwsh-local";
import { rulesPlugin } from "@lfaa/rules";
import sandboxPolicyPlugin from "@lfaa/sandbox-policy";
import { sectionsPlugin } from "@lfaa/sections";
import { shellPlugin } from "@lfaa/shell";
import { skillsPlugin } from "@lfaa/skills";
import spillLocalPlugin from "@lfaa/spill-local";
import systemPromptPlugin from "@lfaa/system-prompt";
import { subagentPlugin } from "@lfaa/subagent";
import timeoutPolicyPlugin from "@lfaa/timeout-policy";
import toolGoalPlugin from "@lfaa/tool-goal";
import toolResultPrunerPlugin from "@lfaa/tool-result-pruner";
import toolSchedulePlugin from "@lfaa/tool-schedule";
import feedbackPlugin from "@lfaa/message-feedback";
import attachmentPlugin from "@lfaa/attachment-local";
import sessionTitlePlugin from "@lfaa/session-title";
import commandsPlugin from "@lfaa/commands";
import mediaToolsPlugin from "@lfaa/tool-media";
import toolTodoPlugin from "@lfaa/tool-todo";
import toolWebPlugin from "@lfaa/tool-web";
import { toolsPlugin } from "@lfaa/tools";
import { webPlugin } from "@lfaa/web";
import httpFetchPlugin from "@lfaa/web-fetch-http";
import { workspacePlugin } from "@lfaa/workspace";

export { CORE_MODULES, OPTIONAL_MODULES } from "./presets";

// 兼容旧引用：静态装配的核心模块集合。
export const WEB_BUNDLE_MODULES = CORE_MODULES;

export interface WebBundleConfig {
  /** 仓库根目录：用于资料库数据根与聊天工作台的项目根。 */
  repoRoot: string;
  /** Loader 的解析基准：必须是声明了全部可安装插件包的装配包内文件（见 web-server 的装配点）。 */
  loaderBaseUrl: string;
  /** 插件 profile 名称，默认 web。 */
  profile?: string;
  /** 本次额外静态装配的可选模块；缺省不装配，交给插件页安装。 */
  optionalModules?: readonly string[];
}

const SHELL_NAMES: Record<string, string> = {
  powershell: "PowerShell",
  cmd: "Windows CMD",
  git_bash: "Git Bash",
  wsl: "WSL Bash",
  native: "Bash",
};

type ShellKind = "powershell" | "cmd" | "git_bash" | "wsl" | "native";
const SHELL_KINDS: readonly ShellKind[] = ["powershell", "cmd", "git_bash", "wsl", "native"];

/** 读取当前设置的 Shell 类型；非法值按平台回退，保证 resolveInvocation 拿到收窄的联合类型。 */
async function currentShellKind(ctx: Context): Promise<ShellKind> {
  if (process.platform !== "win32") return "native";
  // 用 ctx.get 读取：bundle 不能声明 inject "chat"（chat 由本插件挂载，会形成等待死锁）。
  const chat = ctx.get("chat") as { getGeneralSettings: () => Promise<{ integratedShell: string }> } | undefined;
  if (!chat) return "powershell";
  const configured = (await chat.getGeneralSettings()).integratedShell;
  return SHELL_KINDS.includes(configured as ShellKind) ? (configured as ShellKind) : "powershell";
}

/**
 * Web bundle：先装配基础服务，再挂 Loader 与插件管理，最后补齐跨服务联线。
 * 装配顺序有语义：插件管理依赖 Loader，Loader 的 `await` 语义要求基础服务先就位。
 */
export const webBundlePlugin: Plugin.Object<WebBundleConfig> = {
  name: "@lfaa/bundle-web",
  // 沙箱由根上下文提供；声明注入后 bundle 内才能读取判定器并交给工具层。
  inject: ["sandbox"],
  async apply(ctx: Context, config: WebBundleConfig) {
    const profile = config.profile ?? "web";

    const sectionsFiber = ctx.plugin(sectionsPlugin);
    const workspaceFiber = ctx.plugin(workspacePlugin, {
      defaultProjectsDirResolver: async () => {
        const chat = ctx.get("chat") as { getGeneralSettings: () => Promise<{ defaultProjectsFolder: string }> } | undefined;
        if (!chat) return undefined;
        return (await chat.getGeneralSettings()).defaultProjectsFolder;
      },
    });
    const llmFiber = ctx.plugin(llmPlugin);
    const rulesFiber = ctx.plugin(rulesPlugin);
    const memoryFiber = ctx.plugin(memoryPlugin, {
      recommendedProjectDataRoot: `${config.repoRoot}/data`,
    });
    const shellFiber = ctx.plugin(shellPlugin, {
      resolveInvocation: async (command: string, cwd: string) => {
        const kind = await currentShellKind(ctx);
        if (kind === "powershell") return resolvePowerShell(command);
        if (kind === "cmd") return resolveCmd(command);
        return resolveBash(command, cwd, kind);
      },
    });
    // 沙箱判定器由根上下文提供；未装配时工具不做限制（保持既有行为）。
    const sandbox = ctx.sandbox;
    const toolsFiber = ctx.plugin(toolsPlugin, {
      ...(sandbox ? { sandbox } : {}),
      executeCommand: (request) => {
        const shell = ctx.get("shell");
        if (!shell) throw new Error("Shell 服务未装配。");
        return shell.execute(request);
      },
      describeCommandShell: async () => `run_command 的当前 Shell 为 ${SHELL_NAMES[await currentShellKind(ctx)] ?? "Bash"}。请使用该 Shell 的原生命令语法和路径格式。`,
    });
    const skillsFiber = ctx.plugin(skillsPlugin);
    // 网页能力 seam 先于抓取实现挂载，目标服务先于目标工具挂载。
    const webFiber = ctx.plugin(webPlugin);
    const webFetchFiber = ctx.plugin(httpFetchPlugin, {});
    const goalFiber = ctx.plugin(goalPlugin);
    // 待办与目标工具依赖工具注册表，排在 toolsFiber 之后。
    const toolTodoFiber = ctx.plugin(toolTodoPlugin);
    const toolWebFiber = ctx.plugin(toolWebPlugin);
    const toolGoalFiber = ctx.plugin(toolGoalPlugin);
    const toolScheduleFiber = ctx.plugin(toolSchedulePlugin, {});
    // 消息反馈服务只做持久化，不依赖工具注册表。
    const feedbackFiber = ctx.plugin(feedbackPlugin, {});
    // 附件存储依赖工具注册表（read_attachment / list_attachments），排在 tools 之后。
    const attachmentFiber = ctx.plugin(attachmentPlugin, {});
    // 标题服务依赖模型服务，排在 llm 之后。
    const sessionTitleFiber = ctx.plugin(sessionTitlePlugin);
    // 斜杠命令注册表只依赖自身，先于界面装配更稳。
    const commandsFiber = ctx.plugin(commandsPlugin);
    // 媒体生成工具依赖工具注册表与模型服务。
    const mediaToolsFiber = ctx.plugin(mediaToolsPlugin);
    // 执行策略中间件挂在工具注册表之后：写前必读 → 超时兜底 → 计划模式 → 长结果落盘。
    const observationFiber = ctx.plugin(fsObservationPlugin, {});
    const timeoutFiber = ctx.plugin(timeoutPolicyPlugin, {});
    const planModeFiber = ctx.plugin(planModePlugin, {});
    // 精简必须在落盘之前：先把常规噪声与超长片段压掉，真正超大的再由 spill 落盘。
    const prunerFiber = ctx.plugin(toolResultPrunerPlugin, {});
    const spillFiber = ctx.plugin(spillLocalPlugin, {});
    // 压缩服务要先于 agent 挂载，agent 启动运行时才能拿到 ctx.compaction。
    const compactionFiber = ctx.plugin(compactionBasicPlugin, {});
    // 提示词服务必须在 agent 之前挂载，运行开局才能合成插件段落。
    const promptFiber = ctx.plugin(systemPromptPlugin);
    const compactCommandFiber = ctx.plugin(commandCompactPlugin);
    const sandboxPolicyFiber = ctx.plugin(sandboxPolicyPlugin, {});
    await Promise.all([sectionsFiber, workspaceFiber, llmFiber, rulesFiber, memoryFiber, shellFiber, toolsFiber, skillsFiber, webFiber, webFetchFiber, goalFiber, toolTodoFiber, toolWebFiber, toolGoalFiber, toolScheduleFiber, feedbackFiber, attachmentFiber, sessionTitleFiber, commandsFiber, mediaToolsFiber, observationFiber, timeoutFiber, planModeFiber, prunerFiber, spillFiber, compactionFiber, promptFiber, compactCommandFiber, sandboxPolicyFiber]);

    const loaderFiber = ctx.plugin(Loader, { baseUrl: config.loaderBaseUrl });
    await loaderFiber;

    // 可选模块在 bundle 主体挂载：服务可见性由 bundle 的祖先链决定，
    // 下沉到子插件会让子插件看不到 chat/agent 等服务（曾导致 chat 报 without inject）。
    const mountedOptional: string[] = [];
    const optionalFibers: Array<PromiseLike<unknown>> = [];
    if (OPTIONAL_MODULES.includes("@lfaa/jobs")) {
      mountedOptional.push("@lfaa/jobs");
      optionalFibers.push(ctx.plugin(jobsPlugin, {
        resolveInvocation: (command: string, cwd: string) => {
          const shell = ctx.get("shell");
          if (!shell) throw new Error("Shell 服务未装配。");
          return shell.resolveInvocation(command, cwd);
        },
      }));
    }
    if (OPTIONAL_MODULES.includes("@lfaa/browser")) {
      mountedOptional.push("@lfaa/browser");
      optionalFibers.push(ctx.plugin(browserPlugin));
    }
    if (OPTIONAL_MODULES.includes("@lfaa/subagent")) {
      mountedOptional.push("@lfaa/subagent");
      optionalFibers.push(ctx.plugin(subagentPlugin));
    }

    const providedModules = [...CORE_MODULES, ...mountedOptional];
    const pluginsFiber = ctx.plugin(pluginsPlugin, { profile, providedModules, repoRoot: config.repoRoot, presets: PRESETS });
    const agentFiber = ctx.plugin(agentPlugin, { resolveSessionModules: resolveLegacySessionModules });
    const chatFiber = ctx.plugin(chatPlugin, { repoRoot: config.repoRoot });
    await Promise.all([pluginsFiber, agentFiber, chatFiber, ...optionalFibers]);

    // 跨服务联线放到独立子插件里：Cordis 的服务可见性按 fiber 祖先链解析，
    // bundle 自身访问不了它挂载的子服务，必须由声明了 inject 的子插件完成。
    await ctx.plugin(WIRING_PLUGIN);
  },
};

/** 联线插件：把插件、技能、Agent、分区与记忆之间的依赖接上。 */
const WIRING_PLUGIN: Plugin.Object<void> = {
  name: "@lfaa/bundle-wiring",
  inject: ["plugins", "skills", "agent", "workspace", "sections", "memory"],
  async apply(ctx: Context) {
    ctx.plugins.setSkillRegistrar((pluginId, list) => ctx.skills.registerPluginSkills(pluginId, list));
    await ctx.plugins.restoreEnabledPlugins();

    ctx.effect(() => ctx.agent.setSkillResolver(async (skillIds: string[], roots: string[]) => {
      const resolvedRoots = roots.length > 0
        ? roots
        : (await ctx.workspace.listProjects())
            .flatMap((project) => project.rootPaths ?? (project.rootPath ? [project.rootPath] : []))
            .filter(Boolean);
      return ctx.skills.resolveSkillsForRun(skillIds, resolvedRoots);
    }));

    ctx.effect(() => ctx.agent.setSkillCatalogProvider(async (roots: string[]) => {
      const list = await ctx.skills.listSkills({ projectRoots: roots, includeDisabled: false });
      return list.map((skill) => ({
        id: skill.id,
        name: skill.name,
        source: skill.source,
        description: skill.description,
      }));
    }));

    ctx.effect(() => ctx.sections.onSectionRemoved((sectionId: string) => ctx.workspace.clearSection(sectionId)));

    const reconciled = await ctx.memory.reconcileInterruptedRuns().catch((error: unknown) => {
      console.warn("结算上次中断运行时出错：", error);
      return null;
    });
    if (reconciled && (reconciled.messages > 0 || reconciled.tmpRemoved > 0)) {
      console.info(`[agent] 已结算中断运行：${reconciled.messages} 条消息，清理 ${reconciled.tmpRemoved} 个临时文件`);
    }
  },
};

/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default webBundlePlugin;
