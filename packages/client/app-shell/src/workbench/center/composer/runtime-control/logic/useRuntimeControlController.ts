/**
 * 文件：useRuntimeControlController.ts
 * 作用：RuntimeControl 唯一局部状态 Owner。
 * 负责：reasoning 预览/已选档位、强力推理偏好、模型切换 busy、reasoning 串行提交队列。
 * 不负责：DOM、CSS、Composer 草稿、Provider Capability 真值、共享 Slider/Effect 算法。
 * 修改注意事项：reasoning 设置保存不得复用 modelControlBusy，从而避免 PointerUp 后 Slider disabled/opacity 闪烁。
 */
import { useEffect, useRef, useState } from "react";
import type { AiModelSettingValue } from "@lfaa/config-system";
import { resolveReasoningStageIndex, resolveReasoningStages } from "#composer/contracts";
import type { ActiveReasoningControl } from "#composer/contracts";
import type { RuntimeControlController } from "../contracts/runtime-control.types";

export function useRuntimeControlController({ activeReasoning, onQuickSelectModel, onQuickUpdateModelSetting, onNotice }: {
  activeReasoning: ActiveReasoningControl | null;
  onQuickSelectModel: (accountId: string, modelId: string) => Promise<void>;
  onQuickUpdateModelSetting: (fieldId: string, value: AiModelSettingValue) => Promise<void>;
  onNotice: (message: string | null) => void;
}): RuntimeControlController {
  const [runtimeModelPickerOpen, setRuntimeModelPickerOpen] = useState(false);
  const [reasoningPreviewIndex, setReasoningPreviewIndex] = useState<number | null>(null);
  const [selectedReasoningStageIndex, setSelectedReasoningStageIndex] = useState(() => {
    const options = activeReasoning?.field.kind === "select" ? activeReasoning.field.options ?? [] : [];
    return resolveReasoningStageIndex(options, activeReasoning?.value);
  });
  const [reasoningBoostPreference, setReasoningBoostPreference] = useState<"auto" | "on" | "off">("auto");
  const [modelControlBusy, setModelControlBusy] = useState(false);
  const reasoningCommitQueueRef = useRef<Promise<void>>(Promise.resolve());
  const reasoningCommitRevisionRef = useRef(0);

  useEffect(() => {
    const options = activeReasoning?.field.kind === "select" ? activeReasoning.field.options ?? [] : [];
    setSelectedReasoningStageIndex(resolveReasoningStageIndex(options, activeReasoning?.value));
    setReasoningBoostPreference("auto");
    setReasoningPreviewIndex(null);
    setRuntimeModelPickerOpen(false);
  }, [activeReasoning?.modelKey]);

  useEffect(() => {
    const options = activeReasoning?.field.kind === "select" ? activeReasoning.field.options ?? [] : [];
    const stages = resolveReasoningStages(options);
    if (!stages.length) {
      setSelectedReasoningStageIndex(0);
      return;
    }
    setSelectedReasoningStageIndex(resolveReasoningStageIndex(options, activeReasoning?.value));
  }, [activeReasoning?.value, activeReasoning?.field.options]);

  const providerReasoningOptions = activeReasoning?.field.kind === "select" ? activeReasoning.field.options ?? [] : [];
  const reasoningStages = resolveReasoningStages(providerReasoningOptions);
  const defaultReasoningStageIndex = resolveReasoningStageIndex(providerReasoningOptions, activeReasoning?.field.defaultValue);
  const lastReasoningIndex = Math.max(0, reasoningStages.length - 1);
  const committedReasoningIndex = Math.max(0, Math.min(lastReasoningIndex, selectedReasoningStageIndex));
  const visibleReasoningIndex = Math.max(0, Math.min(lastReasoningIndex, reasoningPreviewIndex ?? committedReasoningIndex));
  const visibleReasoningStage = reasoningStages[visibleReasoningIndex];
  const highestReasoningActive = reasoningStages.length > 0 && visibleReasoningIndex === lastReasoningIndex;
  const boostActive = reasoningStages.length > 0 && (reasoningBoostPreference === "on" || (reasoningBoostPreference === "auto" && highestReasoningActive));

  const commitReasoningIndex = (index: number) => {
    if (!activeReasoning || !reasoningStages.length || modelControlBusy) return;
    const safeIndex = Math.max(0, Math.min(reasoningStages.length - 1, index));
    const binding = reasoningStages[safeIndex];
    if (!binding) return;
    setSelectedReasoningStageIndex(safeIndex);
    setReasoningPreviewIndex(null);
    onNotice(null);
    const revision = ++reasoningCommitRevisionRef.current;
    const fieldId = activeReasoning.field.id;
    const providerValue = binding.providerOption.value;
    const fallbackIndex = resolveReasoningStageIndex(providerReasoningOptions, activeReasoning.value);
    const write = reasoningCommitQueueRef.current.catch(() => undefined).then(() => onQuickUpdateModelSetting(fieldId, providerValue));
    reasoningCommitQueueRef.current = write.catch((error) => {
      if (reasoningCommitRevisionRef.current === revision) setSelectedReasoningStageIndex(fallbackIndex);
      onNotice(error instanceof Error ? error.message : "思考强度保存失败。");
    });
  };

  const toggleReasoningBoost = () => {
    if (!activeReasoning || !reasoningStages.length || modelControlBusy) return;
    setReasoningBoostPreference(boostActive ? "off" : "on");
  };

  const resetReasoning = () => {
    setReasoningBoostPreference("auto");
    commitReasoningIndex(defaultReasoningStageIndex);
  };

  const selectModel = async (accountId: string, modelId: string) => {
    if (modelControlBusy) return;
    setModelControlBusy(true);
    onNotice(null);
    try {
      await reasoningCommitQueueRef.current.catch(() => undefined);
      await onQuickSelectModel(accountId, modelId);
      setRuntimeModelPickerOpen(false);
      setReasoningPreviewIndex(null);
      setReasoningBoostPreference("auto");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "模型切换失败。");
    } finally {
      setModelControlBusy(false);
    }
  };

  const reasoningBinding = reasoningStages[committedReasoningIndex];
  const modelSettingOverrides = activeReasoning && reasoningBinding
    ? { [activeReasoning.field.id]: reasoningBinding.providerOption.value }
    : undefined;

  return {
    reasoningStages,
    visibleReasoningIndex,
    visibleReasoningStage,
    highestReasoningActive,
    boostActive,
    modelControlBusy,
    runtimeModelPickerOpen,
    executionContext: {
      executionHints: { reasoningBoost: boostActive },
      ...(modelSettingOverrides ? { modelSettingOverrides } : {}),
    },
    setReasoningPreviewIndex,
    commitReasoningIndex,
    toggleReasoningBoost,
    resetReasoning,
    toggleModelPicker: () => setRuntimeModelPickerOpen((value) => !value),
    closeModelPicker: () => setRuntimeModelPickerOpen(false),
    selectModel,
  };
}
