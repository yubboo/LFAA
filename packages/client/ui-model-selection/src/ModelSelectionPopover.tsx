/**
 * 文件：ModelSelectionPopover.tsx
 * 功能：呈现模型目录、模型切换和 Provider 已声明的推理参数。
 * 作用：只消费聊天层传入的数据与回调；模型能力映射复用 ui-settings-models。
 * 不负责：目录请求、账户隔离、授权、设置写入或持久化。
 * 关联文件：packages/client/ui-chat/src/AiWorkChat.tsx、model-selection.css。
 */
import { Input } from "antd";
import type { KeyboardEvent } from "react";
import type { AiAccount } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import {
  fixedThinkingLabel,
  modelCatalogCapabilitySummary,
  modelSelectorDisplayLabel,
  type AiModelPickerEntry
} from "lfaa-client-ui-settings-models/src/model-options.js";
import "./model-selection.css";

export interface ModelSelectionPopoverProps {
  view: "reasoning" | "models";
  accountLoadState: "loading" | "ready" | "error";
  modelBusy: boolean;
  busy: boolean;
  activeAccount: AiAccount | undefined;
  activeModel: AiModelPickerEntry["model"] | undefined;
  visibleReasoningLabel: string;
  activeReasoningLevels: Array<{ value: string; label: string }>;
  activeReasoningMode: string;
  hasEffortSlider: boolean;
  hasResolvedReasoningIndex: boolean;
  displayedReasoningIndex: number;
  reasoningProgress: number;
  modelPickerCatalog: AiModelPickerEntry[];
  modelPickerAccountCount: number;
  modelPickerPageSize: number;
  modelSearch: string;
  matchingModels: AiModelPickerEntry[];
  visibleModels: AiModelPickerEntry[];
  onClose: () => void;
  onViewChange: (view: "reasoning" | "models") => void;
  onModelSearchChange: (value: string) => void;
  onReasoningDraftIndexChange: (index: number) => void;
  onSelectReasoning: (value: string) => void;
  onSelectModel: (accountId: string, modelId: string) => void;
  onLoadMore: () => void;
  onManageModels: () => void;
}

export function ModelSelectionPopover({
  view,
  accountLoadState,
  modelBusy,
  busy,
  activeAccount,
  activeModel,
  visibleReasoningLabel,
  activeReasoningLevels,
  activeReasoningMode,
  hasEffortSlider,
  hasResolvedReasoningIndex,
  displayedReasoningIndex,
  reasoningProgress,
  modelPickerCatalog,
  modelPickerAccountCount,
  modelPickerPageSize,
  modelSearch,
  matchingModels,
  visibleModels,
  onClose,
  onViewChange,
  onModelSearchChange,
  onReasoningDraftIndexChange,
  onSelectReasoning,
  onSelectModel,
  onLoadMore,
  onManageModels
}: ModelSelectionPopoverProps) {
  const hasCurrentModelInList = visibleModels.some(({ account, model }) => account.id === activeAccount?.id && model.id === activeAccount.modelId);

  return (
    <div
      className="ai-work-chat__model-card"
      data-view={view}
      role="dialog"
      aria-label={view === "models" ? "选择模型" : "模型推理设置"}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape") onClose();
      }}
    >
      {view === "reasoning" ? <>
        <header className="ai-work-chat__model-card-header">
          <WorkbenchIcon name="bolt" size={18} />
          <button
            className="ai-work-chat__model-card-current"
            type="button"
            aria-label={`当前推理强度：${visibleReasoningLabel}。当前模型：${activeModel?.name ?? activeAccount?.modelId ?? "未配置"}。点击切换模型`}
            onClick={() => onViewChange("models")}
          >
            <strong>{modelBusy ? "保存中…" : visibleReasoningLabel}</strong>
            <span>{activeModel?.name ?? activeAccount?.modelId ?? (accountLoadState === "loading" ? "正在读取模型…" : "未配置模型")}<WorkbenchIcon name="chevron" size={14} /></span>
          </button>
          <button
            className="ai-work-chat__model-card-reset-icon"
            type="button"
            aria-label="恢复 Provider 默认思考力度"
            title="恢复 Provider 默认"
            disabled={modelBusy || busy || activeAccount?.reasoningMode === "default" || !activeReasoningLevels.length}
            onClick={() => onSelectReasoning("default")}
          >
            <WorkbenchIcon name="refresh" size={17} />
          </button>
        </header>

        <div className="ai-work-chat__model-card-control" aria-label="模型推理控制">
          {hasEffortSlider ? <div className="ai-work-chat__model-card-range">
            <input
              className={`ai-work-chat__model-range${hasResolvedReasoningIndex ? "" : " is-provider-default"}`}
              type="range"
              min={0}
              max={activeReasoningLevels.length - 1}
              step={1}
              value={displayedReasoningIndex}
              style={{ background: hasResolvedReasoningIndex ? `linear-gradient(90deg, var(--settings-accent, var(--color-brand)) ${reasoningProgress}%, var(--color-border) ${reasoningProgress}%)` : "var(--color-border)" }}
              aria-label="模型思考力度"
              aria-valuetext={visibleReasoningLabel}
              disabled={modelBusy || busy}
              onChange={(event) => onReasoningDraftIndexChange(Number(event.currentTarget.value))}
              onPointerUp={(event) => {
                const option = activeReasoningLevels[Number(event.currentTarget.value)];
                if (option) onSelectReasoning(option.value);
              }}
              onKeyUp={(event) => {
                if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) return;
                const option = activeReasoningLevels[Number(event.currentTarget.value)];
                if (option) onSelectReasoning(option.value);
              }}
            />
            <span className="ai-work-chat__model-card-markers" aria-hidden="true">
              {activeReasoningLevels.map((option, index) => index === displayedReasoningIndex ? null : <span key={option.value} />)}
            </span>
          </div> : activeReasoningLevels.length ? <div className="ai-work-chat__model-card-single-level" aria-label="模型支持的推理选项">
            {activeReasoningLevels.map((option) => <button
              key={option.value}
              type="button"
              aria-pressed={activeReasoningMode === option.value}
              disabled={modelBusy || busy}
              onClick={() => onSelectReasoning(option.value)}
            >{option.label}</button>)}
          </div> : activeModel?.thinking?.kind === "fixed"
            ? <p className="ai-work-chat__model-card-note">{fixedThinkingLabel(activeModel)}</p>
            : <p className="ai-work-chat__model-card-note">该模型没有提供可验证的推理强度选项。</p>}
        </div>
      </> : <>
        <header className="ai-work-chat__model-card-list-header">
          <button type="button" aria-label="返回推理设置" title="返回推理设置" onClick={() => onViewChange("reasoning")}><WorkbenchIcon name="chevron" size={15} /></button>
          <span><strong>选择模型</strong><small>{modelPickerAccountCount} 个配置账户 · {modelSearch.trim() ? `${matchingModels.length} 个匹配模型` : `${modelPickerCatalog.length} 个目录模型`}</small></span>
        </header>
        <Input
          size="small"
          allowClear
          value={modelSearch}
          aria-label="搜索模型名称或 ID"
          placeholder="搜索模型名称或 ID"
          onChange={(event) => onModelSearchChange(event.target.value)}
        />
        <div className="ai-work-chat__model-card-models" role="listbox" aria-label="模型目录">
          {visibleModels.map(({ account, model }, index) => {
            const selected = account.id === activeAccount?.id && model.id === activeAccount?.modelId;
            return <button
              key={`${account.id}:${model.id}`}
              type="button"
              className={selected ? "is-selected" : ""}
              role="option"
              aria-selected={selected}
              tabIndex={selected || (!hasCurrentModelInList && index === 0) ? 0 : -1}
              title={`${account.displayName} · ${account.providerId} · ${modelSelectorDisplayLabel(model)} · ${model.id} · ${modelCatalogCapabilitySummary(model)}`}
              disabled={modelBusy || busy}
              onClick={() => selected ? onClose() : onSelectModel(account.id, model.id)}
              onKeyDown={(event) => {
                if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const options = Array.from(event.currentTarget.closest<HTMLElement>("[role='listbox']")?.querySelectorAll<HTMLButtonElement>("[role='option']") ?? []);
                const currentIndex = options.indexOf(event.currentTarget);
                const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
                options[nextIndex]?.focus();
              }}
            ><span><small className="ai-work-chat__model-card-model-account">{account.displayName} · {account.providerId}</small><strong className="ai-work-chat__model-card-model-name">{model.name}</strong><small className="ai-work-chat__model-card-model-id">{model.id}</small></span>{selected ? <WorkbenchIcon name="check" size={15} /> : null}</button>;
          })}
          {!visibleModels.length ? <span className="ai-work-chat__model-card-empty">{modelSearch.trim() ? "没有匹配的模型" : "设置中心尚未返回可用的对话模型目录"}</span> : null}
        </div>
        {matchingModels.length > visibleModels.length ? <button type="button" className="ai-work-chat__model-card-load-more" onClick={onLoadMore}>继续加载 {Math.min(modelPickerPageSize, matchingModels.length - visibleModels.length)} 个模型 · 还剩 {matchingModels.length - visibleModels.length} 个</button> : null}
        <footer className="ai-work-chat__model-card-list-footer"><button type="button" onClick={onManageModels}><WorkbenchIcon name="settings" size={15} /> 模型管理</button></footer>
      </>}
    </div>
  );
}
