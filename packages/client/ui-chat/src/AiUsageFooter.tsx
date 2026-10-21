import { memo } from "react";
import { Button, Popover } from "antd";
import type { AiContextUsage, AiSessionUsageModelSummary, AiSessionUsageSummary } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { projectAiSessionUsageDisplay } from "./usage-summary.js";

const integer = new Intl.NumberFormat("zh-CN");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const tokenCount = (value: number | null): string => value === null ? "Provider 未提供" : `${integer.format(value)} tokens`;
const compactCount = (value: number | null): string => value === null ? "用量未知" : `${compact.format(value)} tok`;
const total = (left: number | null, right: number | null): number | null => left === null || right === null ? null : left + right;

export type AiUsageLoadState = "loading" | "ready" | "error";

function cachePercent(model: AiSessionUsageModelSummary): number | null {
  if (model.promptTokens === null || model.cacheReadTokens === null || model.cacheReadTokens > model.promptTokens || model.promptTokens === 0) return null;
  return model.cacheReadTokens / model.promptTokens * 100;
}

function CacheDetails({ summary }: { summary: AiSessionUsageSummary | null }) {
  if (!summary || summary.models.length === 0) return <div className="ai-work-chat__usage-popover"><strong>缓存用量</strong><p>当前会话还没有 Provider 用量记录。</p></div>;
  const input = summary.promptTokens;
  const cached = summary.cacheReadTokens;
  return <div className="ai-work-chat__usage-popover">
    <strong>会话 Token 用量</strong>
    <div className="ai-work-chat__usage-popover-total"><span>总用量</span><b>{tokenCount(total(summary.promptTokens, summary.completionTokens))}</b></div>
    {summary.models.map(model => {
      const percent = cachePercent(model);
      const uncached = model.promptTokens !== null && model.cacheReadTokens !== null && model.cacheReadTokens <= model.promptTokens
        ? `${integer.format(model.promptTokens - model.cacheReadTokens)} tokens`
        : model.promptTokens === null ? "输入用量未知" : "缓存分项不完整";
      const cacheCoverage = model.cacheReadReportedRequestCount === null
        ? model.requestCountExact ? "覆盖数不可用" : "旧记录未保存覆盖数"
        : `${integer.format(model.cacheReadReportedRequestCount)} / ${integer.format(model.requestCount)} 次请求`;
      const cacheReadLabel = model.cacheReadTokens === null
        ? model.cacheReadReportedRequestCount === null
          ? model.cacheReadReportedTokens === null ? "历史缓存明细不可用" : `${tokenCount(model.cacheReadReportedTokens)} · 覆盖数未知`
          : model.cacheReadReportedRequestCount === 0 ? "Provider 未返回缓存读取计数" : `部分统计 · ${tokenCount(model.cacheReadReportedTokens ?? 0)}`
        : tokenCount(model.cacheReadTokens);
      return <section className="ai-work-chat__usage-model" key={`${model.providerId}/${model.modelId}`}>
        <strong title={`${model.providerId} / ${model.modelId}`}>{model.providerId} / {model.modelId}</strong>
        <div><span>缓存命中</span><b>{percent === null ? model.cacheReadTokens === 0 && model.promptTokens === 0 ? "0% · 0 tokens" : "暂不可计算" : `${percent.toFixed(1)}% · ${tokenCount(model.cacheReadTokens)}`}</b></div>
        <div><span>未缓存输入</span><b>{uncached}</b></div>
        <div><span>缓存读取</span><b>{cacheReadLabel}</b></div>
        <div><span>Provider 统计覆盖</span><b>{cacheCoverage}</b></div>
        <div><span>输入</span><b>{tokenCount(model.promptTokens)}</b></div>
        <div><span>输出</span><b>{tokenCount(model.completionTokens)}</b></div>
      </section>;
    })}
    <small>{summary.requestCountExact ? `累计 ${summary.requestCount.toLocaleString("zh-CN")} 次模型请求` : `累计 ${summary.requestCount.toLocaleString("zh-CN")} 条历史用量记录；旧记录无法还原实际请求数`}；缓存数据只采用 Provider 返回值。</small>
    {input === null || cached === null ? <small>至少一个请求的输入或缓存用量未由 Provider 提供，因此会话累计缓存命中率未知。</small> : null}
  </div>;
}

function ContextDetails({ context }: { context: AiContextUsage | null }) {
  if (!context) return <div className="ai-work-chat__usage-popover"><strong>上下文用量</strong><p>发送下一条消息后，会显示该模型实际请求的上下文。</p></div>;
  const used = context.promptTokens ?? context.estimatedPromptTokens;
  const percent = context.contextWindow ? used / context.contextWindow * 100 : null;
  const ringPercent = percent === null ? 0 : Math.min(100, Math.max(0, percent));
  return <div className="ai-work-chat__usage-popover ai-work-chat__usage-popover--context">
    <strong>上下文已用</strong>
    <div className="ai-work-chat__context-meter">
      <svg viewBox="0 0 40 40" role="img" aria-label={percent === null ? "模型上下文容量未知" : `上下文已用 ${Math.round(percent)}%`}>
        <circle className="ai-work-chat__context-meter-track" cx="20" cy="20" r="16" pathLength="100" />
        <circle className="ai-work-chat__context-meter-value" cx="20" cy="20" r="16" pathLength="100" strokeDasharray={`${ringPercent} ${100 - ringPercent}`} />
        <text x="20" y="21" textAnchor="middle" dominantBaseline="middle">{percent === null ? "?" : percent > 100 ? "100+" : `${Math.round(percent)}%`}</text>
      </svg>
      <div><b>{context.promptTokens === null ? "约 " : ""}{compact.format(used)} / {context.contextWindow === null ? "容量未知" : compact.format(context.contextWindow)}</b><small>{context.providerId} / {context.modelId}</small></div>
    </div>
    <small>{context.contextWindowSource === "model-catalog" ? "容量来自当前模型目录。" : context.contextWindowSource === "settings-fallback" ? "模型目录未提供容量；当前使用设置中心的上下文窗口兜底值。" : "模型目录与设置中心均未提供容量，因此不计算占用比例。"}</small>
    <div className="ai-work-chat__context-breakdown">
      <div><span>系统提示词</span><b>约 {integer.format(context.systemTokens)}</b></div>
      <div><span>工具定义</span><b>约 {integer.format(context.toolsTokens)}</b></div>
      <div><span>对话消息</span><b>约 {integer.format(context.messageTokens)}</b></div>
    </div>
    <small>{context.promptTokens === null ? "总量为本次请求的估算值；分项始终按文本与结构估算。" : "总量来自 Provider 实际回报；分项是按文本与结构估算。"}</small>
    {context.includesImages ? <small>{context.promptTokens === null ? "请求含图片，图片 token 成本因模型而异，尚未计入估算。" : "请求含图片；Provider 实际总量已包含其图片 token 成本，分项估算未拆分图片。"}</small> : null}
  </div>;
}

function ContextDisabledDetails({ onOpenSettings }: { onOpenSettings?: () => void }) {
  return <div className="ai-work-chat__usage-popover">
    <strong>上下文用量已关闭</strong>
    <p>在设置中心「AI 与模型」中开启“显示上下文使用情况”，即可在此查看模型窗口占用和估算分项。Token 与缓存统计仍会正常显示。</p>
    {onOpenSettings ? <Button size="small" type="primary" onClick={onOpenSettings}>打开 AI 与模型设置</Button> : null}
  </div>;
}

export const AiUsageFooter = memo(function AiUsageFooter({ usageSummary, contextUsage, showContextUsage, busy, usageLoadState, hasAssistantMessage, onOpenContextSettings }: {
  usageSummary: AiSessionUsageSummary | null;
  contextUsage: AiContextUsage | null;
  showContextUsage: boolean;
  busy: boolean;
  usageLoadState: AiUsageLoadState;
  hasAssistantMessage: boolean;
  onOpenContextSettings?: () => void;
}) {
  const display = usageSummary ? projectAiSessionUsageDisplay(usageSummary) : null;
  const emptyLabel = busy ? "正在获取 Provider 用量…"
    : usageLoadState === "loading" ? "正在读取会话用量…"
      : usageLoadState === "error" ? "会话用量读取失败"
        : hasAssistantMessage ? "Provider 未返回用量" : "发送消息后显示用量";
  return <div className="ai-work-chat__usage-footer" aria-label="会话模型用量">
    {usageSummary?.models.length ? <Popover trigger="click" placement="top" overlayClassName="ai-work-chat__usage-popover-overlay" content={<CacheDetails summary={usageSummary} />}>
      <button className="ai-work-chat__usage-trigger" type="button" aria-label="查看会话 Token 与缓存用量" title="支持缓存的 Provider 会自动管理缓存；此处只显示其实际返回的缓存读取计数">
        <WorkbenchIcon name="spark" size={13} />
        <span>{compactCount(display?.totalTokens ?? null)} · {display?.cacheLabel ?? "缓存命中未知"}</span>
      </button>
    </Popover> : <span className="ai-work-chat__usage-empty">{emptyLabel}</span>}
    {showContextUsage ? <Popover trigger="click" placement="top" overlayClassName="ai-work-chat__usage-popover-overlay" content={<ContextDetails context={contextUsage} />}>
      <button className="ai-work-chat__usage-trigger ai-work-chat__usage-trigger--context" type="button" aria-label="查看上下文占用与估算分项" title="上下文按本次请求的模型容量和实际用量显示">
        {contextUsage?.contextWindow ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" pathLength="100" /><circle className="ai-work-chat__context-ring-value" cx="12" cy="12" r="9" pathLength="100" strokeDasharray={`${Math.min(100, Math.max(0, (contextUsage.promptTokens ?? contextUsage.estimatedPromptTokens) / contextUsage.contextWindow * 100))} 100`} /></svg> : <WorkbenchIcon name="spark" size={13} />}
        <span>{contextUsage ? `${contextUsage.promptTokens === null ? "约 " : ""}${contextUsage.contextWindow ? `${Math.min(100, Math.round((contextUsage.promptTokens ?? contextUsage.estimatedPromptTokens) / contextUsage.contextWindow * 100))}%` : "上下文"}` : "上下文"}</span>
      </button>
    </Popover> : <Popover trigger="click" placement="top" overlayClassName="ai-work-chat__usage-popover-overlay" content={<ContextDisabledDetails onOpenSettings={onOpenContextSettings} />}>
      <button className="ai-work-chat__usage-trigger ai-work-chat__usage-trigger--context" type="button" aria-label="上下文用量当前已关闭" title="上下文用量当前已关闭；点击查看开启位置">
        <WorkbenchIcon name="spark" size={13} />
        <span>上下文已关闭</span>
      </button>
    </Popover>}
  </div>;
});
