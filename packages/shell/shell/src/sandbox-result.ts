/**
 * 功能：核验平台沙箱 Host 的单次握手与最终执行回执。
 * 作用：只有随机令牌、实际模式、真实退出码均匹配后，Shell 才报告受限执行完成。
 */
import type { ConfinedCommand } from "lfaa-sandbox";
import type { ShellExecution, ShellRunResult, ShellSandboxInfo } from "./types.js";

const RESULT_PREFIX = "\u001eLFAA_AGENT_SANDBOX_RESULT:";
const READY_PREFIX = "\u001eLFAA_AGENT_SANDBOX_READY:";
const MAX_CONTROL_LINE_CHARS = 180;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function stripControlLines(text: string, token: string): string {
  const escaped = escapeRegExp(token);
  const result = new RegExp(`${RESULT_PREFIX}${escaped}:(?:read-only|workspace-write):\\d+\\u001e\\r?\\n?`, "gu");
  const ready = new RegExp(`${READY_PREFIX}${escaped}\\u001e\\r?\\n?`, "gu");
  return text.replace(result, "").replace(ready, "");
}

function verifiedResult(raw: ShellRunResult, confined: ConfinedCommand): ShellRunResult {
  const token = confined.verificationToken;
  if (confined.effectiveMode === "danger-full-access") {
    const sandbox: ShellSandboxInfo = {
      mode: confined.effectiveMode,
      enforcement: "none",
      denied: false,
      providerId: confined.providerId,
    };
    return { ...raw, sandbox };
  }
  if (!token) {
    return {
      ...raw,
      exitCode: null,
      sandbox: { mode: confined.effectiveMode, enforcement: "none", denied: false, runnerFailed: true, providerId: confined.providerId, hostVerified: false },
    };
  }
  const readyPattern = new RegExp(`${READY_PREFIX}${escapeRegExp(token)}\\u001e`, "gu");
  const resultPattern = new RegExp(`${RESULT_PREFIX}${escapeRegExp(token)}:(read-only|workspace-write):(\\d+)\\u001e`, "gu");
  const readyMatches = [...raw.stderr.text.matchAll(readyPattern)];
  const resultMatches = [...raw.stderr.text.matchAll(resultPattern)];
  const resultMatch = resultMatches[0];
  const resultTail = resultMatch ? raw.stderr.text.slice(resultMatch.index! + resultMatch[0].length).replace(/^[\r\n]*$/u, "") : "";
  if (readyMatches.length !== 1 || resultMatches.length !== 1 || resultTail !== ""
    || resultMatch?.[1] !== confined.effectiveMode || !/^\d+$/u.test(resultMatch?.[2] ?? "")) {
    return {
      ...raw,
      exitCode: null,
      stderr: { ...raw.stderr, text: stripControlLines(raw.stderr.text, token) },
      sandbox: { mode: confined.effectiveMode, enforcement: "none", denied: false, runnerFailed: true, providerId: confined.providerId, hostVerified: false },
    };
  }
  const childExitCode = Number(resultMatch[2]);
  if (!Number.isSafeInteger(childExitCode) || childExitCode < 0 || childExitCode > 0xffff_ffff) {
    return {
      ...raw,
      exitCode: null,
      stderr: { ...raw.stderr, text: stripControlLines(raw.stderr.text, token) },
      sandbox: { mode: confined.effectiveMode, enforcement: "none", denied: false, runnerFailed: true, providerId: confined.providerId, hostVerified: false },
    };
  }
  return {
    ...raw,
    exitCode: childExitCode,
    stderr: { ...raw.stderr, text: stripControlLines(raw.stderr.text, token) },
    sandbox: { mode: confined.effectiveMode, enforcement: "full", denied: false, providerId: confined.providerId, hostVerified: true },
  };
}

/** 代理 Shell 句柄并隐藏握手协议文本，最终结果只认可目标 Host 的有效回执。 */
export function withSandboxResult(execution: ShellExecution, confined: ConfinedCommand): ShellExecution {
  const token = confined.verificationToken;
  const provisional: ShellSandboxInfo = {
    mode: confined.effectiveMode,
    denied: false,
    providerId: confined.providerId,
    ...(confined.effectiveMode === "danger-full-access" ? { enforcement: "none" as const } : {}),
  };
  let pending = "";
  return {
    get status() { return execution.status; },
    get exitCode() { return execution.exitCode; },
    get signal() { return execution.signal; },
    get done() { return execution.done; },
    get sandbox() { return provisional; },
    readOutput() {
      const read = execution.readOutput();
      if (!token) return read;
      pending += read.delta;
      const complete = execution.status !== "running";
      const releaseLength = complete ? pending.length : Math.max(0, pending.length - MAX_CONTROL_LINE_CHARS);
      const released = pending.slice(0, releaseLength);
      pending = pending.slice(releaseLength);
      return { ...read, delta: stripControlLines(released, token) };
    },
    kill: () => execution.kill(),
    result: async () => verifiedResult(await execution.result(), confined),
  };
}
