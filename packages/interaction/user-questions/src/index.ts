/**
 * 功能：管理可插拔、通道中立的用户问题回答者。
 * 作用：按账户、应用和 Run 将澄清请求交给已登记插件；自身不保存问题或答案。
 * 关联文件：packages/interaction/tool-ask-user、packages/core/agent-loop、Session Controller。
 */
import type { Context } from "@deepseek-ai/cordis";
import { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";

export const name = "lfaaUserQuestions";

export interface UserQuestionInput {
  readonly userId: string;
  readonly applicationId: ApplicationId;
  readonly runId: string;
  readonly questionId: string;
  readonly question: string;
  readonly options: readonly string[];
  readonly signal: AbortSignal;
}

export interface UserQuestionAnswer {
  readonly answer: string;
  readonly skipped: boolean;
}

export interface UserQuestionAnswerer {
  readonly id: string;
  readonly priority: number;
  accepts(input: UserQuestionInput): boolean;
  answer(input: UserQuestionInput): Promise<UserQuestionAnswer | undefined>;
}

export interface UserQuestionService {
  registerAnswerer(answerer: UserQuestionAnswerer): () => void;
  ask(input: UserQuestionInput): Promise<UserQuestionAnswer>;
}

declare module "@deepseek-ai/cordis" {
  interface Context { lfaaUserQuestions: UserQuestionService }
}

interface AnswererEntry {
  readonly answerer: UserQuestionAnswerer;
  readonly active: Set<AbortController>;
}

const answererIdPattern = /^[a-z0-9][a-z0-9._:-]{0,159}$/u;
const questionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const maximumAnswerers = 128;
const maximumQuestionLength = 1200;
const maximumOptionLength = 200;
const maximumAnswerLength = 12_000;

class UserQuestionServiceRuntime implements UserQuestionService {
  private readonly answerers = new Map<string, AnswererEntry>();
  private readonly activeRuns = new Set<string>();
  private closed = false;

  registerAnswerer(answerer: UserQuestionAnswerer): () => void {
    if (this.closed) throw new Error("用戶問題服務已关闭，不能再登记回答者。");
    if (!answerer || !answererIdPattern.test(answerer.id) || !Number.isInteger(answerer.priority) || Math.abs(answerer.priority) > 1000
      || typeof answerer.accepts !== "function" || typeof answerer.answer !== "function") {
      throw new TypeError("用户问题回答者描述无效。");
    }
    if (this.answerers.size >= maximumAnswerers) throw new Error("用户问题回答者数量超过上限。");
    if (this.answerers.has(answerer.id)) throw new Error(`用户问题回答者标识重复：${answerer.id}`);
    const entry: AnswererEntry = { answerer, active: new Set() };
    this.answerers.set(answerer.id, entry);
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      if (this.answerers.get(answerer.id) === entry) this.answerers.delete(answerer.id);
      for (const controller of [...entry.active]) controller.abort();
      entry.active.clear();
    };
  }

  async ask(rawInput: UserQuestionInput): Promise<UserQuestionAnswer> {
    if (this.closed) throw new Error("用户问题服务尚未装载或已经卸载。");
    const input = normalizeQuestion(rawInput);
    input.signal.throwIfAborted();
    const runKey = `${input.userId}\0${input.applicationId}\0${input.runId}`;
    if (this.activeRuns.has(runKey)) throw new Error("当前 Agent Run 已有一条待回答问题。");
    this.activeRuns.add(runKey);
    try {
      const candidates = [...this.answerers.values()]
        .filter((entry) => entry.answerer.accepts(input))
        .sort((left, right) => right.answerer.priority - left.answerer.priority || compareText(left.answerer.id, right.answerer.id));
      for (const entry of candidates) {
        input.signal.throwIfAborted();
        if (this.closed || !this.answerers.has(entry.answerer.id)) throw new Error("用户问题回答通道已卸载。");
        const controller = new AbortController();
        const signal = AbortSignal.any([input.signal, controller.signal]);
        entry.active.add(controller);
        try {
          const answer = await raceWithAbort(Promise.resolve().then(() => entry.answerer.answer({ ...input, signal })), signal);
          if (answer !== undefined) return normalizeAnswer(answer);
        } finally {
          entry.active.delete(controller);
        }
      }
      throw new Error("当前没有适用于此账户、应用和 Run 的用户问题回答通道。");
    } finally {
      this.activeRuns.delete(runKey);
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const entry of this.answerers.values()) {
      for (const controller of [...entry.active]) controller.abort();
      entry.active.clear();
    }
    this.answerers.clear();
  }
}

function normalizeQuestion(input: UserQuestionInput): UserQuestionInput {
  if (!input || typeof input !== "object" || !APPLICATION_IDS.includes(input.applicationId)) throw new TypeError("用户问题的应用或请求上下文无效。");
  for (const [label, value] of [["账户", input.userId], ["Run", input.runId]] as const) {
    if (typeof value !== "string" || !value.trim() || value.length > 160 || /[\u0000-\u001f\u007f]/u.test(value)) {
      throw new TypeError(`用户问题的${label}标识无效。`);
    }
  }
  if (typeof input.signal?.throwIfAborted !== "function") throw new TypeError("用户问题必须绑定可取消信号。");
  if (!questionIdPattern.test(input.questionId)) throw new TypeError("用户问题标识必须是 UUID v4。");
  const question = typeof input.question === "string" ? input.question.trim() : "";
  const options = Array.isArray(input.options) ? input.options.map((option) => typeof option === "string" ? option.trim() : "") : [];
  if (!question || question.length > maximumQuestionLength || options.length < 2 || options.length > 4 || options.some((option) => !option || option.length > maximumOptionLength)) {
    throw new TypeError("用户问题须为 1 至 1200 字，并提供 2 至 4 个各不超过 200 字的选项。");
  }
  return Object.freeze({ ...input, question, options: Object.freeze(options) });
}

function normalizeAnswer(answer: UserQuestionAnswer): UserQuestionAnswer {
  if (!answer || typeof answer !== "object" || Object.keys(answer).length !== 2 || !Object.hasOwn(answer, "answer") || !Object.hasOwn(answer, "skipped")
    || typeof answer.answer !== "string" || typeof answer.skipped !== "boolean") {
    throw new TypeError("用户问题回答者返回格式无效。");
  }
  const value = answer.answer.trim();
  if (value.length > maximumAnswerLength || (!answer.skipped && !value)) throw new TypeError("用户问题回答不能为空，且不得超过 12000 字。");
  return Object.freeze({ answer: value, skipped: answer.skipped });
}

function raceWithAbort<Value>(operation: Promise<Value>, signal: AbortSignal): Promise<Value> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const finish = (callback: (value: Value) => void, value: Value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onAbort = () => fail(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then((value) => finish(resolve, value), fail);
    if (signal.aborted) onAbort();
  });
}

function abortError(): DOMException {
  return new DOMException("用户问题等待已取消。", "AbortError");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function apply(ctx: Context): void {
  const service = new UserQuestionServiceRuntime();
  ctx.provide(name, service);
  ctx.effect(() => () => service.close());
}
