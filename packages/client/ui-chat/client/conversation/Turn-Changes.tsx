// 右工作台的本轮变更，展示已保存的工具快照及操作顺序。
import { useState } from "react";
import { IconChevronRight } from "@tabler/icons-react";
import type { ChatMessageItem } from "../store/chat-types";
import { collectEditedFiles } from "../shared/file-activity";
import { FileTypeIcon } from "@lfaa/ui-icons/client";
import styles from "../workbench/RightWorkbenchActions.module.css";
import reviewStyles from "../workbench/RightGitReviewPane.module.css";

export function TurnChanges({ sessionId, message, isZh, onOpenWorkspace }: {
  sessionId?: string;
  message: ChatMessageItem | undefined;
  isZh: boolean;
  onOpenWorkspace: () => void;
}) {
  const [selectedPath, setSelectedPath] = useState<string>();
  const [undoBusy, setUndoBusy] = useState(false);
  const [undoNotice, setUndoNotice] = useState("");
  const files = collectEditedFiles(message?.steps ?? []);

  const handleUndoTurn = async () => {
    if (!sessionId || !message?.id || undoBusy) return;
    if (typeof window !== "undefined" && !window.confirm(isZh ? "确认撤销本轮 Agent 修改和新建的文件？" : "Undo all file edits and creations from this turn?")) {
      return;
    }
    setUndoBusy(true);
    setUndoNotice("");
    try {
      const res = await fetch(`/api/agent/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(message.id)}/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await res.json().catch(() => ({}))) as { restored?: string[]; removed?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error || `撤销失败 (${res.status})`);
      const count = (data.restored?.length ?? 0) + (data.removed?.length ?? 0);
      setUndoNotice(isZh ? `已撤销本轮 ${count} 个文件的改动。` : `Undid changes across ${count} files.`);
    } catch (err) {
      setUndoNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setUndoBusy(false);
    }
  };

  return (
    <section className={reviewStyles.reviewRoot}>
      <div className={reviewStyles.reviewHeader}>
        <strong>{isZh ? "本轮变更" : "Turn changes"}</strong>
        <div className={reviewStyles.reviewActions}>
          {sessionId && message?.id && files.length > 0 && (
            <button className={reviewStyles.reviewChipBtn} type="button" disabled={undoBusy} onClick={() => void handleUndoTurn()}>
              {undoBusy ? (isZh ? "撤销中…" : "Undoing...") : (isZh ? "撤销本轮改动" : "Undo turn")}
            </button>
          )}
          <button className={reviewStyles.reviewChipBtn} type="button" onClick={onOpenWorkspace}>
            {isZh ? "工作区 Git 变更" : "Workspace Git changes"}
          </button>
        </div>
      </div>
      {undoNotice && <p className={reviewStyles.reviewEmptySmall} role="status">{undoNotice}</p>}
      <div className={reviewStyles.reviewFilesHead}>{isZh ? `变更文件 (${files.length})` : `Changed files (${files.length})`}</div>
      <div className={reviewStyles.reviewFilesList}>
        {files.length === 0 && <p className={reviewStyles.reviewEmpty}>{isZh ? "本轮没有文件变更。" : "No files changed this turn."}</p>}
        {files.map((file) => {
          const expanded = file.path === selectedPath;
          return (
            <div key={file.path}>
              <div className={reviewStyles.reviewFileRow}>
                <button type="button" className={reviewStyles.reviewFileBtn} aria-expanded={expanded} title={file.path}
                  onClick={() => setSelectedPath(expanded ? undefined : file.path)}>
                  <IconChevronRight className={reviewStyles.reviewChevron} size={14} aria-hidden="true" />
                  <FileTypeIcon name={file.path} kind="file" />
                  <span className={reviewStyles.reviewFileName}>{file.path}</span>
                  {file.hasCounts && <><span className={styles.diffPlus}>+{file.added}</span><span className={styles.diffMinus}>−{file.removed}</span></>}
                </button>
              </div>
              {expanded && (
                <div className={reviewStyles.reviewDiffPane} role="region" aria-label={file.path}>
                  {file.steps.map((step, index) => (
                    <div key={step.id}>
                      <div className={reviewStyles.reviewEmptySmall}>
                        {isZh ? `操作 ${index + 1}` : `Edit ${index + 1}`}
                      </div>
                      {step.fileChange ? (
                        <div className={reviewStyles.diffCode}>
                          <div className={reviewStyles.diffLine} data-diff-kind="hunk">{`@@ ${step.fileChange.firstLine} @@`}</div>
                          {step.fileChange.before && (
                            <>
                              <div className={reviewStyles.reviewEmptySmall}>{isZh ? "修改前片段" : "Before"}</div>
                              <pre className={reviewStyles.diffLine}>{step.fileChange.before}</pre>
                            </>
                          )}
                          {step.fileChange.after && (
                            <>
                              <div className={reviewStyles.reviewEmptySmall}>{isZh ? "修改后片段" : "After"}</div>
                              <pre className={reviewStyles.diffLine}>{step.fileChange.after}</pre>
                            </>
                          )}
                          {step.fileChange.truncated && <p className={reviewStyles.reviewEmptySmall}>{isZh ? "快照已截断" : "Snapshot truncated"}</p>}
                        </div>
                      ) : <p className={reviewStyles.reviewEmptySmall}>{isZh ? "此操作未保存差异快照" : "No diff snapshot was recorded"}</p>}
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
