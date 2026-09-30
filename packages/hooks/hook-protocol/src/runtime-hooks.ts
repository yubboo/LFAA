/**
 * 功能：提供只读、类型化的 AI 推理生命周期钩子。
 * 作用：允许受信任 Cordis 插件观察推理开始与结束；钩子不能改写上下文、授权或 Provider 请求。
 * 关联文件：packages/boot/app-boot/src/ai-host.ts、packages/api/gateway/src/index.ts。
 */
import { Service, type Context } from "@deepseek-ai/cordis";
import type { ApplicationId } from "lfaa-settings/src/preferences/service.js";

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

export interface AiRuntimeHook {
  beforeInference?: (event: Readonly<AiBeforeInferenceEvent>) => void;
  afterInference?: (event: Readonly<AiAfterInferenceEvent>) => void;
}

export interface AiRuntimeHookInfo {
  id: string;
  events: Array<"beforeInference" | "afterInference">;
}

export interface AiRuntimeHookResult {
  failedHookIds: string[];
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
      if (!hook.beforeInference && !hook.afterInference) throw new Error("AI Runtime Hook 至少需要订阅一个事件。");
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

  private dispatch<K extends keyof AiRuntimeHook>(eventName: K, event: Parameters<NonNullable<AiRuntimeHook[K]>>[0]): AiRuntimeHookResult {
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

export function runtimeHooks(ctx: Context): void {
  new AiRuntimeHookRegistry(ctx);
}

export default runtimeHooks;
