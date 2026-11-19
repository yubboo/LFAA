// 会话状态栏：显示轮次/步数、token 用量与上下文占用，点击展开明细浮层。
import { useRef, useState } from "react";
import { IconChartPie, IconClock, IconCoin } from "@tabler/icons-react";
import { PopoverCard } from "@lfaa/ui-primitives/client";
import type { ChatMessageItem } from "../chat-types";
import type { ChatLocaleMessages } from "../locales";
import { computeSessionMetrics, formatCompactTokens, formatCost, formatDurationMs } from "@lfaa/metrics";
import styles from "./SessionStatsBar.module.css";

type Panel = "context" | "usage" | "stats" | null;

/** 输入框下方的会话状态栏；没有数据时不渲染。 */
export function SessionStatsBar({
  messages,
  locale,
  draftChars = 0,
  estimatedContextTokens,
}: {
  messages: ChatMessageItem[];
  locale: ChatLocaleMessages;
  draftChars?: number;
  /** 无消息指标时的输入框上下文估算（token），用于把上下文移到输入框下方展示。 */
  estimatedContextTokens?: number;
}) {
  const [open, setOpen] = useState<Panel>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const metrics = computeSessionMetrics(messages, { extraChars: draftChars });
  const context = metrics.context;
  const estimatedTokens = estimatedContextTokens && estimatedContextTokens > 0 ? estimatedContextTokens : undefined;
  const isZh = locale.isZh;

  if (metrics.turns === 0 && metrics.totalTokens === 0 && !context && !estimatedTokens) return null;

  const toggle = (panel: Exclude<Panel, null>) => setOpen((current) => (current === panel ? null : panel));
  const close = () => setOpen(null);
  const tps = metrics.tokensPerSecond;
  const cache = metrics.cacheHitRate;
  const contextLabel = context
    ? (typeof context.percent === "number"
      ? `${locale.sessionContext} ${context.percent}%`
      : `${locale.sessionContext} ~${formatCompactTokens(context.totalTokens)} tok`)
    : estimatedTokens
      ? `${locale.sessionContext} ~${formatCompactTokens(estimatedTokens)} tok`
      : "";

  return (
    <div
      ref={barRef}
      className={styles.bar}
      role="group"
      aria-label={isZh ? "会话统计" : "Session statistics"}
    >
      {(context || estimatedTokens) && (
        <button
          type="button"
          className={styles.trigger}
          aria-expanded={open === "context"}
          aria-label={context
            ? (isZh ? `上下文已用 ${context.percent ?? 0}%` : `Context used ${context.percent ?? 0}%`)
            : (isZh ? "上下文估算用量" : "Estimated context tokens")}
          onClick={() => toggle("context")}
        >
          <IconChartPie size={12} aria-hidden="true" />
          <span>{contextLabel}</span>
        </button>
      )}
      {metrics.totalTokens > 0 && (
        <button
          type="button"
          className={styles.trigger}
          aria-expanded={open === "usage"}
          aria-label={isZh ? "Token 用量" : "Token usage"}
          onClick={() => toggle("usage")}
        >
          <IconCoin size={12} aria-hidden="true" />
          <span>{`${formatCompactTokens(metrics.totalTokens)} tok`}</span>
          {cache !== undefined && <span>{`${locale.sessionCache} ${(cache * 100).toFixed(1)}%`}</span>}
          {metrics.cost && <span>{`≈ ${formatCost(metrics.cost.amount)}`}</span>}
        </button>
      )}
      {metrics.turns > 0 && (
        <button
          type="button"
          className={styles.trigger}
          aria-expanded={open === "stats"}
          aria-label={isZh ? "会话统计" : "Session statistics"}
          onClick={() => toggle("stats")}
        >
          <IconClock size={12} aria-hidden="true" />
          <span>{`${metrics.turns} ${locale.sessionTurns} · ${metrics.steps} ${locale.sessionSteps}`}</span>
          {tps !== undefined && <span>{`${Math.round(tps)} tok/s`}</span>}
        </button>
      )}

      <PopoverCard
        open={open === "context"}
        label={isZh ? "上下文占用" : "Context usage"}
        placement="top-end"
        anchorRef={barRef}
        onClose={close}
      >
        <div className={styles.panel}>
          <div className={styles.panelTitle}>{isZh ? "上下文已用" : "Context used"}</div>
          {context ? (
            <>
              <div className={styles.headline}>
                <strong>{typeof context.percent === "number" ? `${context.percent}%` : "—"}</strong>
                <span>
                  {context.windowTokens
                    ? `~${formatCompactTokens(context.totalTokens)} / ${formatCompactTokens(context.windowTokens)} tok`
                    : `~${formatCompactTokens(context.totalTokens)} tok`}
                </span>
              </div>
              {typeof context.percent === "number" && (
                <div className={styles.meter} aria-hidden="true">
                  <span style={{ width: `${context.percent}%` }} />
                </div>
              )}
              <div className={styles.rows}>
                <Row label={isZh ? "系统提示词" : "System prompt"} value={`~${formatCompactTokens(context.systemTokens)}`} />
                <Row label={isZh ? "工具定义" : "Tool definitions"} value={`~${formatCompactTokens(context.toolsTokens)}`} />
                <Row label={isZh ? "对话消息" : "Conversation"} value={`~${formatCompactTokens(context.messageTokens)}`} />
              </div>
              {typeof context.percent !== "number" && (
                <p className={styles.hint}>
                  {isZh
                    ? "未配置模型上下文窗口，暂无占比。可在「配置模型」中填写窗口 token 数。"
                    : "No model context window configured. Set it in the model settings to see a percentage."}
                </p>
              )}
            </>
          ) : estimatedTokens ? (
            <>
              <div className={styles.headline}>
                <strong>{`~${formatCompactTokens(estimatedTokens)}`}</strong>
                <span>tok</span>
              </div>
              <p className={styles.hint}>
                {isZh
                  ? "运行后显示系统提示、工具定义与对话消息的拆分。"
                  : "The system / tools / conversation breakdown appears after the next run."}
              </p>
            </>
          ) : null}
        </div>
      </PopoverCard>

      <PopoverCard
        open={open === "usage"}
        label={isZh ? "Token 用量" : "Token usage"}
        placement="top-end"
        anchorRef={barRef}
        onClose={close}
      >
        <div className={styles.panel}>
          <div className={styles.panelTitle}>{isZh ? "Token 用量" : "Token usage"}</div>
          <div className={styles.rows}>
            <Row label={isZh ? "总计" : "Total"} value={`${metrics.totalTokens.toLocaleString()} tok`} strong />
            {cache !== undefined && <Row label={isZh ? "缓存命中" : "Cache hit"} value={`${(cache * 100).toFixed(1)}%`} />}
            <Row
              label={isZh ? "未缓存输入" : "Uncached input"}
              value={`${Math.max(0, metrics.promptTokens - metrics.cachedPromptTokens).toLocaleString()} tok`}
            />
            <Row
              label={isZh ? "缓存读取" : "Cache read"}
              value={`${metrics.cachedPromptTokens.toLocaleString()} tok`}
            />
            <Row label={isZh ? "输出" : "Output"} value={`${metrics.completionTokens.toLocaleString()} tok`} />
            {metrics.cost && (
              <>
                <Row label={isZh ? "输入成本" : "Input cost"} value={formatCost(metrics.cost.input)} />
                <Row label={isZh ? "缓存成本" : "Cached input cost"} value={formatCost(metrics.cost.cachedInput)} />
                <Row label={isZh ? "输出成本" : "Output cost"} value={formatCost(metrics.cost.output)} />
                <Row label={isZh ? "合计成本" : "Total cost"} value={formatCost(metrics.cost.amount)} strong />
              </>
            )}
          </div>
        </div>
      </PopoverCard>

      <PopoverCard
        open={open === "stats"}
        label={isZh ? "会话统计" : "Session statistics"}
        placement="top-end"
        anchorRef={barRef}
        onClose={close}
      >
        <div className={styles.panel}>
          <div className={styles.panelTitle}>{isZh ? "会话统计" : "Session statistics"}</div>
          <div className={styles.headline}>
            <strong>{`${metrics.turns} ${locale.sessionTurns} ${metrics.steps} ${locale.sessionSteps}`}</strong>
          </div>
          <div className={styles.rows}>
            <Row label={isZh ? "模型用时" : "Model time"} value={formatDurationMs(metrics.llmMs, isZh)} />
            <Row label={isZh ? "工具调用用时" : "Tool time"} value={formatDurationMs(metrics.toolMs, isZh)} />
            <Row
              label={isZh ? "首 token 平均（TTFT）" : "Avg time to first token"}
              value={metrics.ttftSteps > 0 ? formatDurationMs(metrics.ttftMs / metrics.ttftSteps, isZh) : "—"}
            />
            <Row
              label={isZh ? "输出速度（TPS）" : "Output speed"}
              value={tps !== undefined ? `${Math.round(tps)} tok/s` : "—"}
            />
          </div>
        </div>
      </PopoverCard>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={styles.row}>
      <span>{label}</span>
      <span className={strong ? styles.strong : undefined}>{value}</span>
    </div>
  );
}
