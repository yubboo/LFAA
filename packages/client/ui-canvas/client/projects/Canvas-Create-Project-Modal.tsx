// 无限画布新建项目命名弹窗：先输入项目名称再创建并进入画布，重名时实时提示无空格递增序号（如 短剧1）。
// 关联：packages/client/ui-canvas/client/canvas/Canvas-Workspace.tsx；运行环境：浏览器。
import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@tabler/icons-react";
import { resolveUniqueCanvasProjectName } from "./project-hub-helpers";
import styles from "./Canvas-Create-Project-Modal.module.css";

export function CanvasCreateProjectModal({
  isZh,
  existingNames,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  isZh: boolean;
  existingNames: readonly string[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (resolvedName: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const trimmed = draft.trim();
  const resolvedName = resolveUniqueCanvasProjectName(trimmed, existingNames);
  const renamed = Boolean(trimmed && resolvedName && resolvedName !== trimmed);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resolvedName || busy) return;
    void onConfirm(resolvedName);
  }

  return createPortal(
    <div className={styles.backdrop} onClick={() => { if (!busy) onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isZh ? "新建画布项目" : "New canvas project"}
        className={styles.dialog}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{isZh ? "新建画布项目" : "New canvas project"}</h2>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label={isZh ? "关闭" : "Close"}
            disabled={busy}
            onClick={onClose}
          >
            <IconX size={16} stroke={1.8} />
          </button>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            autoFocus
            type="text"
            maxLength={80}
            className={styles.input}
            value={draft}
            disabled={busy}
            placeholder={isZh ? "输入项目名称，如：短剧" : "Enter project name…"}
            aria-label={isZh ? "项目名称" : "Project name"}
            onChange={(event) => setDraft(event.target.value)}
          />

          {renamed && (
            <p className={styles.hint} role="status">
              {isZh ? `同名项目已存在，将创建为「${resolvedName}」` : `Name exists, will create as "${resolvedName}"`}
            </p>
          )}

          {error && <div role="alert" className={styles.errorBanner}>{error}</div>}

          <footer className={styles.footer}>
            <button type="button" className={styles.cancelBtn} disabled={busy} onClick={onClose}>
              {isZh ? "取消" : "Cancel"}
            </button>
            <button type="submit" className={styles.submitBtn} disabled={!resolvedName || busy}>
              {busy ? (isZh ? "创建中…" : "Creating…") : (isZh ? "创建并进入" : "Create")}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}
