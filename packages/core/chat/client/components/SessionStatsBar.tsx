// 会话状态栏：显示轮次/步数、token 用量与上下文占用，点击展开明细浮层。
import { useRef, useState, type ReactNode } from "react";
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
  showContext = true,
  leading,
}: {
  messages: ChatMessageItem[];
  locale: ChatLocaleMessages;
  showContext?: boolean;
  leading?: ReactNode;
}) {
  const [open, setOpen] = useState<Panel>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const metrics = computeSessionMetrics(messages);
  const context = metrics.context;
  const isZh = locale.isZh;

  if (metrics.turns === 0 && metrics.totalTokens === 0 && !context && !leading) return null;

  const toggle = (panel: Exclude<Panel, null>) => setOpen((current) => (current === panel ? null : panel));
  const close = () => setOpen(null);
  const tps = metrics.tokensPerSecond;
  const cache = metrics.cacheMeasurement ? metrics.cacheHitRate : undefined;
  const percent = context?.percent?.toFixed(1);
  const contextLabel = context ? (context.windowTokens
    ? `${locale.sessionContext} ${formatCompactTokens(context.totalTokens)} / ${formatCompactTokens(context.windowTokens)}`
    : `${locale.sessionContext} ${formatCompactTokens(context.totalTokens)} tok`)
    : isZh ? "上下文暂无数据" : "Context unavailable";

  return (
    <div
      ref={barRef}
      className={styles.bar}
      role="group"
      aria-label={isZh ? "会话统计" : "Session statistics"}
    >
      {leading}
      {showContext && messages.length > 0 && (
        <button
          type="button"
          className={styles.trigger}
          aria-expanded={open === "context"}
          aria-label={contextLabel}
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
          {cache !== undefined && <span>{`${isZh ? "上报缓存" : "Reported cache"} ${(cache * 100).toFixed(1)}%`}</span>}
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
          <div className={styles.panelTitle}>{isZh ? "最近一次模型请求的上下文" : "Context for the latest model request"}</div>
          {context ? (
            <>
              <Row label={isZh ? "实际输入" : "Reported input"} value={context.totalTokens.toLocaleString() + " tok"} strong />
              {context.model && <Row label={isZh ? "响应模型" : "Response model"} value={context.model} />}
              {context.windowTokens && (
                <Row label={context.windowSource === "configured" ? (isZh ? "档案配置窗口" : "Configured window") : (isZh ? "供应商规格窗口" : "Provider-specified window")} value={context.windowTokens.toLocaleString() + " tok"} />
              )}
              {percent !== undefined && (
                <>
                  <Row label={isZh ? "占用" : "Used"} value={percent + "%"} />
                  <div className={styles.meter} aria-hidden="true"><span style={{ width: Math.min(100, Number(percent)) + "%" }} /></div>
                </>
              )}
              {!context.windowTokens && <p className={styles.hint}>{isZh ? "此响应模型的窗口大小暂无可靠数据。" : "No verified context limit for this response model."}</p>}
            </>
          ) : <p className={styles.hint}>{isZh ? "最近的会话记录暂无模型实际输入量。" : "The latest chat record has no reported input count."}</p>}
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
            {metrics.cacheMeasurement && cache !== undefined ? (
              <>
                <Row label={isZh ? "缓存命中率（有上报的请求）" : "Cache hit (reported requests)"} value={(cache * 100).toFixed(1) + "%"} />
                <Row label={isZh ? "计入缓存统计的输入" : "Measured input"} value={metrics.cacheMeasurement.promptTokens.toLocaleString() + " tok"} />
                <Row label={isZh ? "缓存读取" : "Cache read"} value={metrics.cacheMeasurement.cachedTokens.toLocaleString() + " tok"} />
              </>
            ) : <Row label={isZh ? "缓存命中率" : "Cache hit"} value={isZh ? "暂无可核对数据" : "Unavailable"} />}
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
