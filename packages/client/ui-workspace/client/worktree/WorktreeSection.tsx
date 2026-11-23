// 项目详情里的工作树区块：列出分支/目录/绑定会话与未提交改动，并提供受保护的删除入口。
import { useCallback, useEffect, useState } from "react";
import { IconCopy, IconGitBranch, IconGitMerge, IconRefresh, IconTrash } from "@tabler/icons-react";
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";
import type { LocalProjectStore } from "../store/local-project-store";
import type { WorkspaceLocaleMessages } from "../locales";
import type { ProjectWorktreeItem, ProjectWorktreeMergePreview } from "./worktree-types";
import styles from "./WorktreeSection.module.css";

export function WorktreeSection({
  locale,
  project,
  store,
}: {
  locale: WorkspaceLocaleMessages;
  project: WorkbenchProjectItem;
  store: LocalProjectStore;
}) {
  const [items, setItems] = useState<ProjectWorktreeItem[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, ProjectWorktreeMergePreview>>({});
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setItems(await store.listWorktrees(project.id));
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : locale.worktreeLoadFailed);
    }
  }, [locale.worktreeLoadFailed, project.id, store]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRemove = async (item: ProjectWorktreeItem) => {
    if (typeof window !== "undefined" && !window.confirm(locale.worktreeRemoveConfirm)) return;
    setBusyId(item.id);
    setError("");
    try {
      await store.removeWorktree(item.id, true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : locale.worktreeDeleteFailed);
    } finally {
      setBusyId(null);
    }
  };

  const handlePrune = async () => {
    setError("");
    try {
      await store.pruneWorktrees();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : locale.worktreeDeleteFailed);
    }
  };

  const handleCopyMerge = async (item: ProjectWorktreeItem) => {
    const target = item.baseRef || "main";
    const command = `git switch ${target}\ngit merge --no-ff ${item.branch}`;
    try {
      await navigator.clipboard.writeText(command);
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId((current) => (current === item.id ? null : current)), 1600);
    } catch {
      setError(locale.worktreeCopyFailed);
    }
  };

  const handlePreviewMerge = async (item: ProjectWorktreeItem) => {
    setPreviewingId(item.id);
    setError("");
    try {
      const preview = await store.previewWorktreeMerge(item.id);
      setPreviews((prev) => ({ ...prev, [item.id]: preview }));
    } catch (err) {
      setError(err instanceof Error ? err.message : locale.worktreePreviewFailed);
    } finally {
      setPreviewingId(null);
    }
  };

  const handleRemoveWithBranch = async (item: ProjectWorktreeItem) => {
    if (typeof window !== "undefined" && !window.confirm(locale.worktreeRemoveWithBranchConfirm)) return;
    setBusyId(item.id);
    setError("");
    try {
      const result = await store.removeWorktreeWithBranch(item.id);
      if (!result.branchDeleted && result.error) setError(result.error);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : locale.worktreeDeleteFailed);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className={styles.section} aria-label={locale.worktreeSectionTitle}>
      <header className={styles.header}>
        <h2 className={styles.title}>
          <IconGitBranch aria-hidden="true" />
          {locale.worktreeSectionTitle}
        </h2>
        <div className={styles.headerActions}>
          {items?.some((item) => !item.exists) && (
            <button type="button" className={styles.refresh} onClick={() => { void handlePrune(); }}>
              {locale.worktreePrune}
            </button>
          )}
          <button type="button" className={styles.refresh} onClick={() => { void load(); }}>
            <IconRefresh aria-hidden="true" />
            {locale.worktreeRefresh}
          </button>
        </div>
      </header>

      {items === null ? (
        <p className={styles.empty}>…</p>
      ) : items.length === 0 ? (
        <p className={styles.empty}>{locale.worktreeSectionEmpty}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => {
            const bound = item.sessionCount > 0;
            return (
              <li key={item.id} className={styles.row} data-worktree-row={item.id}>
                <div className={styles.main}>
                  <span className={styles.branch}>{item.branch}</span>
                  <small className={styles.path} title={item.path}>{item.path}</small>
                  <span className={styles.meta}>
                    {item.baseRef ? `${locale.worktreeBasedOn} ${item.baseRef} · ` : ""}
                    {locale.worktreeBoundSessions}: {item.sessionCount}
                    {` · ${locale.worktreeAhead} ${item.ahead} / ${locale.worktreeBehind} ${item.behind}`}
                    {item.dirtyCount > 0 ? ` · ${item.dirtyCount} ${locale.worktreeDirtyCount}` : ""}
                  </span>
                  {!item.exists && <span className={styles.warning}>{locale.worktreeUnavailable}</span>}
                {!item.exists && <span className={styles.warning}>{locale.worktreeUnavailable}</span>}
                  {previews[item.id] && (
                    <span className={styles.previewResult} data-clean={previews[item.id]?.clean ? "true" : "false"}>
                      {previews[item.id]?.upToDate
                        ? locale.worktreeMergeUpToDate
                        : previews[item.id]?.clean
                          ? locale.worktreeMergeClean
                          : `${locale.worktreeMergeConflicts}: ${previews[item.id]?.conflicts.join(", ") || "?"}`}
                      {previews[item.id]?.mainDirty ? ` · ${locale.worktreeMergeMainDirty}` : ""}
                      {previews[item.id] && !previews[item.id]?.baseBranchCheckedOut ? ` · ${locale.worktreeMergeNotBase}` : ""}
                    </span>
                  )}
                </div>
                {item.exists && item.ahead === 0 && item.sessionCount === 0 && (
                  <button
                    type="button"
                    className={styles.copy}
                    disabled={busyId === item.id}
                    title={locale.worktreeRemoveWithBranch}
                    aria-label={`${locale.worktreeRemoveWithBranch}: ${item.branch}`}
                    onClick={() => { void handleRemoveWithBranch(item); }}
                  >
                    <IconGitBranch aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  className={styles.copy}
                  disabled={previewingId === item.id}
                  title={locale.worktreePreviewMerge}
                  aria-label={`${locale.worktreePreviewMerge}: ${item.branch}`}
                  onClick={() => { void handlePreviewMerge(item); }}
                >
                  <IconGitMerge aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={styles.copy}
                  title={locale.worktreeCopyMerge}
                  aria-label={`${locale.worktreeCopyMerge}: ${item.branch}`}
                  onClick={() => { void handleCopyMerge(item); }}
                >
                  <IconCopy aria-hidden="true" />
                  {copiedId === item.id ? locale.worktreeCopied : null}
                </button>
                <button
                  type="button"
                  className={styles.remove}
                  disabled={bound || busyId === item.id}
                  title={bound ? locale.worktreeBoundSessions : locale.worktreeRemove}
                  aria-label={`${locale.worktreeRemove}: ${item.branch}`}
                  onClick={() => { void handleRemove(item); }}
                >
                  <IconTrash aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}