// 从会话步骤轨迹提炼工具要点：供上下文摘要、滚动摘要与运行记录复用，只保留路径、命令与工具计数。
import type { AgentStepTrace, ChatMessageRecord } from "./types";

/** 会话工具轨迹的可复用摘要，避免把完整命令输出再次塞进模型上下文。 */
export interface HistoryDigest {
  files: string[];
  commands: Array<{ command: string; exitCode?: number }>;
  toolCounts: Array<{ name: string; count: number }>;
}

const DEFAULT_MAX_STEPS = 80;
const MAX_FILE_ENTRIES = 10;
const MAX_COMMAND_ENTRIES = 5;
const MAX_TOOL_ENTRIES = 6;

function shortCommand(command: string): string {
  return command.replace(/\s+/gu, " ").trim().slice(0, 90);
}

/** 抽取步骤中的真实文件改动、命令执行与只读工具使用情况。 */
export function collectStepDigest(
  steps: ReadonlyArray<AgentStepTrace>,
  options: { maxSteps?: number } = {},
): HistoryDigest {
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const files: string[] = [];
  const commands: Array<{ command: string; exitCode?: number }> = [];
  const counts = new Map<string, number>();
  const selectedSteps = steps.filter((step) => step.phase === "act").slice(-maxSteps);

  for (const step of selectedSteps) {
    if (step.status !== "done" && step.status !== "error") continue;
    const filePath = step.fileChange?.path;
    if (filePath && !files.includes(filePath)) files.push(filePath);
    const command = step.commandTrace?.command;
    if (command) {
      const trimmed = shortCommand(command);
      const last = commands[commands.length - 1];
      if (trimmed && last?.command !== trimmed) {
        const exitCode = step.commandTrace?.exitCode;
        commands.push({ command: trimmed, ...(exitCode === undefined ? {} : { exitCode }) });
      }
    }
    if (step.toolName && !filePath && !command) {
      counts.set(step.toolName, (counts.get(step.toolName) ?? 0) + 1);
    }
  }

  return {
    files: files.slice(-MAX_FILE_ENTRIES),
    commands: commands.slice(-MAX_COMMAND_ENTRIES),
    toolCounts: [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, MAX_TOOL_ENTRIES)
      .map(([name, count]) => ({ name, count })),
  };
}

/** 汇总多轮会话消息里已持久化的工具轨迹。 */
export function collectHistoryDigest(
  messages: ReadonlyArray<ChatMessageRecord>,
  options: { maxSteps?: number } = {},
): HistoryDigest {
  const steps = messages.flatMap((message) => message.steps ?? []);
  return collectStepDigest(steps, options);
}

/** 生成一行式轨迹要点；没有可复用信息时返回空串。 */
export function formatHistoryDigest(digest: HistoryDigest): string {
  const parts: string[] = [];
  if (digest.files.length > 0) {
    parts.push(`已改动 ${digest.files.length} 个文件（${digest.files.join("、")}）`);
  }
  if (digest.commands.length > 0) {
    const commands = digest.commands
      .map((item) => item.exitCode === undefined ? `\`${item.command}\`` : `\`${item.command}\`→${item.exitCode}`)
      .join("、");
    parts.push(`已运行命令（${commands}）`);
  }
  if (digest.toolCounts.length > 0) {
    parts.push(`已使用工具（${digest.toolCounts.map((item) => `${item.name}×${item.count}`).join("、")}）`);
  }
  return parts.join("；");
}

/** 生成本轮运行摘要条目，供滚动摘要逐轮累积。 */
export function buildRunSummaryEntry(input: { userMessage: string; content: string; digest?: string }): string {
  const target = input.userMessage.replace(/\s+/gu, " ").trim().slice(0, 80);
  const conclusion = input.content.replace(/\s+/gu, " ").trim().slice(0, 100);
  const parts = [`本轮：${target}`];
  if (conclusion) parts.push(`结论：${conclusion}`);
  if (input.digest) parts.push(input.digest);
  return parts.join("｜");
}

/** 以尾部为准滚动保留会话摘要：超出预算时丢弃最早内容，而不是截断最新进展。 */
export function rollSessionSummary(previous: string | undefined, entry: string, maxChars = 600): string {
  const body = [previous?.trim() ?? "", entry.trim()].filter(Boolean).join("\n");
  if (!body || body.length <= maxChars) return body;
  return `…${body.slice(body.length - maxChars)}`;
}
