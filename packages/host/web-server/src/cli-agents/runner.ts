// 官方 CLI 代理流式执行器：通过原生非交互 JSONL/NDJSON 协议驱动 codex / claude / agy，绝不窃取 token。
// 关联：packages/host/web-server/src/cli-agents/store.ts；运行环境：Node Host。
import { spawn } from "node:child_process";
import type { AgentRunEvent, ExternalBackendRunInput, ExternalBackendRunResult } from "@lfaa/agent";
import type { CliAgentsStore } from "./store";

/** 拆解用户附加的 CLI 参数（支持简单引号，避免注入 shell 元字符）。 */
export function splitExtraArgs(raw: string): string[] {
  const args: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw)) !== null) {
    const token = match[1] ?? match[2] ?? match[3] ?? "";
    if (token) args.push(token);
  }
  return args;
}

/** 从 codex exec --json 的单行 JSONL 中提取增量文本或最终消息。 */
export function extractCodexJsonLine(line: string): { delta?: string; replace?: string; error?: string } {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const type = typeof parsed.type === "string" ? parsed.type : "";
    if (type === "error" || type === "turn.failed") {
      const msg = typeof parsed.message === "string"
        ? parsed.message
        : typeof (parsed.error as { message?: unknown } | undefined)?.message === "string"
          ? String((parsed.error as { message: string }).message)
          : "Codex 执行失败";
      return { error: msg };
    }
    // 增量文本事件（如 item.agent_message.delta / response.output_text.delta）
    if (typeof parsed.delta === "string" && parsed.delta) {
      return { delta: parsed.delta };
    }
    // item.completed 中的 agent_message
    const item = parsed.item as Record<string, unknown> | undefined;
    if (type === "item.completed" && item && (item.type === "agent_message" || item.type === "message")) {
      if (typeof item.text === "string" && item.text) return { replace: item.text };
      if (Array.isArray(item.content)) {
        const joined = item.content
          .map((c) => (typeof (c as { text?: unknown })?.text === "string" ? String((c as { text: string }).text) : ""))
          .join("");
        if (joined) return { replace: joined };
      }
    }
    return {};
  } catch {
    return {};
  }
}

/** 从 claude -p --output-format stream-json 的单行 NDJSON 中提取增量文本或结果。 */
export function extractClaudeJsonLine(line: string): { delta?: string; replace?: string; error?: string } {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const type = typeof parsed.type === "string" ? parsed.type : "";
    if (type === "stream_event") {
      const event = parsed.event as Record<string, unknown> | undefined;
      const delta = event?.delta as Record<string, unknown> | undefined;
      if (delta?.type === "text_delta" && typeof delta.text === "string") {
        return { delta: delta.text };
      }
      return {};
    }
    if (type === "result") {
      if (parsed.is_error === true) {
        return { error: typeof parsed.result === "string" && parsed.result ? parsed.result : "Claude Code 执行失败" };
      }
      if (typeof parsed.result === "string" && parsed.result) {
        return { replace: parsed.result };
      }
    }
    return {};
  } catch {
    return {};
  }
}

function buildCliInvocation(
  agentId: string,
  binaryPath: string,
  userMessage: string,
  permissionMode: "ask" | "smart" | "full",
  extraArgs: string,
): { command: string; args: string[]; mode: "codex" | "claude" | "plain" } {
  const userArgs = splitExtraArgs(extraArgs);
  if (agentId === "codex") {
    const sandbox = permissionMode === "full"
      ? "danger-full-access"
      : permissionMode === "ask"
        ? "read-only"
        : "workspace-write";
    return {
      command: binaryPath,
      args: ["exec", "--json", "--sandbox", sandbox, ...userArgs, userMessage],
      mode: "codex",
    };
  }
  if (agentId === "claude") {
    const permArgs = permissionMode === "full" ? ["--dangerously-skip-permissions"] : [];
    return {
      command: binaryPath,
      args: [
        "-p",
        userMessage,
        "--output-format",
        "stream-json",
        "--verbose",
        "--include-partial-messages",
        ...permArgs,
        ...userArgs,
      ],
      mode: "claude",
    };
  }
  // agy 等官方 CLI：优先非交互文本流输出。
  return {
    command: binaryPath,
    args: [...userArgs, userMessage],
    mode: "plain",
  };
}

/** 构造可供 AgentService 注入的外部 CLI 执行回调。 */
export function createCliAgentBackendRunner(store: CliAgentsStore) {
  return async (input: ExternalBackendRunInput): Promise<ExternalBackendRunResult> => {
    const agentId = input.profileId.replace(/^cli:/u, "").trim();
    const { snapshot, envOverlay, activeAccount } = await store.resolveAgentExecution(agentId);
    if (!snapshot.installed || !snapshot.binaryPath) {
      throw new Error(`本机未检测到 ${snapshot.name}（${snapshot.binary}），请先安装并在「设置 → 模型与规则 → CLI 代理」中刷新检测。`);
    }
    if (!snapshot.supportsChat) {
      throw new Error(`${snapshot.name} 目前仅支持在集成终端中启动，暂不支持聊天框直连。`);
    }

    const { command, args, mode } = buildCliInvocation(
      agentId,
      snapshot.binaryPath,
      input.userMessage,
      input.permissionMode,
      snapshot.extraArgs,
    );
    const useShell = process.platform === "win32" && /\.(?:cmd|bat)$/iu.test(command);
    const child = spawn(command, args, {
      cwd: input.cwd,
      env: { ...process.env, ...envOverlay },
      windowsHide: true,
      shell: useShell,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const emit: (event: AgentRunEvent) => void = input.emit;
    let content = "";
    let stderrText = "";
    let lineBuf = "";
    let streamError: string | null = null;
    const accountTag = activeAccount ? ` (${activeAccount.label})` : "";

    let seq = 0;
    const pushDelta = (delta: string): void => {
      if (!delta) return;
      content += delta;
      seq += 1;
      emit({ type: "delta", runId: input.runId, seq, kind: "text", text: delta });
    };

    const handleLine = (line: string): void => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (mode === "plain") {
        pushDelta(`${line}\n`);
        return;
      }
      const parsed = mode === "codex" ? extractCodexJsonLine(trimmed) : extractClaudeJsonLine(trimmed);
      if (parsed.error) {
        streamError = parsed.error;
        return;
      }
      if (parsed.delta) {
        pushDelta(parsed.delta);
        return;
      }
      if (parsed.replace && !content) {
        pushDelta(parsed.replace);
      }
    };

    const onAbort = (): void => {
      try {
        child.kill();
      } catch {
        // 进程已退出时忽略
      }
    };
    if (input.signal.aborted) {
      onAbort();
    } else {
      input.signal.addEventListener("abort", onAbort, { once: true });
    }

    const exitCode = await new Promise<number | null>((resolveExit, rejectExit) => {
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        if (mode === "plain") {
          pushDelta(chunk);
          return;
        }
        lineBuf += chunk;
        const lines = lineBuf.split(/\r?\n/u);
        lineBuf = lines.pop() ?? "";
        for (const line of lines) handleLine(line);
      });
      child.stderr.on("data", (chunk: string) => {
        stderrText = `${stderrText}${chunk}`.slice(-4000);
      });
      child.on("error", (err) => rejectExit(err));
      child.on("close", (code) => {
        if (lineBuf.trim()) handleLine(lineBuf);
        resolveExit(code);
      });
    }).finally(() => {
      input.signal.removeEventListener("abort", onAbort);
    });

    if (input.signal.aborted) {
      return {
        content: content || "已停止生成。",
        steps: [],
        model: `${snapshot.name}${accountTag}`,
      };
    }

    if (streamError) {
      throw new Error(`${snapshot.name} 返回错误：${streamError}`);
    }
    if (exitCode !== 0 && !content.trim()) {
      const hint = stderrText.trim() || `退出码 ${String(exitCode)}`;
      throw new Error(`${snapshot.name} 运行失败：${hint}`);
    }

    return {
      content: content.trim() || `（${snapshot.name} 已执行完成，未返回正文输出）`,
      steps: [],
      model: `${snapshot.name}${accountTag}`,
    };
  };
}
