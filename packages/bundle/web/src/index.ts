// @lfaa/bundle-web 装配插件：把 Web Host 的插件改成 Cordis Loader 条目，Loader 与插件管理在这里组合成 bundle。
import { type Context, type Plugin } from "@deepseek-ai/cordis";
import { CORE_MODULES, OPTIONAL_MODULES, PRESETS, resolveLegacySessionModules } from "./presets";
import Loader from "@deepseek-ai/cordis-plugin-loader";
import { resolveBash, resolveCmd, resolvePowerShell } from "@lfaa/shell";
// 类型侧引入：Loader 按包名装载，插件对 Context 的服务声明只在各包内可见。
import type {} from "@lfaa/agent";
import type {} from "@lfaa/browser";
import type {} from "@lfaa/chat";
import type {} from "@lfaa/commands";
import type {} from "@lfaa/connectors";
import type {} from "@lfaa/crew";
import type {} from "@lfaa/fs-observation-policy";
import type {} from "@lfaa/handoff";
import type {} from "@lfaa/jobs";
import type {} from "@lfaa/llm";
import type {} from "@lfaa/mcp";
import type {} from "@lfaa/memory";
import type {} from "@lfaa/message-feedback";
import type {} from "@lfaa/plan-mode";
import type {} from "@lfaa/plugins";
import type {} from "@lfaa/review";
import type {} from "@lfaa/rules";
import type {} from "@lfaa/sandbox";
import type {} from "@lfaa/sections";
import type {} from "@lfaa/session-title";
import type {} from "@lfaa/skills";
import type {} from "@lfaa/spill-local";
import type {} from "@lfaa/subagent";
import type {} from "@lfaa/system-prompt";
import type {} from "@lfaa/terminal";
import type {} from "@lfaa/timeout-policy";
import type {} from "@lfaa/tool-media";
import type {} from "@lfaa/canvas";
import type {} from "@lfaa/tool-schedule";
import type {} from "@lfaa/tool-todo";
import type {} from "@lfaa/tools";
import type {} from "@lfaa/workspace";
import type {} from "@lfaa/worktree";

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

/** 一个 Loader 条目的声明：id 稳定，模块名即包名。 */
interface LoaderMount {
  id: string;
  module: string;
  config?: unknown;
}

/** 由 bundle 直接挂载、但不在模式预设里的模块：清单里同样属于「已装配」。 */
const DIRECT_MODULES: readonly string[] = ["@lfaa/agent-profile", "@lfaa/handoff", "@lfaa/worktree"];

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
  // 用 ctx.get 读取：chat 由 Loader 装配，bundle 只能按运行时读取。
  const chat = ctx.get("chat") as { getGeneralSettings: () => Promise<{ integratedShell: string }> } | undefined;
  if (!chat) return "powershell";
  const configured = (await chat.getGeneralSettings()).integratedShell;
  return SHELL_KINDS.includes(configured as ShellKind) ? (configured as ShellKind) : "powershell";
}

/**
 * Web bundle：先挂 Loader，再按依赖顺序创建条目，最后补齐跨服务联线。
 * 单插件包走 Loader（因此可被停用、可读真实 Fiber 相位）；多插件包暂留静态装配。
 */
export const webBundlePlugin: Plugin.Object<WebBundleConfig> = {
  name: "@lfaa/bundle-web",
  // 沙箱由根上下文提供；声明注入后 bundle 内才能读取判定器并交给工具层。
  inject: ["sandbox"],
  async apply(ctx: Context, config: WebBundleConfig) {
    const profile = config.profile ?? "web";

    const loaderFiber = ctx.plugin(Loader, { baseUrl: config.loaderBaseUrl });
    await loaderFiber;
    // 服务在 Loader 自己的 fiber 上：从它的 ctx 访问，避免 bundle 声明 loader 注入导致自等待。
    const loaderCtx = loaderFiber.ctx;

    const mounts: Promise<string>[] = [];
    // Loader 的类型把 id 标成可选生成，但运行时会采用传入的稳定 id（ensureId 只补缺省值）。
    const createEntry = loaderCtx.loader.create.bind(loaderCtx.loader) as (options: {
      id: string;
      name: string;
      config?: unknown;
    }) => Promise<string>;
    const mount = ({ id, module, config: entryConfig }: LoaderMount): void => {
      mounts.push(createEntry({
        id,
        name: module,
        ...(entryConfig === undefined ? {} : { config: entryConfig }),
      }));
    };

    mount({ id: "sections", module: "@lfaa/sections" });
    // 目录解析器、命令方言、执行器都改由联线插件在装配完成后注入，配置本身保持纯数据。
    mount({ id: "workspace", module: "@lfaa/workspace" });
    // 工作树依赖已登记项目，排在 workspace 之后；本身不读写会话。
    mount({ id: "worktree", module: "@lfaa/worktree", config: {} });
    mount({ id: "llm", module: "@lfaa/llm" });
    // agent 定义与模型绑定：本阶段只建数据层，派发（P2）与会话生效（P3）后续接入。
    mount({ id: "agent-profile", module: "@lfaa/agent-profile" });
    // 代码审查与 Git 服务只依赖编码设置，先于 agent/chat 挂载即可。
    mount({ id: "review", module: "@lfaa/review", config: { repoRoot: config.repoRoot } });
    mount({ id: "rules", module: "@lfaa/rules" });
    mount({ id: "memory", module: "@lfaa/memory", config: { recommendedProjectDataRoot: `${config.repoRoot}/data` } });
    // Shell 与工具只带纯数据配置；命令方言、执行器、沙箱由联线插件在装配完成后注入。
    mount({ id: "shell", module: "@lfaa/shell" });
    mount({ id: "tools", module: "@lfaa/tools" });
    mount({ id: "skills", module: "@lfaa/skills" });
    // 真实终端：PTY 会话池，浏览器侧经 /api/terminal 的 WebSocket 接入。
    mount({ id: "terminal", module: "@lfaa/terminal", config: { projectRoot: config.repoRoot } });
    mount({ id: "mcp", module: "@lfaa/mcp", config: {} });
    // 连接器聚合服务依赖 MCP 服务：CLI 工具与 MCP 服务器在同一页面管理。
    mount({ id: "connectors", module: "@lfaa/connectors", config: {} });

    // 网页能力：包的默认导出是按顺序组合 seam、抓取实现与工具的 bundle，一个条目装载全套。
    mount({ id: "web", module: "@lfaa/web" });
    // 交接服务与工具：工具注入 goal/tools/memory，Cordis 会等待依赖就绪。
    mount({ id: "handoff", module: "@lfaa/handoff" });
    // 待办与目标工具依赖工具注册表，排在 tools 之后。
    mount({ id: "tool-todo", module: "@lfaa/tool-todo" });
    mount({ id: "goal", module: "@lfaa/goal" });
    mount({ id: "tool-schedule", module: "@lfaa/tool-schedule", config: {} });
    // 消息反馈服务只做持久化，不依赖工具注册表。
    mount({ id: "message-feedback", module: "@lfaa/message-feedback", config: {} });
    // 附件存储依赖工具注册表（read_attachment / list_attachments），排在 tools 之后。
    mount({ id: "attachment-local", module: "@lfaa/attachment-local", config: {} });
    // 标题服务依赖模型服务，排在 llm 之后。
    mount({ id: "session-title", module: "@lfaa/session-title" });
    // 斜杠命令注册表只依赖自身，先于界面装配更稳。
    mount({ id: "commands", module: "@lfaa/commands" });
    // 媒体生成工具依赖工具注册表与模型服务。
    mount({ id: "tool-media", module: "@lfaa/tool-media" });
    mount({
      id: "canvas",
      module: "@lfaa/canvas",
      config: { root: `${config.repoRoot}/data/canvas`, mediaRoot: `${config.repoRoot}/data` },
    });
    // 执行策略中间件挂在工具注册表之后：写前必读 → 超时兜底 → 计划模式 → 长结果落盘。
    mount({ id: "fs-observation-policy", module: "@lfaa/fs-observation-policy", config: {} });
    mount({ id: "timeout-policy", module: "@lfaa/timeout-policy", config: {} });
    mount({ id: "plan-mode", module: "@lfaa/plan-mode", config: {} });
    // 精简必须在落盘之前：先把常规噪声与超长片段压掉，真正超大的再由 spill 落盘。
    mount({ id: "spill-local", module: "@lfaa/spill-local", config: {} });
    // 压缩包默认导出按「精简 → 压缩 → /compact 命令」顺序组合，一个条目装载全套。
    mount({ id: "compaction", module: "@lfaa/compaction" });
    // 提示词服务必须在 agent 之前挂载，运行开局才能合成插件段落。
    mount({ id: "system-prompt", module: "@lfaa/system-prompt" });
    // 沙箱策略：默认导出只挂策略判定，本地沙箱由根上下文提供，不再重复装配。
    mount({ id: "sandbox-policy", module: "@lfaa/sandbox" });

    const providedModules = [...CORE_MODULES, ...OPTIONAL_MODULES, ...DIRECT_MODULES];
    mount({
      id: "plugins",
      module: "@lfaa/plugins",
      config: { profile, providedModules, staticModules: [], repoRoot: config.repoRoot, loaderBaseUrl: config.loaderBaseUrl, presets: PRESETS },
    });
    mount({ id: "chat", module: "@lfaa/chat", config: { repoRoot: config.repoRoot } });
    // agent 的会话模式兼容器由联线插件注入。
    mount({ id: "agent", module: "@lfaa/agent" });

    // 可选模块同样走 Loader；命令解析由联线插件注入。
    if (OPTIONAL_MODULES.includes("@lfaa/jobs")) {
      mount({ id: "jobs", module: "@lfaa/jobs" });
    }
    if (OPTIONAL_MODULES.includes("@lfaa/browser")) {
      mount({ id: "browser", module: "@lfaa/browser" });
    }
    if (OPTIONAL_MODULES.includes("@lfaa/subagent")) {
      mount({ id: "subagent", module: "@lfaa/subagent" });
    }
    // 任务流水线依赖子智能体运行时；未装子智能体时工具会返回可读错误，不影响启动。
    if (OPTIONAL_MODULES.includes("@lfaa/crew")) {
      mount({ id: "crew", module: "@lfaa/crew" });
    }

    await Promise.all([...mounts, loaderCtx.loader.await()]);

    // 跨服务联线放到独立子插件里：Cordis 的服务可见性按 fiber 祖先链解析。
    await ctx.plugin(WIRING_PLUGIN);
  },
};

/** 联线插件：把插件、技能、Agent、分区与记忆之间的依赖接上。 */
const WIRING_PLUGIN: Plugin.Object<void> = {
  name: "@lfaa/bundle-wiring",
  inject: ["plugins", "skills", "agent", "workspace", "worktree", "sections", "memory", "shell", "tools", "jobs", "chat", "sandbox"],
  async apply(ctx: Context) {
    // 装配完成后注入运行时钩子：Loader 配置只放纯数据，函数统一走各服务的 setter。
    ctx.effect(() => ctx.shell.setResolveInvocation(async (command: string, cwd: string) => {
      const kind = await currentShellKind(ctx);
      if (kind === "powershell") return resolvePowerShell(command);
      if (kind === "cmd") return resolveCmd(command);
      return resolveBash(command, cwd, kind);
    }));
    ctx.effect(() => ctx.workspace.setProjectDirResolvers({
      defaultProjectsDirResolver: async () => (await ctx.chat.getGeneralSettings()).defaultProjectsFolder,
      outsideProjectDirResolver: async () => (await ctx.chat.getGeneralSettings()).outsideProjectFolder,
    }));
    ctx.effect(() => ctx.tools.setCommandHooks({
      executeCommand: (request) => ctx.shell.execute(request),
      describeCommandShell: async () => `run_command 的当前 Shell 为 ${SHELL_NAMES[await currentShellKind(ctx)] ?? "Bash"}。请使用该 Shell 的原生命令语法和路径格式。`,
    }));
    ctx.effect(() => ctx.tools.setSandbox(ctx.sandbox));
    ctx.effect(() => ctx.jobs.setResolveInvocation((command: string, cwd: string) => ctx.shell.resolveInvocation(command, cwd)));
    ctx.effect(() => ctx.agent.setResolveSessionModules(resolveLegacySessionModules));

    ctx.effect(() => {
      ctx.plugins.setSkillRegistrar((pluginId, list) => ctx.skills.registerPluginSkills(pluginId, list));
      return () => ctx.plugins.setSkillRegistrar(null);
    });
    await ctx.plugins.restoreEnabledPlugins();
    // 应用上次停用的内置插件：Loader 条目已在上面全部创建，这里只改 disabled。
    await ctx.plugins.applyBuiltinDisabled();

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

    // 项目范围提供器：绑定项目的会话在系统提示里带上项目名与简介，避免会话跑题。
    ctx.effect(() => ctx.agent.setProjectScopeProvider(async (projectId: string) => {
      const project = await ctx.workspace.getProject(projectId);
      if (!project) return null;
      const description = project.description?.trim();
      return {
        projectId: project.id,
        name: project.name,
        ...(description ? { description } : {}),
      };
    }));

    ctx.effect(() => ctx.sections.onSectionRemoved((sectionId: string) => ctx.workspace.clearSection(sectionId)));

    // 工作树删除保护：按会话快照统计绑定数量，工作树服务本身不依赖会话存储。
    ctx.effect(() => ctx.worktree.setSessionCounter(async (worktreeId: string) => {
      const sessions = await ctx.memory.listSessions({ includeArchived: true });
      return sessions.filter((session) => session.worktree?.id === worktreeId).length;
    }));

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

