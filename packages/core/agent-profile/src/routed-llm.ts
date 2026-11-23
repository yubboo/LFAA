// @lfaa/agent-profile 派发层：按绑定逐个尝试候选目标，失败按分类换目标，首 token 之后不再换。
// 只实现运行循环真正用到的 complete / resolveProfile，其余能力仍由 @lfaa/llm 提供。
import type { LlmGenerateInput, LlmGenerateOutput, LlmProfile, LlmService } from "@lfaa/llm";
import { classifyError, planRoute, type ErrorClass, type RouteCandidate, type RoutePlan } from "./routing";
import { isInheritGlobal, type ModelBinding } from "./types";

/** 一次目标的尝试结果，供运行事件与界面显示「这轮为什么换了模型」。 */
export interface RoutedAttempt {
  bindingId: string;
  target: RouteCandidate;
  outcome: "success" | "failed";
  errorClass?: ErrorClass;
  error?: string;
}

/** 绑定来源：正式服务或测试桩。 */
export interface BindingSource {
  getBinding(id: string): Promise<ModelBinding | undefined>;
  resolveBindingId(agentId?: string, overrideId?: string): Promise<string>;
}

/** 派发器依赖：模型服务 + 绑定来源 + 本次运行的 agent / 覆盖信息。 */
export interface RoutedLlmDeps {
  llm: Pick<LlmService, "complete" | "resolveProfile" | "listPublicProfiles">;
  bindings: BindingSource;
  /** 本次运行使用的 agent；缺省表示沿用会话/全局默认。 */
  agentId?: string;
  /** 会话级临时覆盖，优先于 agent 自身绑定。 */
  bindingId?: string;
  /** 轮换游标（同一绑定的第几次运行），供 rotate 策略使用。 */
  rotationIndex?: number;
  /** 本地累计调用次数，供 usage 策略使用。 */
  usageCounts?: Readonly<Record<string, number>>;
  onAttempt?: (attempt: RoutedAttempt) => void;
}

/** 运行循环对模型服务的最小需求；结构化兼容真实 LlmService 与派发器。 */
export type RunLlm = Pick<LlmService, "complete" | "resolveProfile">;

/** 把一次调用的失败归到「换目标」还是「直接抛」；不认识的错误一律不换。 */
function shouldSwitch(error: unknown, binding: ModelBinding, emitted: boolean, lastCandidate: boolean): boolean {
  if (emitted) return false;
  if (lastCandidate) return false;
  if (binding.onError === "fail") return false;
  return classifyError(error) === "next-target";
}

/**
 * 创建本次运行专用的模型派发器：
 * - 调用方显式给了 profileId（会话强制指定、工具直连）→ 完全沿用改造前行为；
 * - 绑定缺失 → 直接报错，不静默退回全局，否则用户配了个错 id 会一直查不出原因；
 * - 绑定是内置 default 或没有任何可用候选 → 交回全局默认配置。
 */
export function createRoutedLlm(deps: RoutedLlmDeps): RunLlm {
  /** 绑定与候选每轮都一样，按运行缓存，避免每个思考轮都读两次配置文件。 */
  let planPromise: Promise<{ binding: ModelBinding; plan: RoutePlan } | undefined> | undefined;

  const loadPlan = async (): Promise<{ binding: ModelBinding; plan: RoutePlan } | undefined> => {
    planPromise ??= (async () => {
      const bindingId = await deps.bindings.resolveBindingId(deps.agentId, deps.bindingId);
      const binding = await deps.bindings.getBinding(bindingId);
      if (!binding) throw new Error(`模型绑定不存在：${bindingId}。请到 Agents 页重新选择模型。`);
      const { profiles } = await deps.llm.listPublicProfiles();
      const plan = planRoute(binding, {
        availableProfileIds: new Set(profiles.map((profile) => profile.id)),
        ...(deps.rotationIndex !== undefined ? { rotationIndex: deps.rotationIndex } : {}),
        ...(deps.usageCounts ? { usageCounts: deps.usageCounts } : {}),
      });
      return { binding, plan };
    })();
    return planPromise;
  };

  const complete = async (input: LlmGenerateInput): Promise<LlmGenerateOutput> => {
    // 调用方指定了配置就按它走：这条路径必须与改造前逐字节一致。
    if (input.profileId) return deps.llm.complete(input);
    const loaded = await loadPlan();
    if (!loaded || loaded.plan.inheritGlobal || loaded.plan.candidates.length === 0) {
      if (loaded && !loaded.plan.inheritGlobal && loaded.plan.candidates.length === 0) {
        const skipped = loaded.plan.skipped.map((item) => item.target.profileId).join("、") || "（空绑定）";
        throw new Error(`模型绑定「${loaded.binding.name}」没有可用目标：${skipped} 都不在模型配置里。`);
      }
      return deps.llm.complete(input);
    }

    const { binding, plan } = loaded;
    // emitted 跨候选保持：一旦向调用方发过内容，后续任何失败都不再换目标，避免拼接两段输出。
    let emitted = false;
    let lastError: unknown;
    for (const [index, candidate] of plan.candidates.entries()) {
      const lastCandidate = index === plan.candidates.length - 1;
      try {
        const output = await deps.llm.complete({
          ...input,
          profileId: candidate.profileId,
          ...(candidate.modelId ? { modelId: candidate.modelId } : {}),
          onDelta: (delta) => {
            if (delta.text || delta.toolCallId) emitted = true;
            input.onDelta?.(delta);
          },
        });
        deps.onAttempt?.({ bindingId: binding.id, target: candidate, outcome: "success" });
        return output;
      } catch (error) {
        lastError = error;
        const errorClass = classifyError(error);
        deps.onAttempt?.({
          bindingId: binding.id,
          target: candidate,
          outcome: "failed",
          errorClass,
          error: error instanceof Error ? error.message : String(error),
        });
        if (!shouldSwitch(error, binding, emitted, lastCandidate)) throw error;
      }
    }
    throw lastError;
  };

  const resolveProfile = async (profileId?: string): Promise<LlmProfile> => {
    if (profileId) return deps.llm.resolveProfile(profileId);
    const loaded = await loadPlan();
    const first = loaded?.plan.candidates[0];
    if (loaded && first && !isInheritGlobal(loaded.binding)) return deps.llm.resolveProfile(first.profileId);
    return deps.llm.resolveProfile(undefined);
  };

  return { complete, resolveProfile };
}