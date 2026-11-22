// 项目创建对话框的「来源文件夹」区域：已选目录的更换/清除，或选择目录 + 手填路径；远端来源显示未接入说明。
// 从 ProjectDialog 拆出：这里只做来源选择与路径输入，创建流程仍在对话框里。
import { IconFolderPlus } from "@tabler/icons-react";
import type { WorkspaceLocaleMessages } from "../locales";
import styles from "./ProjectDialog.module.css";

export function ProjectSourcePicker({ locale, sourceTab, selectedFolder, manualPath, picking, onPickFolder, onClearFolder, onManualPathChange, onApplyManualPath }: {
  locale: WorkspaceLocaleMessages;
  sourceTab: "local" | "remote";
  selectedFolder: string;
  manualPath: string;
  picking: boolean;
  onPickFolder: () => void;
  onClearFolder: () => void;
  onManualPathChange: (value: string) => void;
  onApplyManualPath: () => void;
}) {
  if (sourceTab !== "local") {
    return (
      <div className={styles.emptySource}>
        <p className={styles.remoteNote}>{locale.remoteUnavailable}</p>
      </div>
    );
  }

  if (selectedFolder) {
    return (
      <div className={styles.selectedWrap}>
        <div className={styles.selectedInfo}>
          <small>{locale.selectedFolderLabel}</small>
          <p className={styles.selectedPath}>{selectedFolder}</p>
        </div>
        <div className={styles.selectedActions}>
          <button type="button" className={styles.secondaryPill} disabled={picking} onClick={onPickFolder}>
            {locale.changeFolderButton}
          </button>
          <button type="button" className={styles.secondaryPill} onClick={onClearFolder}>
            {locale.clearFolderButton}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.emptySource}>
      <p className={styles.emptySourceTitle}>{locale.addFolderOnComputer}</p>
      <button type="button" className={styles.addFolderBtn} disabled={picking} onClick={onPickFolder}>
        <IconFolderPlus />
        <span>{picking ? locale.pickingFolder : locale.addFolderButton}</span>
      </button>
      <div className={styles.manualPathRow}>
        <input
          type="text"
          className={styles.manualPathInput}
          aria-label={locale.manualPathPlaceholder}
          placeholder={locale.manualPathPlaceholder}
          value={manualPath}
          onChange={(event) => onManualPathChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && manualPath.trim()) {
              event.preventDefault();
              onApplyManualPath();
            }
          }}
        />
        <button
          type="button"
          className={styles.secondaryPill}
          disabled={picking || !manualPath.trim()}
          onClick={onApplyManualPath}
        >
          {locale.applyPathButton}
        </button>
      </div>
      <small className={styles.defaultHint}>{locale.defaultFolderHint}</small>
    </div>
  );
}