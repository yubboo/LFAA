// 右工作台的本轮变更，展示已保存的工具快照及操作顺序。
import { useState } from "react";
import { IconChevronRight } from "@tabler/icons-react";
import type { ChatMessageItem } from "../chat-types";
import { collectEditedFiles } from "../file-activity";
import { FileTypeIcon } from "./file-icons";
import styles from "./RightWorkbenchActions.module.css";

export function TurnChanges({ message, isZh, onOpenWorkspace }: {
  message: ChatMessageItem | undefined;
  isZh: boolean;
  onOpenWorkspace: () => void;
}) {
  const [selectedPath, setSelectedPath] = useState<string>();
  const files = collectEditedFiles(message?.steps ?? []);
  return (
    <section className={styles.reviewRoot}>
      <div className={styles.reviewHeader}>
        <strong>{isZh ? "本轮变更" : "Turn changes"}</strong>
        <button className={styles.reviewChipBtn} type="button" onClick={onOpenWorkspace}>
          {isZh ? "工作区 Git 变更" : "Workspace Git changes"}
        </button>
      </div>
      <div className={styles.reviewFilesHead}>{isZh ? `变更文件 (${files.length})` : `Changed files (${files.length})`}</div>
      <div className={styles.reviewFilesList}>
        {files.length === 0 && <p className={styles.reviewEmpty}>{isZh ? "本轮没有文件变更。" : "No files changed this turn."}</p>}
        {files.map((file) => {
          const expanded = file.path === selectedPath;
          return (
            <div key={file.path}>
              <div className={styles.reviewFileRow}>
                <button type="button" className={styles.reviewFileBtn} aria-expanded={expanded} title={file.path}
                  onClick={() => setSelectedPath(expanded ? undefined : file.path)}>
                  <IconChevronRight className={styles.reviewChevron} size={14} aria-hidden="true" />
                  <FileTypeIcon name={file.path} kind="file" />
                  <span className={styles.reviewFileName}>{file.path}</span>
                  {file.hasCounts && <><span className={styles.diffPlus}>+{file.added}</span><span className={styles.diffMinus}>−{file.removed}</span></>}
                </button>
              </div>
              {expanded && (
                <div className={styles.reviewDiffPane} role="region" aria-label={file.path}>
                  {file.steps.map((step, index) => (
                    <div key={step.id}>
                      <div className={styles.reviewEmptySmall}>
                        {isZh ? `操作 ${index + 1}` : `Edit ${index + 1}`}
                      </div>
                      {step.fileChange ? (
                        <div className={styles.diffCode}>
                          <div className={styles.diffLine} data-diff-kind="hunk">{`@@ ${step.fileChange.firstLine} @@`}</div>
                          {step.fileChange.before && (
                            <>
                              <div className={styles.reviewEmptySmall}>{isZh ? "修改前片段" : "Before"}</div>
                              <pre className={styles.diffLine}>{step.fileChange.before}</pre>
                            </>
                          )}
                          {step.fileChange.after && (
                            <>
                              <div className={styles.reviewEmptySmall}>{isZh ? "修改后片段" : "After"}</div>
                              <pre className={styles.diffLine}>{step.fileChange.after}</pre>
                            </>
                          )}
                          {step.fileChange.truncated && <p className={styles.reviewEmptySmall}>{isZh ? "快照已截断" : "Snapshot truncated"}</p>}
                        </div>
                      ) : <p className={styles.reviewEmptySmall}>{isZh ? "此操作未保存差异快照" : "No diff snapshot was recorded"}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
