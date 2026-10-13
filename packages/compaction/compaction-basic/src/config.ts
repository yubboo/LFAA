/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），
 * 包名 @deepseek-ai/dsh-compaction-basic。
 *
 * 文件：config.ts
 * 功能：加载期校验 + 配置解析。把插件传入的不可信 BasicCompactionConfig 解析成
 *       冻结的 ResolvedBasicCompactionConfig；非法值在插件构造期就抛错。
 *
 * LFAA 适配说明：DSH 用 @deepseek-ai/schemastery 声明式 schema 校验，并且支持
 * per-provider/per-model 的 modelPolicies 覆盖表。LFAA 这里手写轻量校验（不引入
 * schemastery 依赖，保持本包零外部校验库），per-model 策略表暂不支持——后续若需要，
 * 在本包内追加 resolveTargetPolicy 即可，不影响现有字段。
 *
 * 接入点：cordis 插件 config（见 packages/bundle/base/cordis.patch.yml 本包行的 config 字段）；
 * 也可在代码里直接传 BasicCompactionConfig 给 createBasicCompactionEngine。
 */
import type {
  BasicCompactionConfig,
  ResolvedBasicCompactionConfig,
} from "./types.js";

/** 默认压力触发比例（已用/窗口）。 */
export const DEFAULT_THRESHOLD_RATIO = 0.8;
/** 默认保留尾部 user 回合数。 */
export const DEFAULT_PRESERVE_RECENT_TURNS = 8;
/** 默认摘要最大输出 token。 */
export const DEFAULT_SUMMARY_MAX_TOKENS = 1024;
/** 默认摘要正文硬截断字符数。 */
export const DEFAULT_SUMMARY_MAX_CHARS = 4096;

/**
 * 解析并校验插件配置。任何非法字段都在构造期抛错，避免运行到一半才炸。
 * 返回值用 Object.freeze 冻结，引擎内部不会再改。
 */
export function resolveBasicCompactionConfig(
  config: BasicCompactionConfig = {},
): ResolvedBasicCompactionConfig {
  const thresholdRatio = config.thresholdRatio ?? DEFAULT_THRESHOLD_RATIO;
  if (typeof thresholdRatio !== "number"
    || !Number.isFinite(thresholdRatio)
    || thresholdRatio <= 0
    || thresholdRatio > 1) {
    throw new Error(
      `BasicCompactionConfig.thresholdRatio 必须在 (0,1] 内，收到 ${String(thresholdRatio)}`,
    );
  }

  const preserveRecentTurns = config.preserveRecentTurns ?? DEFAULT_PRESERVE_RECENT_TURNS;
  if (!Number.isInteger(preserveRecentTurns) || preserveRecentTurns < 0) {
    throw new Error(
      `BasicCompactionConfig.preserveRecentTurns 必须是非负整数，收到 ${String(preserveRecentTurns)}`,
    );
  }

  const summaryMaxTokens = config.summaryMaxTokens ?? DEFAULT_SUMMARY_MAX_TOKENS;
  if (!Number.isInteger(summaryMaxTokens) || summaryMaxTokens <= 0) {
    throw new Error(
      `BasicCompactionConfig.summaryMaxTokens 必须是正整数，收到 ${String(summaryMaxTokens)}`,
    );
  }

  const summaryMaxChars = config.summaryMaxChars ?? DEFAULT_SUMMARY_MAX_CHARS;
  if (!Number.isInteger(summaryMaxChars) || summaryMaxChars <= 0) {
    throw new Error(
      `BasicCompactionConfig.summaryMaxChars 必须是正整数，收到 ${String(summaryMaxChars)}`,
    );
  }

  const auto = config.auto ?? true;
  if (typeof auto !== "boolean") {
    throw new Error(`BasicCompactionConfig.auto 必须是布尔值，收到 ${String(config.auto)}`);
  }

  return Object.freeze({
    thresholdRatio,
    preserveRecentTurns,
    summaryMaxTokens,
    summaryMaxChars,
    auto,
  });
}
