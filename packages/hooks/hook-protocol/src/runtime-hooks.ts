/**
 * 功能：提供只读、类型化的 AI 推理生命周期钩子。
 * 作用：允许受信任 Cordis 插件观察推理，并在模型目录范围内建议单次请求的账户/思考档位；不能改写上下文、授权或工具。
 * 关联文件：packages/boot/app-boot/src/ai-host.ts、packages/api/gateway/src/index.ts。
 */
import { Service, type Context } from "@deepseek-ai/cordis";
import type { ApplicationId } from "lfaa-settings/src/preferences/service.js";
import type { AiModelRouteOption } from "lfaa-settings/src/service.js";

export interface AiBeforeInferenceEvent {
  requestId: string;
  applicationId: ApplicationId;
  providerId: string;
  modelId: string;
  messageCount: number;
}

export interface AiAfterInferenceEvent extends AiBeforeInferenceEvent {
  status: "complete" | "error" | "interrupted";
  promptTokens: number | null;
  completionTokens: number | null;
}

/** 当前一次模型请求的路由输入。正文只含最近一条用户文本且有长度上限，不包含密钥或账户连接信息。 */
export interface AiRequestRouteEvent {
  requestId: string;
  applicationId: ApplicationId;
  selectedAccountId: string;
  providerId: string;
  modelId: string;
  reasoningMode: string;
  latestUserText: string;
  routeOptions: readonly (Readonly<Omit<AiModelRouteOption, "reasoningModes">> & { readonly reasoningModes: readonly string[] })[];
  signal: AbortSignal;
}

/** 插件只可建议当前账户已配置的模型账户及其模型目录支持的思考档位。 */
export interface AiRequestRouteSelection {
  accountId?: string;
  modelId?: string;
  reasoningMode?: string;
}

export interface AiRequestRouteProposal {
  hookId: string;
  selection: AiRequestRouteSelection;
}

export interface AiRuntimeHook {
  beforeInference?: (event: Readonly<AiBeforeInferenceEvent>) => void;
  afterInference?: (event: Readonly<AiAfterInferenceEvent>) => void;
  requestRoute?: (event: Readonly<AiRequestRouteEvent>) => AiRequestRouteSelection | void | Promise<AiRequestRouteSelection | void>;
}

export interface AiRuntimeHookInfo {
  id: string;
  events: Array<"beforeInference" | "afterInference" | "requestRoute">;
}

export interface AiRuntimeHookResult {
  failedHookIds: string[];
}

export interface AiRequestRouteResult extends AiRuntimeHookResult {
  proposals: AiRequestRouteProposal[];
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    aiRuntimeHooks: AiRuntimeHookRegistry;
  }
}

export class AiRuntimeHookRegistry extends Service {
  private readonly hooks = new Map<string, Readonly<AiRuntimeHook>>();

  constructor(ctx: Context) {
    super(ctx, "aiRuntimeHooks");
  }

  register(owner: Context, id: string, hook: AiRuntimeHook): void {
    owner.effect(() => {
      if (!/^[a-z0-9][a-z0-9._-]{1,119}$/u.test(id)) throw new Error("AI Runtime Hook ID 格式无效。");
      if (!hook.beforeInference && !hook.afterInference && !hook.requestRoute) throw new Error("AI Runtime Hook 至少需要订阅一个事件。");
      if (this.hooks.has(id)) throw new Error(`AI Runtime Hook ID 已注册：${id}`);

      const registered = Object.freeze({ ...hook });
      this.hooks.set(id, registered);
      return () => {
        if (this.hooks.get(id) === registered) this.hooks.delete(id);
      };
    }, `ai-runtime-hook:${id}`);
  }

  list(): AiRuntimeHookInfo[] {
    return [...this.hooks.entries()]
      .map(([id, hook]) => ({
        id,
        events: (Object.keys(hook) as Array<keyof AiRuntimeHook>).filter((event): event is keyof AiRuntimeHook => typeof hook[event] === "function")
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  beforeInference(event: Readonly<AiBeforeInferenceEvent>): AiRuntimeHookResult {
    return this.dispatch("beforeInference", event);
  }

  afterInference(event: Readonly<AiAfterInferenceEvent>): AiRuntimeHookResult {
    return this.dispatch("afterInference", event);
  }

  async requestRoute(event: Readonly<AiRequestRouteEvent>): Promise<AiRequestRouteResult> {
    const failedHookIds: string[] = [];
    const proposals: AiRequestRouteProposal[] = [];
    const readonlyEvent: Readonly<AiRequestRouteEvent> = Object.freeze({
      ...event,
      routeOptions: Object.freeze(event.routeOptions.map(option => Object.freeze({ ...option, reasoningModes: Object.freeze([...option.reasoningModes]) })))
    });
    for (const [id, hook] of this.hooks) {
      if (!hook.requestRoute) continue;
      if (event.signal.aborted) break;
      try {
        const selectionResult = await resolveWithAbort(hook.requestRoute(readonlyEvent), event.signal);
        if (selectionResult.aborted) break;
        const selection = selectionResult.value;
        if (selection === undefined) continue;
        if (!isRecord(selection)
          || Object.keys(selection).some(key => key !== "accountId" && key !== "modelId" && key !== "reasoningMode")
          || selection.accountId !== undefined && (typeof selection.accountId !== "string" || selection.accountId.length > 160)
          || selection.modelId !== undefined && (typeof selection.modelId !== "string" || selection.modelId.length < 1 || selection.modelId.length > 200)
          || selection.reasoningMode !== undefined && (typeof selection.reasoningMode !== "string" || selection.reasoningMode.length > 32)
          || selection.accountId === undefined && selection.modelId === undefined && selection.reasoningMode === undefined) {
          failedHookIds.push(id);
          continue;
        }
        proposals.push({ hookId: id, selection: { ...selection } });
      } catch {
        failedHookIds.push(id);
      }
    }
    return { proposals, failedHookIds };
  }

  private dispatch<K extends "beforeInference" | "afterInference">(eventName: K, event: Parameters<NonNullable<Pick<AiRuntimeHook, K>[K]>>[0]): AiRuntimeHookResult {
    const failedHookIds: string[] = [];
    const readonlyEvent = Object.freeze({ ...event });
    for (const [id, hook] of this.hooks) {
      const callback = hook[eventName] as ((value: typeof readonlyEvent) => void) | undefined;
      if (!callback) continue;
      try {
        callback(readonlyEvent);
      } catch {
        failedHookIds.push(id);
      }
    }
    return { failedHookIds };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveWithAbort<T>(promise: T | Promise<T>, signal: AbortSignal): Promise<{ aborted: true } | { aborted: false; value: T }> {
  if (signal.aborted) return Promise.resolve({ aborted: true });
  return new Promise((resolveResult, rejectResult) => {
    const onAbort = () => resolveResult({ aborted: true });
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(promise).then(
      value => resolveResult({ aborted: false, value }),
      error => rejectResult(error)
    ).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

export function runtimeHooks(ctx: Context): void {
  new AiRuntimeHookRegistry(ctx);
}

export default runtimeHooks;
