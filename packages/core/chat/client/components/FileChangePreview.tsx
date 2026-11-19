// 右栏展示本次文件操作的前后片段，旧项目记录可查看当前 Git 差异。
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconCode, IconFileDiff } from "@tabler/icons-react";
import type { ChatClientStore } from "../chat-store";
import type { AgentStepItem, FilePreviewTab } from "../chat-types";
import { fetchGitDiff } from "../coding-settings-client";
import { getFileActivityKind } from "../file-activity";
import { timelineMessages } from "../locales";
import styles from "./FileChangePreview.module.css";

/** 轻量标出常见代码词元，原始文本始终由 React 安全渲染。 */
function sourceLine(text: string) {
  const tokens = /(?:\/\/.*$|".*?(?<!\\)"|'.*?(?<!\\)'|`[^`]*`|\b(?:import|export|from|const|let|return|function|if|else|async|await|class|interface|type|new|throw)\b|\b(?:true|false|null|\d+(?:\.\d+)?)\b)/gu;
  let cursor = 0;
  const spans = [];
  for (const match of text.matchAll(tokens)) {
    const index = match.index;
    const token = match[0];
    if (index > cursor) spans.push(text.slice(cursor, index));
    const kind = token.startsWith("//") ? "comment" : /^['"`]/u.test(token) ? "string" : "keyword";
    spans.push(<span key={index} data-token={kind}>{token}</span>);
    cursor = index + token.length;
  }
  spans.push(text.slice(cursor));
  return spans;
}

export function FileChangePreview({
  step, tab, sessionId, projectId, isZh, store,
}: {
  step: AgentStepItem;
  tab: FilePreviewTab;
  sessionId: string;
  projectId: string | null;
  isZh: boolean;
  store: ChatClientStore;
}) {
  const labels = timelineMessages[isZh ? "zh" : "en"];
  const { path, messageId, stepId } = tab;
  const change = step.fileChange;
  const [showChanges, setShowChanges] = useState(!change);
  const [source, setSource] = useState<{ content: string; truncated: boolean; error?: string } | null>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const [legacyDiff, setLegacyDiff] = useState<{ text: string; error?: string } | null>(null);
  const canReadGit = !change && Boolean(projectId) && !/^(?:[a-z]:|[\\/])/iu.test(path);
  useEffect(() => {
    if (!change) return;
    const controller = new AbortController();
    void store.readFileActivity(sessionId, messageId, stepId, controller.signal).then(
      (value) => { if (!controller.signal.aborted) setSource(value); },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setSource({ content: "", truncated: false, error: error instanceof Error ? error.message : String(error) });
        }
      },
    );
    return () => controller.abort();
  }, [store, sessionId, messageId, stepId, change]);

  useLayoutEffect(() => {
    if (!showChanges && sourceRef.current && lineRef.current) {
      sourceRef.current.scrollTop = Math.max(0, lineRef.current.offsetTop - 54);
    }
  }, [source, showChanges]);

  useEffect(() => {
    if (!canReadGit) return;
    let current = true;
    void fetchGitDiff({ projectId, filePath: path }).then(
      ({ diff }) => { if (current) setLegacyDiff({ text: diff }); },
      (error: unknown) => {
        if (current) setLegacyDiff({ text: "", error: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => { current = false; };
  }, [canReadGit, path, projectId]);

  const allLines = source?.content.split(/\r?\n/u) ?? [];
  const lines = allLines.slice(0, 2400);
  const firstChanged = change?.firstLine ?? 1;
  const endChanged = firstChanged + Math.max(1, change?.after.split("\n").length ?? 1);
  const code = /\.(?:[cm]?[jt]sx?|json|css|html)$/iu.test(path);
  return (
    <section className={styles.preview} aria-label={labels.preview}>
      <header className={styles.header}>
        <span className={styles.path} title={path}>{path.replace(/\\/gu, "/")}</span>
        {change && (
          <button className={styles.mode} type="button" onClick={() => setShowChanges((value) => !value)}>
            {showChanges ? <IconCode size={14} /> : <IconFileDiff size={14} />}
            {showChanges ? labels.source : labels.showChanges}
          </button>
        )}
      </header>
      {!showChanges ? (
        source === null || source.error
          ? <p role="status" className={styles.readState}>{source?.error ?? labels.loadingSource}</p>
          : (
            <>
              <div ref={sourceRef} className={styles.source} tabIndex={0} aria-label={labels.source}>
                {lines.map((line, index) => {
                  const number = index + 1;
                  return (
                    <div key={number} ref={number === firstChanged ? lineRef : undefined}
                      className={styles.sourceLine} data-changed={number >= firstChanged && number < endChanged}>
                      <span className={styles.lineNumber} aria-hidden="true">{number}</span>
                      <code>{code ? sourceLine(line) : line}</code>
                    </div>
                  );
                })}
              </div>
              {(source.truncated || allLines.length > lines.length) && <small>{labels.sourceLimit}</small>}
            </>
          )
      ) : change ? (
        <>
          <small>{labels.fileKinds[getFileActivityKind(step)]}</small>
          {(change.before || change.after) && <small>{labels.fromLine(change.firstLine)}</small>}
          {change.before && (
            <div className={styles.fragment} data-side="before">
              <div>{labels.before}</div><pre tabIndex={0}>{change.before}</pre>
            </div>
          )}
          {change.after && (
            <div className={styles.fragment} data-side="after">
              <div>{labels.after}</div><pre tabIndex={0}>{change.after}</pre>
            </div>
          )}
          {!change.before && !change.after && (
            <p>{change.operation === "created" ? labels.emptyFile : labels.noTextChange}</p>
          )}
          {change.truncated && <small>{labels.clipped}</small>}
        </>
      ) : (
        <>
          <p>{labels.noSnapshot}</p>
          {canReadGit && (
            <div className={styles.fragment} aria-live="polite">
              <div>{labels.currentDiff}</div>
              {legacyDiff?.text
                ? <pre tabIndex={0}>{legacyDiff.text}</pre>
                : <p>{legacyDiff === null ? labels.loadingDiff : (legacyDiff.error || labels.noDiff)}</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
