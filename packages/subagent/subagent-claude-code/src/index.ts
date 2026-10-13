/**
 * 功能：把本机已安装的 Claude Code CLI 注册为一个子代理驱动。
 * 作用：以无交互（print）模式 spawn `claude` 进程执行一次性任务，捕获其最终文本并回传；不使用官方 SDK（未在依赖中）。
 * 安全：env 只透传最小集合；不向 CLI 输入密钥；父运行取消或超时会终止整个进程树。CLI 路径可用 LFAA_CLAUDE_CODE_BIN 覆盖。
 * 关联文件：subagent/manager.ts、tool-subagent、node:child_process。
 * 移植自 DeepSeek Harness subagent-claude-code 的生命周期意图（MIT License，commit 639ed01），按 LFAA 改为直接 spawn CLI。
 */
import type { Context } from "@deepseek-ai/cordis";
import { spawn, type ChildProcess } from "node:child_process";
import type { SubagentDriver, SubagentDriverContext, SubagentRunResult, SubagentTask } from "lfaa-subagent";

/** 单次外部子任务最长执行时间；到点主动终止，避免挂死占用。 */
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_OUTPUT_BYTES = 64 * 1024;

/** 与 mcp-client 一致的最小安全环境白名单，不向外部 CLI 透传密钥。 */
function safeEnv(): NodeJS.ProcessEnv {
  const allowed = new Set(process.platform === "win32"
    ? ["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "HOMEDRIVE", "HOMEPATH"]
    : ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL"]);
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined && allowed.has(key.toLocaleUpperCase("en-US"))) env[key] = value;
  return env;
}

/** 从 Claude Code --output-format json 的 stdout 中提取最终结果文本；失败则回退原始输出尾部。 */
function extractResult(stdout: string): string {
  const trimmed = stdout.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as { type?: string; subtype?: string; result?: string; is_error?: boolean };
    if (parsed && parsed.type === "result" && typeof parsed.result === "string" && parsed.result.trim()) return parsed.result;
  } catch { /* 非 JSON 输出时使用原始文本。 */ }
  return trimmed.slice(-MAX_OUTPUT_BYTES);
}

export const name = "lfaaSubagentClaudeCode";
export const inject = ["lfaaSubagents"];

export function apply(ctx: Context): void {
  const bin = process.env.LFAA_CLAUDE_CODE_BIN?.trim() || "claude";
  const driver: SubagentDriver = {
    name: "claude-code",
    displayName: "Claude Code CLI",
    async run(task: SubagentTask, driverCtx: SubagentDriverContext): Promise<SubagentRunResult> {
      const timeout = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
      const signal = AbortSignal.any([driverCtx.signal, timeout]);
      driverCtx.onProgress(`启动 Claude Code CLI：${bin}（无交互模式）。`);

      let child: ChildProcess;
      try {
        child = spawn(bin, ["-p", task.prompt, "--output-format", "json", "--permission-mode", "dontAsk", "--max-turns", "20"], {
          cwd: process.cwd(),
          env: safeEnv(),
          shell: false,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"]
        });
      } catch (error) {
        return { runId: "", stopReason: "error", answer: "", diagnostic: `Claude Code CLI 启动失败：${error instanceof Error ? error.message : String(error)}。确认已安装 claude 并在 PATH 或 LFAA_CLAUDE_CODE_BIN 中配置。` };
      }

      let stdout = "", stderr = "";
      const onAbort = (): void => { if (child.exitCode === null) child.kill(); };
      signal.addEventListener("abort", onAbort, { once: true });

      child.stdout?.on("data", chunk => { if (stdout.length < MAX_OUTPUT_BYTES) stdout += chunk.toString("utf8"); });
      child.stderr?.on("data", chunk => { if (stderr.length < 4096) stderr += chunk.toString("utf8"); });

      const code = await new Promise<number | null>((resolve) => {
        child.once("error", () => resolve(-1));
        child.once("close", exitCode => resolve(exitCode));
      });
      signal.removeEventListener("abort", onAbort);

      if (signal.aborted) {
        const reason: SubagentRunResult["stopReason"] = driverCtx.signal.aborted ? "aborted" : "timeout";
        return { runId: "", stopReason: reason, answer: extractResult(stdout), ...(stderr ? { diagnostic: stderr.slice(0, 2000) } : {}) };
      }
      if (code !== 0) {
        const detail = `Claude Code 退出码 ${code}。${stderr}`.trim();
        return { runId: "", stopReason: "error", answer: extractResult(stdout), ...(detail ? { diagnostic: detail.slice(0, 2000) } : {}) };
      }
      const answer = extractResult(stdout);
      if (!answer) return { runId: "", stopReason: "error", answer: "", diagnostic: "Claude Code 未返回结果文本。" };
      return { runId: "", stopReason: "completed", answer };
    }
  };
  const dispose = ctx.lfaaSubagents.registerDriver(driver);
  ctx.effect(() => dispose);
}
