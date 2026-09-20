/**
 * 文件：RuntimeModelPicker.tsx
 * 作用：RuntimeControl 内模型列表子模块。
 * 负责：模型列表展示、选中态、管理模型入口。
 * 不负责：模型切换状态机、reasoning、Popover outside-dismiss。
 */
import { AnimatedDisclosure } from "@lfaa/ui";
import { WorkbenchIcon } from "../runtime-control-dependencies";
import type { QuickModelOption } from "../runtime-control-dependencies";
import type { RuntimeControlController } from "./contracts";
import styles from "./RuntimeControl.module.css";

export function RuntimeModelPicker({ open, quickModels, controller, onManage }: {
  open: boolean;
  quickModels: readonly QuickModelOption[];
  controller: RuntimeControlController;
  onManage: () => void;
}) {
  return (
    <AnimatedDisclosure open={open} className={styles.modelPickerDisclosure}>
      <div className={styles.modelPicker} role="menu" aria-label="选择模型">
        <div className={styles.modelPickerLabel}>选择模型</div>
        <div className={styles.modelPickerList}>
          {quickModels.map((model) => (
            <button
              key={`${model.accountId}:${model.modelId}`}
              className={model.active ? styles.modelPickerActive : undefined}
              type="button"
              role="menuitemradio"
              aria-checked={model.active}
              disabled={model.unavailable || controller.modelControlBusy}
              onClick={() => { void controller.selectModel(model.accountId, model.modelId); }}
            >
              <span>
                <strong>{model.modelName ?? model.modelId}</strong>
                <small>{model.accountName} · {model.providerId}{model.unavailable ? " · 需重测" : ""}</small>
              </span>
              <i aria-hidden="true">{model.active ? "✓" : ""}</i>
            </button>
          ))}
        </div>
        <button className={styles.modelPickerManage} type="button" onClick={onManage}>
          <WorkbenchIcon name="settings" size={14} />
          <span>管理模型</span>
        </button>
      </div>
    </AnimatedDisclosure>
  );
}
