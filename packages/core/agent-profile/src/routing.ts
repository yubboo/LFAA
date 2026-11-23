// @lfaa/agent-profile 路由解析：把一份绑定摊平成有序候选队列，并判断哪些错误值得换目标。
// 纯函数，不碰网络与文件；派发层（routed-llm.ts）只消费这里的结果，便于单独测策略与判定。
import { isInheritGlobal, type BindingTarget, type ModelBinding } from "./types";

/** 被跳过的候选及原因；用于诊断与「为什么这次没走我配的模型」的界面提示。 */
export interface SkippedTarget {
  target: BindingTarget;
  reason: "missing-profile" | "duplicate";
}

/** 一个可尝试的候选；targetIndex 保留原始顺序，便于回看时对应到绑定里的第几项。 */
export interface RouteCandidate {
  profileId: string;
  modelId?: string;
  targetIndex: number;
}

/** 解析结果：候选队列 + 跳过项 + 是否走「跟随全局」。 */
export interface RoutePlan {
  candidates: RouteCandidate[];
  skipped: SkippedTarget[];
  /** 为 true 时没有候选，调用方应沿用全局默认配置，而不是报错。 */
  inheritGlobal: boolean;
}

/** 解析绑定需要的环境信息。 */
export interface RouteContext {
  /** 真实存在的模型配置 id 集合；不在集合里的目标直接跳过，避免把请求送到不存在的配置。 */
  availableProfileIds: ReadonlySet<string>;
  /** 轮换游标：同一绑定的第 N 次运行用它决定从第几个目标开始。 */
  rotationIndex?: number;
  /** 本地累计调用次数，供 usage 策略排序（缺省视为 0）。 */
  usageCounts?: Readonly<Record<string, number>>;
}

/** 目标转候选；modelId 为空串时不带上，交给配置自己的当前模型。 */
function toCandidate(target: BindingTarget, targetIndex: number): RouteCandidate {
  const modelId = target.modelId?.trim();
  return modelId
    ? { profileId: target.profileId, modelId, targetIndex }
    : { profileId: target.profileId, targetIndex };
}

/** 按策略重排候选；rotate 与 usage 会改变顺序，其余保持配置顺序。 */
function orderCandidates(
  candidates: RouteCandidate[],
  binding: ModelBinding,
  context: RouteContext,
): RouteCandidate[] {
  if (binding.strategy === "rotate" && candidates.length > 1) {
    const offset = Math.abs(Math.floor(context.rotationIndex ?? 0)) % candidates.length;
    return [...candidates.slice(offset), ...candidates.slice(0, offset)];
  }
  if (binding.strategy === "usage" && candidates.length > 1) {
    const usage = context.usageCounts ?? {};
    // 用量相同时按配置顺序，保证同一份配置每次的排序可复现。
    return [...candidates].sort((left, right) =>
      (usage[left.profileId] ?? 0) - (usage[right.profileId] ?? 0) || left.targetIndex - right.targetIndex);
  }
  return candidates;
}

/**
 * 把绑定解析成有序候选队列：
 * 1. 内置 default（inheritGlobal）不产出候选，交回全局配置；
 * 2. 配置不存在的目标跳过并记录原因；
 * 3. 同一 profile + model 只保留第一次出现；
 * 4. 最后按策略排序（single / order 保持原序）。
 */
export function planRoute(binding: ModelBinding, context: RouteContext): RoutePlan {
  if (isInheritGlobal(binding)) {
    return { candidates: [], skipped: [], inheritGlobal: true };
  }
  const skipped: SkippedTarget[] = [];
  const seen = new Set<string>();
  const candidates: RouteCandidate[] = [];
  binding.targets.forEach((target, index) => {
    if (!context.availableProfileIds.has(target.profileId)) {
      skipped.push({ target, reason: "missing-profile" });
      return;
    }
    const key = `${target.profileId}\u0000${target.modelId ?? ""}`;
    if (seen.has(key)) {
      skipped.push({ target, reason: "duplicate" });
      return;
    }
    seen.add(key);
    candidates.push(toCandidate(target, index));
  });
  return { candidates: orderCandidates(candidates, binding, context), skipped, inheritGlobal: false };
}

/** 错误处理类别：立刻抛出、换下一个目标、或交给上层短重试。 */
export type ErrorClass = "fatal" | "next-target" | "retryable";

const RETRYABLE_NETWORK_CODES = new Set([
  "EAI_AGAIN", "ECONNABORTED", "ECONNRESET", "EPIPE", "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET",
]);

/** 从错误文案里读 HTTP 状态：既认「401 认证失败」，也认「模型接口返回错误 (502)」。 */
function readHttpStatus(message: string): number | undefined {
  const leading = /^(?:模型接口返回错误\s*)?\(?(\d{3})\)?/u.exec(message.trim());
  const status = leading?.[1];
  return status ? Number(status) : undefined;
}

/**
 * 分类一次模型调用失败：
 * - 429 / 5xx / 408 / 超时断网 → next-target（换账号、换厂商通常真能救）；
 * - 401 / 402 / 403 → next-target（这把 Key 不行不代表下一个不行）；
 * - 400 与其他 4xx → fatal（换谁都一样，别浪费额度）；
 * - 未知错误 → fatal（宁可报错，也不要静默换模型把问题藏起来）。
 */
export function classifyError(error: unknown): ErrorClass {
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) return "fatal";
  const message = error instanceof Error ? error.message : String(error);
  if (!message.trim()) return "fatal";

  const status = readHttpStatus(message);
  if (status !== undefined) {
    if (status === 429 || status === 408) return "next-target";
    if (status >= 500) return "next-target";
    if (status === 401 || status === 402 || status === 403) return "next-target";
    return "fatal";
  }

  if (/AbortError|aborted|已取消|主动停止/u.test(message)) return "fatal";
  if (/认证失败|余额不足|额度不足|rate.?limit|too many requests|quota/iu.test(message)) {
    return "next-target";
  }
  const cause = (error as { cause?: unknown }).cause;
  const code = cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string"
    ? cause.code
    : /(?:（|\(|\b)([A-Z][A-Z0-9_]{2,40})(?:）|\)|\b)/u.exec(message)?.[1];
  if (code && RETRYABLE_NETWORK_CODES.has(code)) return "next-target";
  if (/fetch failed|terminated|socket hang up|network|timeout|timed out|超时|连接失败/iu.test(message)) {
    return "next-target";
  }
  return "fatal";
}