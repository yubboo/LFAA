// @lfaa/jobs Host 侧 Cordis 服务：注册后台命令工具并管理会话级后台进程池。
import { type Context, Service } from "@deepseek-ai/cordis";
import { appendCommandAudit, findProtectedPathInCommand, resolveSafeWorkspaceRoot } from "@lfaa/tools";
import { BackgroundJobManager } from "./job-manager";
import type { BackgroundJobItem, JobsPluginConfig, StartBackgroundJobInput } from "./types";

export * from "./types";
export { createJobsHttpHandler } from "./http-handler";

/** 前台命令超时转后台后的执行时限：30 分钟，覆盖完整构建或依赖安装。 */
const BACKGROUND_FALLBACK_TIMEOUT_MS = 30 * 60_000;

/** Host 侧后台任务服务，挂载于 Cordis `jobs` 属性。 */
export class JobsService extends Service {
  static inject = ["tools"];

  private readonly manager: BackgroundJobManager;
  private unregisterTools: (() => void) | null = null;
  private unregisterTimeoutHandler: (() => void) | null = null;

  constructor(ctx: Context, config: JobsPluginConfig = {}) {
    super(ctx, "jobs");
    this.manager = new BackgroundJobManager(config);
    this.unregisterTools = this.registerAgentTools();
    // 前台命令触发时限时由后台任务接管，长构建不再被直接判定失败。
    this.unregisterTimeoutHandler = ctx.tools.setCommandTimeoutHandler(async (input) => {
      const job = await this.manager.start({
        sessionId: input.sessionId,
        command: input.command,
        title: `超时转后台：${input.command.slice(0, 48)}`,
        cwd: input.cwd,
        timeoutMs: BACKGROUND_FALLBACK_TIMEOUT_MS,
      });
      return { taskId: job.id, title: job.title };
    });
    ctx.effect(() => () => {
      this.unregisterTimeoutHandler?.();
      this.unregisterTimeoutHandler = null;
      this.unregisterTools?.();
      this.unregisterTools = null;
      this.manager.disposeAll();
    });
  }

  private registerAgentTools(): () => void {
    const cleanups = [
      this.ctx.tools.registerTool({
        name: "start_background_task",
        title: "启动后台任务",
        description: "在工作区根目录启动长时间运行的后台命令（如开发服务、构建或监听任务），立即返回 taskId。",
        permissionLevel: "exec",
        parameters: {
          type: "object",
          properties: {
            command: { type: "string", description: "要运行的终端命令" },
            title: { type: "string", description: "简短任务名称（可选）" },
            timeoutMs: { type: "number", description: "可选超时毫秒数，默认 600000" },
          },
          required: ["command"],
        },
        execute: async (args, execCtx) => {
          const command = typeof args.command === "string" ? args.command.trim() : "";
          if (!command) return { ok: false, output: "命令不能为空。", summary: "命令为空" };
          const cwd = await resolveSafeWorkspaceRoot(execCtx.workspaceRoots, {
            allowOutsideWorkspace: execCtx.allowOutsideWorkspace,
          });
          const protectedTarget = findProtectedPathInCommand(command);
          if (protectedTarget) {
            await appendCommandAudit({
              at: Date.now(), sessionId: execCtx.sessionId, runId: execCtx.runId, cwd, command, ok: false,
            });
            return {
              ok: false,
              output: `命令引用了应用私有${protectedTarget}，已拦截。`,
              summary: "命令已安全拦截",
            };
          }
          const job = await this.manager.start({
            sessionId: execCtx.sessionId,
            command,
            ...(typeof args.title === "string" ? { title: args.title } : {}),
            cwd,
            ...(typeof args.timeoutMs === "number" ? { timeoutMs: args.timeoutMs } : {}),
          });
          await appendCommandAudit({
            at: Date.now(), sessionId: execCtx.sessionId, runId: execCtx.runId, cwd, command, ok: true,
          });
          return {
            ok: true,
            output: JSON.stringify({ taskId: job.id, status: job.status, title: job.title, cwd: job.cwd }, null, 2),
            summary: `已启动后台任务 ${job.title}`,
          };
        },
      }),
      this.ctx.tools.registerTool({
        name: "get_background_task",
        title: "查看后台任务状态",
        description: "按 taskId 查看后台任务运行状态、退出码与最新输出日志。",
        permissionLevel: "read",
        parameters: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "后台任务 ID" },
          },
          required: ["taskId"],
        },
        execute: async (args, execCtx) => {
          const taskId = typeof args.taskId === "string" ? args.taskId.trim() : "";
          const job = this.manager.get(taskId, execCtx.sessionId);
          if (!job) {
            return { ok: false, output: `当前会话找不到后台任务：${taskId}`, summary: "任务不存在" };
          }
          return {
            ok: true,
            output: JSON.stringify(job, null, 2),
            summary: `${job.title} (${job.status})`,
          };
        },
      }),
      this.ctx.tools.registerTool({
        name: "list_background_tasks",
        title: "列出后台任务",
        description: "列出当前会话已启动的所有后台任务及运行状态。",
        permissionLevel: "read",
        parameters: { type: "object", properties: {} },
        execute: async (_args, execCtx) => {
          const jobs = this.manager.list(execCtx.sessionId);
          return {
            ok: true,
            output: JSON.stringify(jobs.map(({ output: _o, ...summary }) => summary), null, 2),
            summary: `当前会话共 ${jobs.length} 个后台任务`,
          };
        },
      }),
      this.ctx.tools.registerTool({
        name: "stop_background_task",
        title: "停止后台任务",
        description: "终止当前会话指定的运行中后台任务。",
        permissionLevel: "exec",
        parameters: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "要终止的后台任务 ID" },
          },
          required: ["taskId"],
        },
        execute: async (args, execCtx) => {
          const taskId = typeof args.taskId === "string" ? args.taskId.trim() : "";
          const job = await this.manager.stop(taskId, execCtx.sessionId);
          if (!job) {
            return { ok: false, output: `当前会话找不到后台任务：${taskId}`, summary: "任务不存在" };
          }
          return {
            ok: true,
            output: JSON.stringify({ taskId: job.id, status: job.status }, null, 2),
            summary: `已停止 ${job.title}`,
          };
        },
      }),
    ];
    return () => {
      for (const off of cleanups) off();
    };
  }

  protected stop(): void {
    this.unregisterTimeoutHandler?.();
    this.unregisterTimeoutHandler = null;
    this.unregisterTools?.();
    this.unregisterTools = null;
    this.manager.disposeAll();
  }

  startJob(input: StartBackgroundJobInput): Promise<BackgroundJobItem> {
    return this.manager.start(input);
  }

  getJob(id: string, sessionId?: string): BackgroundJobItem | null {
    return this.manager.get(id, sessionId);
  }

  listJobs(sessionId?: string): BackgroundJobItem[] {
    return this.manager.list(sessionId);
  }

  stopJob(id: string, sessionId?: string): Promise<BackgroundJobItem | null> {
    return this.manager.stop(id, sessionId);
  }

  stopSessionJobs(sessionId: string): void {
    this.manager.stopSession(sessionId);
  }

  subscribe(listener: () => void): () => void {
    return this.manager.subscribe(listener);
  }
}

export function jobsPlugin(ctx: Context, config: JobsPluginConfig = {}): void {
  new JobsService(ctx, config);
}

jobsPlugin.inject = ["tools"] as const;

declare module "@deepseek-ai/cordis" {
  interface Context {
    jobs: JobsService;
  }
}
