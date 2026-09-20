/**
 * 文件：RuntimeControl.tsx
 * 作用：Composer 内“模型 / reasoning / 强力推理”独立子模块 View。
 * 负责：Runtime Control 触发器、单 Popover 组合、ARIA、子模块装配。
 * 不负责：局部状态机（见 useRuntimeControlController）、模型列表内部、Reasoning Slider 实现、Composer 草稿、兄弟区域。
 * 状态归属：只消费 RuntimeControlController；不自行复制 controller state。
 * 修改注意事项：样式只允许进入同目录 RuntimeControl.module.css；禁止向 agent-workbench.css 添加 runtime 专属选择器。
 */
import { useDismissibleLayer } from "@lfaa/ui";
import { WorkbenchIcon } from "#composer/contracts";
import { RuntimeModelPicker } from "./RuntimeModelPicker";
import { ReasoningControlRow } from "./ReasoningControlRow";
import type { RuntimeControlProps } from "../contracts/runtime-control.types";
import styles from "../styles/RuntimeControl.module.css";

export function RuntimeControl({ open, layoutMode, onOpenChange, modelLabel, quickModels, activeReasoning, controller, onOpenAiSettings }: RuntimeControlProps) {
  const runtimeControlRef = useDismissibleLayer<HTMLDivElement>({
    open,
    onDismiss: () => {
      onOpenChange(false);
      controller.closeModelPicker();
      controller.setReasoningPreviewIndex(null);
    },
  });
  const {
    reasoningStages,
    visibleReasoningStage,
    boostActive,
    modelControlBusy,
    runtimeModelPickerOpen,
  } = controller;

  return (
    <div className={styles.anchor} data-layout-mode={layoutMode} ref={runtimeControlRef}>
      <button
        className={`${styles.trigger}${boostActive ? ` ${styles.triggerBoosted}` : ""}`}
        type="button"
        aria-label={quickModels.length === 0 ? "配置模型" : "模型与思考强度"}
        aria-expanded={open}
        title={quickModels.length === 0 ? "首次配置模型" : "模型与思考强度 · Ctrl+Shift+M"}
        onClick={() => {
          if (quickModels.length === 0) {
            onOpenAiSettings();
            return;
          }
          onOpenChange(!open);
          controller.closeModelPicker();
          controller.setReasoningPreviewIndex(null);
        }}
      >
        {boostActive ? <WorkbenchIcon name="bolt" size={13} /> : null}
        <span className={styles.triggerModel}>{modelLabel === "未配置模型" ? "选择模型" : modelLabel.split(" · ")[0]}</span>
        {reasoningStages.length ? <span className={styles.triggerEffort}>{visibleReasoningStage?.label ?? "默认"}</span> : null}
        <WorkbenchIcon name="chevron" size={12} />
        {quickModels.length > 0 ? <span className={styles.triggerTooltip}>模型与思考强度 <kbd>Ctrl+Shift+M</kbd></span> : null}
      </button>

      {open ? (
        <section className={`${styles.card}${boostActive ? ` ${styles.cardBoosted}` : ""}`} role="dialog" aria-label="模型与思考强度">
          <div className={styles.toolbar}>
            <button
              className={`${styles.iconButton}${boostActive ? ` ${styles.iconButtonActive}` : ""}`}
              type="button"
              aria-pressed={boostActive}
              aria-label="强力推理"
              data-tooltip="强力推理 · 用量可能更高"
              disabled={!reasoningStages.length || modelControlBusy}
              onClick={controller.toggleReasoningBoost}
            >
              <WorkbenchIcon name="bolt" size={17} />
            </button>
            <button
              className={`${styles.modelButton}${runtimeModelPickerOpen ? ` ${styles.modelButtonOpen}` : ""}`}
              type="button"
              aria-expanded={runtimeModelPickerOpen}
              aria-label="切换模型"
              onClick={controller.toggleModelPicker}
            >
              <strong>{reasoningStages.length ? (visibleReasoningStage?.label ?? "默认") : "模型"}<WorkbenchIcon name="chevron" size={12} /></strong>
              <small>{modelLabel === "未配置模型" ? "选择模型" : modelLabel.split(" · ")[0]}</small>
            </button>
            <button
              className={styles.iconButton}
              type="button"
              aria-label="重置思考强度"
              data-tooltip="重置为默认"
              disabled={!reasoningStages.length || modelControlBusy}
              onClick={controller.resetReasoning}
            >
              <WorkbenchIcon name="refresh" size={17} />
            </button>
          </div>

          <RuntimeModelPicker
            open={runtimeModelPickerOpen}
            quickModels={quickModels}
            controller={controller}
            onManage={() => {
              onOpenChange(false);
              controller.closeModelPicker();
              onOpenAiSettings();
            }}
          />

          <ReasoningControlRow activeReasoning={activeReasoning} controller={controller} />
        </section>
      ) : null}
    </div>
  );
}
