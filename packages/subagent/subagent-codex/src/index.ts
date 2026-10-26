/**
 * 功能：把本机已安装的 Codex CLI 注册为一个子代理驱动。
 * 作用：以无交互（exec）模式 spawn `codex` 进程执行一次性任务，捕获最终输出并回传。
 * 安全：env 只透传最小集合；父运行取消或超时会终止进程。CLI 路径可用 LFAA_CODEX_BIN 覆盖。
 * 关联文件：subagent/manager.ts、tool-subagent、node:child_process。
 * 移植自 DeepSeek Harness subagent-codex 的生命周期意图（MIT License，commit 639ed01），按 LFAA 改为直接 spawn CLI。
 */
import type { Context } from "@deepseek-ai/cordis";
import { spawn, type ChildProcess } from "node:child_process";
import type { SubagentDriver, SubagentDriverContext, SubagentRunResult, SubagentTask } from "lfaa-subagent";
import { bindExternalChildCancellation } from "lfaa-subagent/src/out-of-process.js";
import { resolveSubagentWorkingDirectory } from "lfaa-subagent/src/working-directory.js";

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_OUTPUT_BYTES = 64 * 1024;

function safeEnv(): NodeJS.ProcessEnv {
  const allowed = new Set(process.platform === "win32"
    ? ["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "HOMEDRIVE", "HOMEPATH"]
    : ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL"]);
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined && allowed.has(key.toLocaleUpperCase("en-US"))) env[key] = value;
  return env;
}

/** Codex exec 非交互输出以最终回答为主；截取尾部有界文本作为结果。 */
function extractAnswer(stdout: string): string {
  const trimmed = stdout.trim();
  if (!trimmed) return "";
  return trimmed.length > MAX_OUTPUT_BYTES ? trimmed.slice(-MAX_OUTPUT_BYTES) : trimmed;
}

export const name = "lfaaSubagentCodex";
export const inject = ["lfaaSubagents"];

export function apply(ctx: Context): void {
  const bin = process.env.LFAA_CODEX_BIN?.trim() || "codex";
  const driver: SubagentDriver = {
    name: "codex",
    displayName: "Codex CLI",
    available: false,
    unavailableReason: "Codex CLI 尚未接入 LFAA Permission Owner 的逐动作授权桥。",
    async run(task: SubagentTask, driverCtx: SubagentDriverContext): Promise<SubagentRunResult> {
      if (!driverCtx.terminateProcessTree) return { runId: "", stopReason: "error", answer: "", diagnostic: "Codex 缺少进程树 Owner，已拒绝启动。" };
      const timeout = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
      const signal = AbortSignal.any([driverCtx.signal, timeout]);
      signal.throwIfAborted();
      let workingDirectory: string;
      try { workingDirectory = await resolveSubagentWorkingDirectory(driverCtx.workingDirectory); }
      catch (error) { return { runId: "", stopReason: "error", answer: "", diagnostic: error instanceof Error ? error.message : "Codex 缺少有效的 AgentGit 工作目录，已拒绝启动。" }; }
      driverCtx.onProgress(`启动 Codex CLI：${bin}（无交互模式）；工作目录：${workingDirectory}。`);

      let child: ChildProcess;
      try {
        child = spawn(bin, ["exec", "--skip-git-repo-check", task.prompt], {
          cwd: workingDirectory,
          env: safeEnv(),
          shell: false,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"]
        });
      } catch (error) {
        return { runId: "", stopReason: "error", answer: "", diagnostic: `Codex CLI 启动失败：${error instanceof Error ? error.message : String(error)}。确认已安装 codex 并在 PATH 或 LFAA_CODEX_BIN 中配置。` };
      }

      let stdout = "", stderr = "";
      const cancellation = bindExternalChildCancellation(child, signal, driverCtx.terminateProcessTree);

      child.stdout?.on("data", chunk => { if (stdout.length < MAX_OUTPUT_BYTES) stdout += chunk.toString("utf8"); });
      child.stderr?.on("data", chunk => { if (stderr.length < 4096) stderr += chunk.toString("utf8"); });

      const code = await new Promise<number | null>((resolve) => {
        child.once("error", () => resolve(-1));
        child.once("close", exitCode => resolve(exitCode));
      });
      const termination = await cancellation.wait();
      cancellation.dispose();

      if (signal.aborted) {
        const reason: SubagentRunResult["stopReason"] = driverCtx.signal.aborted ? "aborted" : "timeout";
        const diagnostic = [stderr.slice(0, 2000), termination?.stopped === false ? termination.detail : ""].filter(Boolean).join("\n");
        return { runId: "", stopReason: reason, answer: extractAnswer(stdout), ...(diagnostic ? { diagnostic: diagnostic.slice(0, 2000) } : {}) };
      }
      if (code !== 0) {
        const detail = `Codex 退出码 ${code}。${stderr}`.trim();
        return { runId: "", stopReason: "error", answer: extractAnswer(stdout), ...(detail ? { diagnostic: detail.slice(0, 2000) } : {}) };
      }
      const answer = extractAnswer(stdout);
      if (!answer) return { runId: "", stopReason: "error", answer: "", diagnostic: "Codex 未返回结果文本。" };
      return { runId: "", stopReason: "completed", answer };
    }
  };
  const dispose = ctx.lfaaSubagents.registerDriver(driver);
  ctx.effect(() => dispose);
}
