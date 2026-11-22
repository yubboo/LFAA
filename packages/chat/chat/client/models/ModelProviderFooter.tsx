// 模型配置弹窗底部操作栏：左侧返回与删除，右侧测试连接、保存与保存并启用，窄屏下可分行。
import { IconArrowLeft } from "@tabler/icons-react";
import styles from "./ModelProviderGrid.module.css";

/** 弹窗底部操作栏；所有动作由弹窗容器实现，这里只负责布局与禁用态。 */
export function ModelProviderFooter({
  isZh,
  busy,
  canDelete,
  profileId,
  onBack,
  onDelete,
  onTest,
  onSave,
  onSaveAndUse,
}: {
  isZh: boolean;
  busy: boolean;
  canDelete: boolean;
  profileId?: string | undefined;
  onBack?: (() => void) | undefined;
  onDelete: () => void;
  onTest: () => void;
  onSave: () => void;
  onSaveAndUse: () => void;
}) {
  return (
    <div className={styles.footerGroup}>
      {/* 返回和删除放在左侧，测试、保存和启用在右侧，窄屏下可分行。 */}
      <div className={styles.footerLeft}>
        {onBack && (
          <button type="button" className={`${styles.btn} ${styles.backBtn}`} disabled={busy} onClick={onBack}>
            <IconArrowLeft size={14} aria-hidden="true" />
            {isZh ? "返回" : "Back"}
          </button>
        )}
        {profileId && canDelete && (
          <button type="button" className={styles.dangerBtn} disabled={busy} onClick={onDelete}>
            {isZh ? "删除配置" : "Delete"}
          </button>
        )}
      </div>
      <div className={styles.footerRight}>
        <button type="button" className={styles.btn} disabled={busy} onClick={onTest}>
          {isZh ? "测试连接" : "Test"}
        </button>
        <button type="button" className={styles.btn} disabled={busy} onClick={onSave}>
          {isZh ? "保存" : "Save"}
        </button>
        <button type="button" className={styles.primaryBtn} disabled={busy} onClick={onSaveAndUse}>
          {isZh ? "保存并设为当前模型" : "Save & Use"}
        </button>
      </div>
    </div>
  );
}
