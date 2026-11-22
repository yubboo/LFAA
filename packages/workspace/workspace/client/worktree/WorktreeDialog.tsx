// 新建工作树会话弹窗：填写分支与可选起点，创建同级工作树后直接打开绑定的新会话。
import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { IconGitBranch, IconX } from "@tabler/icons-react";
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import type { LocalProjectStore } from "../store/local-project-store";
import type { WorkspaceLocaleMessages } from "../locales";
import type { ProjectWorktreeItem } from "./worktree-types";
import styles from "./WorktreeDialog.module.css";

/** 生成默认分支名：日期 + 4 位随机，避免同一天多次创建冲突。 */
function defaultBranch(): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const suffix = Math.random().toString(36).slice(2, 6);
  return `lfaa/${stamp}-${suffix}`;
}

export function WorktreeDialog({
  locale,
  project,
  store,
  onClose,
  onCreated,
}: {
  locale: WorkspaceLocaleMessages;
  project: WorkbenchProjectItem;
  store: LocalProjectStore;
  onClose: () => void;
  onCreated: (worktree: ProjectWorktreeItem) => void;
}) {
  const [branch, setBranch] = useState(defaultBranch);
  const [from, setFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [repoInfo, setRepoInfo] = useState<{ branch: string; dirtyCount: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void store.getWorktreeRepository(project.id).then(
      (info) => { if (!cancelled) setRepoInfo({ branch: info.branch, dirtyCount: info.dirtyCount }); },
      () => { if (!cancelled) setRepoInfo(null); },
    );
    return () => { cancelled = true; };
  }, [project.id, store]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedBranch = branch.trim();
    if (!trimmedBranch) {
      setError(locale.worktreeBranchLabel);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await store.createWorktree(project.id, trimmedBranch, from);
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : locale.worktreeCreateFailed);
    } finally {
      setBusy(false);
    }
  };

  const node = (
    <div
      className={styles.backdrop}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lfaa-worktree-title"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onClose();
        }}
      >
        <header className={styles.header}>
          <h2 id="lfaa-worktree-title">{locale.worktreeDialogTitle}</h2>
          <button className={styles.close} type="button" aria-label={locale.close} disabled={busy} onClick={onClose}>
            <IconX />
          </button>
        </header>

        <p className={styles.project}>{project.name}</p>
        {repoInfo && (
          <p className={styles.baseInfo}>
            {locale.worktreeBasedOn} <code>{repoInfo.branch}</code>
          </p>
        )}
        {repoInfo && repoInfo.dirtyCount > 0 && (
          <p className={styles.dirtyWarning} role="status">
            {locale.worktreeDirtyWarning.replace("{count}", String(repoInfo.dirtyCount))}
          </p>
        )}

        <form onSubmit={(event) => { void handleSubmit(event); }}>
          <label className={styles.field}>
            <span className={styles.label}>{locale.worktreeBranchLabel}</span>
            <input
              autoFocus
              maxLength={120}
              value={branch}
              placeholder="lfaa/20261122-abcd"
              aria-label={locale.worktreeBranchLabel}
              disabled={busy}
              onChange={(event) => {
                setBranch(event.currentTarget.value);
                setError("");
              }}
            />
          </label>
          <small className={styles.hint}>{locale.worktreeBranchHint}</small>
          <small className={styles.hint}>{locale.worktreeBranchOnlyHint}</small>

          <label className={styles.field}>
            <span className={styles.label}>{locale.worktreeFromLabel}</span>
            <input
              value={from}
              placeholder={locale.worktreeFromPlaceholder}
              aria-label={locale.worktreeFromLabel}
              disabled={busy}
              onChange={(event) => setFrom(event.currentTarget.value)}
            />
          </label>

          <div className={styles.preview}>
            <IconGitBranch aria-hidden="true" />
            <div>
              <p>{locale.worktreeTargetHint}</p>
              <small>{locale.worktreeEnvHint}</small>
            </div>
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <footer className={styles.actions}>
            <button className={styles.cancel} type="button" disabled={busy} onClick={onClose}>
              {locale.cancel}
            </button>
            <button className={styles.submit} type="submit" disabled={busy || !branch.trim()}>
              {busy ? locale.creatingWorktree : locale.worktreeCreate}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );

  if (typeof document === "undefined") return node;
  return createPortal(node, document.querySelector("[data-device]") ?? document.body);
}