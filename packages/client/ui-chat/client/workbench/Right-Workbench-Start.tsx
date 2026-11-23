// 右工作台启动页，复用项目文件、浏览器和辅助面板入口，适用于空白浏览器标签。
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { IconArrowRight, IconFileDiff, IconFolder, IconMessageCircle, IconSearch, IconTerminal2 } from "@tabler/icons-react";
import type { ChatClientStore } from "../store/chat-store";
import { rightWorkbenchStartLabels } from "../locales";
import styles from "./Right-Workbench-Start.module.css";

export function RightWorkbenchStart({
  isZh, store, projectId, worktreeId, projectName, onOpenUrl, onOpenTerminal, onOpenReview, onOpenFiles, onOpenSideAsk, children,
}: {
  isZh: boolean;
  store: ChatClientStore;
  projectId: string | null;
  /** 绑定工作树时按工作树目录读取输入的文件路径。 */
  worktreeId?: string | undefined;
  projectName: string | null;
  onOpenUrl: (url: string) => Promise<void>;
  onOpenTerminal: () => void;
  onOpenReview: () => void;
  onOpenFiles: () => void;
  onOpenSideAsk: () => void;
  children?: ReactNode;
}) {
  const labels = rightWorkbenchStartLabels[isZh ? "zh" : "en"];
  const [value, setValue] = useState("");
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  // 有项目时，普通文本作为文件路径。显式协议和本机地址交给内置浏览器。
  const openInput = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = value.trim();
    if (!input || request.current) return;
    const operation = new AbortController();
    request.current = operation;
    setOpening(true);
    setError("");
    try {
      const isUrl = /^(?:https?:\/\/|localhost(?:[:/]|$)|(?:\d{1,3}\.){3}\d{1,3}(?:[:/]|$)|\[::1\](?:[:/]|$))/iu.test(input);
      if (!projectId || isUrl) {
        await onOpenUrl(input);
      } else {
        const file = await store.readProjectFile(projectId, input, operation.signal, worktreeId);
        if (!operation.signal.aborted) store.openWorkspaceFile(projectId, file.path, file.relativePath, undefined, undefined, worktreeId);
      }
    } catch (cause) {
      if (!operation.signal.aborted) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      request.current = null;
      if (!operation.signal.aborted) setOpening(false);
    }
  };

  const shortcuts = [
    { label: labels.terminal, icon: IconTerminal2, action: onOpenTerminal },
    { label: labels.changes, icon: IconFileDiff, action: onOpenReview },
    { label: labels.files, icon: IconFolder, action: onOpenFiles },
    { label: labels.sideAsk, icon: IconMessageCircle, action: onOpenSideAsk },
  ];

  return (
    <div className={styles.stage}>
      <div className={styles.content}>
        <div className={styles.heading}>
          <h2>{labels.title}</h2>
          {projectName && <span title={projectName}>{projectName}</span>}
        </div>
        <form className={styles.field} role="search" onSubmit={openInput}>
          <IconSearch size={17} aria-hidden="true" />
          <input
            type="text"
            value={value}
            autoComplete="off"
            spellCheck={false}
            placeholder={projectId ? labels.fileOrUrl : labels.url}
            aria-label={projectId ? labels.fileOrUrl : labels.url}
            onChange={(event) => { setValue(event.currentTarget.value); setError(""); }}
          />
          <button type="submit" aria-label={labels.open} title={labels.open} disabled={!value.trim() || opening}>
            <IconArrowRight size={16} aria-hidden="true" />
          </button>
        </form>
        {opening && <p className={styles.feedback} role="status">{labels.opening}</p>}
        {error && <p className={styles.feedback} role="alert">{error}</p>}
        <div className={styles.shortcuts} role="group" aria-label={labels.shortcuts}>
          {shortcuts.map(({ label, icon: Icon, action }) => (
            <button key={label} type="button" onClick={action}>
              <Icon size={18} stroke={1.7} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}
