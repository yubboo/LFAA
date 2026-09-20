/**
 * 文件：ReasoningControlRow.tsx
 * 作用：RuntimeControl 内 reasoning Slider + Effect 的子模块。
 * 负责：把当前模型真实 reasoning stages 映射到共享 DiscreteSlider，并把 boost 状态传给共享 Effect Host。
 * 不负责：档位推导、Provider 保存、Slider Pointer 算法、Canvas 粒子算法。
 */
import { DiscreteSlider, UiEffectHost, builtinUiEffectRegistry } from "@lfaa/ui";
import type { ActiveReasoningControl } from "#composer/contracts";
import type { RuntimeControlController } from "../contracts/runtime-control.types";
import styles from "../styles/RuntimeControl.module.css";

export function ReasoningControlRow({ activeReasoning, controller }: {
  activeReasoning: ActiveReasoningControl | null;
  controller: RuntimeControlController;
}) {
  const {
    reasoningStages,
    visibleReasoningIndex,
    highestReasoningActive,
    boostActive,
    modelControlBusy,
  } = controller;

  if (!reasoningStages.length) {
    return <div className={styles.unsupported}>当前模型没有公开可调的思考强度。</div>;
  }

  return (
    <div className={styles.reasoningSliderShell} data-reasoning-stage={highestReasoningActive ? "extreme" : "standard"}>
      <DiscreteSlider
        ariaLabel={activeReasoning?.field.label ?? "思考强度"}
        steps={reasoningStages.map((stage) => ({ id: stage.id, label: stage.label }))}
        valueIndex={visibleReasoningIndex}
        disabled={modelControlBusy}
        variant={highestReasoningActive ? "extreme" : "standard"}
        onPreview={controller.setReasoningPreviewIndex}
        onCommit={controller.commitReasoningIndex}
        effect={(
          <UiEffectHost
            registry={builtinUiEffectRegistry}
            effectId="reasoning-overdrive"
            active={boostActive}
            variant={highestReasoningActive ? "extreme" : "standard"}
          />
        )}
      />
    </div>
  );
}
