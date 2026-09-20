/**
 * 文件：runtime-control/contracts.ts
 * 作用：RuntimeControl 子模块内部公共契约。
 * 负责：Controller / View 之间的类型边界。
 * 不负责：Provider Capability 真值、Composer 草稿、兄弟区域状态。
 */
import type { AgentExecutionHints } from "@lfaa/agent-runtime";
import type { AiModelSettingValue } from "@lfaa/config-system";
import type { ReasoningStageBinding } from "../runtime-control-dependencies";
import type { ActiveReasoningControl, LayoutMode, QuickModelOption } from "../runtime-control-dependencies";

export interface RuntimeControlExecutionContext {
  executionHints: AgentExecutionHints;
  modelSettingOverrides?: Readonly<Record<string, AiModelSettingValue>>;
}

export interface RuntimeControlController {
  readonly reasoningStages: readonly ReasoningStageBinding[];
  readonly visibleReasoningIndex: number;
  readonly visibleReasoningStage: ReasoningStageBinding | undefined;
  readonly highestReasoningActive: boolean;
  readonly boostActive: boolean;
  readonly modelControlBusy: boolean;
  readonly runtimeModelPickerOpen: boolean;
  readonly executionContext: RuntimeControlExecutionContext;
  setReasoningPreviewIndex(index: number | null): void;
  commitReasoningIndex(index: number): void;
  toggleReasoningBoost(): void;
  resetReasoning(): void;
  toggleModelPicker(): void;
  closeModelPicker(): void;
  selectModel(accountId: string, modelId: string): Promise<void>;
}

export interface RuntimeControlProps {
  open: boolean;
  layoutMode: LayoutMode;
  onOpenChange: (open: boolean) => void;
  modelLabel: string;
  quickModels: readonly QuickModelOption[];
  activeReasoning: ActiveReasoningControl | null;
  controller: RuntimeControlController;
  onOpenAiSettings: () => void;
}
