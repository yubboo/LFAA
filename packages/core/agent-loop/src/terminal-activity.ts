/**
 * 功能：为持久本机终端会话生成准确且有界的 Agent 活动记录。
 * 作用：展示 create/send/read/close 阶段和安全命令预览，不把终端输出正文写进活动日志。
 * 关联文件：execute-turn.ts 写入运行轨迹；agent-activity-summary.test.mjs 验证脱敏和回执。
 */
import { sanitizeShellCommandActivityPreview } from "./shell-command-activity.js";

type ActivityParameters = Record<string, unknown>;

function asRecord(value: unknown): ActivityParameters | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ActivityParameters : null;
}

export function terminalActivityTitle(parameters: unknown): string | null {
  const action = asRecord(parameters)?.action;
  if (action === "create") return "创建本机终端会话";
  if (action === "send") return "运行本机终端命令";
  if (action === "read") return "读取本机终端输出";
  if (action === "close") return "关闭本机终端会话";
  return null;
}

export function terminalActivityInvocationSummary(parameters: unknown): string | null {
  const record = asRecord(parameters);
  if (!record) return null;
  if (record.action === "create") return "创建持久本机 PTY 会话。";
  if (record.action === "send") {
    const input = typeof record.input === "string" ? record.input : "";
    const submit = record.submit === true;
    return `向本机终端${submit ? "提交" : "写入"}命令${input ? `：\n${sanitizeShellCommandActivityPreview(input)}` : "（命令文本为空）"}`;
  }
  if (record.action === "read") return "读取本机终端输出；原始输出交给 Agent 判断，活动摘要不保存输出正文。";
  if (record.action === "close") return "关闭本轮创建的本机终端会话。";
  return null;
}

export function terminalActivityResultSummary(value: unknown, parameters: unknown): string | null {
  const record = asRecord(value);
  const action = asRecord(parameters)?.action;
  if (!record) return null;
  if (action === "create" && typeof record.sessionId === "string") return "本机终端会话已创建；会话回执已交给 Agent。";
  if (action === "send" && record.sent === true) {
    return record.submitted === true
      ? "命令已写入并提交；实际输出仍需通过读取终端回执核验。"
      : "文本已写入终端但未提交；尚不能据此认定命令已运行。";
  }
  if (action === "read" && typeof record.output === "string") {
    return `终端返回 ${record.output.length} 个字符；原始输出已交给 Agent，活动摘要不保存正文。`;
  }
  if (action === "close" && record.closed === true) return "本机终端会话已关闭。";
  return null;
}
