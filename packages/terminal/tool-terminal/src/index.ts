/**
 * 功能：把终端会话注册为模型工具 lfaa_terminal。
 * 作用：模型可创建一个持久 Shell 会话、写入命令、读取输出、关闭会话，用于需要多步命令交互的场景。
 * 安全边界：
 *  - 执行命令按 dangerous 风险交给统一三种权限模式处理；
 *  - 会话输出有界缓冲（64 KiB），不会把海量输出灌入上下文；
 *  - 使用真实 PTY；此模型工具只返回有界文本，图形化终端显示由工作区负责。
 * 关联文件：packages/terminal/terminal/src/index.ts、packages/core/tools/src/business-tools.ts。
 */
import { getUserSettings } from "lfaa-settings/src/service.js";
import { config } from "lfaa-launch-environment/src/config.js";
import { createHash } from "node:crypto";
import type { Context } from "@deepseek-ai/cordis";
import type { AiBusinessTool } from "lfaa-tools/src/business-tools.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { resolveTerminalShell } from "lfaa-terminal-bash";

declare module "@deepseek-ai/cordis" {
  interface Context {
    lfaaTools: typeof import("lfaa-tools/src/business-tools.js") & { registerTool: typeof import("lfaa-tools/src/registry.js").registerAiBusinessTool };
    lfaaTerminal: import("lfaa-terminal").TerminalService;
  }
}

export function createTerminalTool(terminal: import("lfaa-terminal").TerminalService): AiBusinessTool {
const owners = new Map<string, { userId: string; runId: string }>();
return {
  id: "terminal.manage",
  name: "lfaa_terminal",
  coreManaged: true,
  description: "管理一个持久本机真实 PTY Shell 会话。action: create（新会话，返回 sessionId）、send（写入文本；submit=true 时同时按 Enter 提交）、read（读取有界文本输出）、close（终止会话）。适合需要连续多条命令的任务；全屏程序的图形交互使用工作区终端。",
  applicationIds: [...APPLICATION_IDS],
  schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "send", "read", "close"] },
      sessionId: { type: "string", maxLength: 64 },
      workingDirectory: { type: "string", maxLength: 32760, description: "create 的本机工作目录；默认使用设置中心任务目录。" },
      input: { type: "string", maxLength: 8000, description: "send 时写入的命令文本。" },
      submit: { type: "boolean", description: "send 时为 true 则在文本末尾补 Enter；已有 CR/LF 时不重复追加。" }
    },
    required: ["action"],
    additionalProperties: false
  },
  risk: parameters => parameters.action === "read" ? "read" : "dangerous",
  approval: (parameters) => ({ scopeKey: `terminal:${createHash("sha256").update(JSON.stringify([parameters.action, parameters.sessionId, parameters.input, parameters.submit, parameters.workingDirectory, parameters.shell])).digest("hex")}`, scopeSummary: "本机终端会话", summary: `终端会话操作：${String(parameters.action)}` }),
  parse(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("terminal 参数必须是对象。");
    const record = value as Record<string, unknown>;
    const action = record.action;
    if (action !== "create" && action !== "send" && action !== "read" && action !== "close") throw new Error("action 必须是 create/send/read/close 之一。");
    const parsed: Record<string, unknown> = { action };
    if (typeof record.sessionId === "string" && record.sessionId) parsed.sessionId = record.sessionId;
    if (typeof record.input === "string" && record.input.length <= 8000) parsed.input = record.input;
    if (record.submit !== undefined) {
      if (typeof record.submit !== "boolean") throw new Error("submit 必须是布尔值。");
      if (record.submit && action !== "send") throw new Error("submit 只适用于 send。");
      parsed.submit = record.submit;
    }
    if (typeof record.workingDirectory === "string") {
      if (record.workingDirectory.length > 32760 || record.workingDirectory.includes("\0")) throw new Error("工作目录无效。");
      parsed.workingDirectory = record.workingDirectory;
    }
    return parsed;
  },
  prepare(parameters, context) {
    const general = getUserSettings(context.userId).general;
    // 远端项目路径不能被解释成控制端本机路径。
    return { ...parameters, workingDirectory: parameters.workingDirectory || general.taskFolder || process.cwd(), shell: general.integratedShell };
  },
  async execute(parameters, context) {
    context.signal.throwIfAborted();
    if (!context.onRunDispose) throw new Error("当前运行缺少终端清理入口。");
    const action = String(parameters.action);
    if (action === "create") {
      const general = getUserSettings(context.userId).general;
      const session = await terminal.createSession(String(parameters.workingDirectory || general.taskFolder || process.cwd()), await resolveTerminalShell(String(parameters.shell || general.integratedShell)));
      owners.set(session.id, { userId: context.userId, runId: context.agentRunId });
      const close = () => { owners.delete(session.id); void session.close().catch(() => {}); };
      context.onRunDispose(close);
      return { sessionId: session.id, note: "会话已创建；用 send 写入命令，用 read 读取输出。" };
    }
    const sessionId = typeof parameters.sessionId === "string" ? parameters.sessionId : "";
    const owner = owners.get(sessionId);
    if (!owner || owner.userId !== context.userId || owner.runId !== context.agentRunId) throw new Error("找不到当前账户和运行的终端会话。");
    const session = terminal.getSession(sessionId);
    if (!session) throw new Error("找不到该终端会话，请先 create。");
    if (action === "send") {
      const input = String(parameters.input ?? "");
      const submit = parameters.submit === true;
      const data = submit && !/[\r\n]$/u.test(input) ? `${input}\r` : input;
      await session.write(data);
      return { sessionId, sent: true, submitted: submit, note: "命令已写入；用 read 读取输出。" };
    }
    if (action === "read") {
      return { sessionId, output: session.read() };
    }
    owners.delete(sessionId);
    await session.close();
    return { sessionId, closed: true };
  }
};

}

export const name = "lfaaToolTerminal";
export const inject = ["lfaaTools", "lfaaTerminal"] as const;

/** 注册终端管理工具。 */
export function apply(ctx: Context): void {
  if (config.localHostExecution) ctx.lfaaTools.registerTool(ctx, createTerminalTool(ctx.lfaaTerminal));
}
