// @lfaa/plugins 添加插件弹窗：支持 npm 包名 / GitHub 地址 / 本地目录三种来源，实时展示安装日志。
import { useEffect, useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { createPortal } from "react-dom";
import type { PluginRecord } from "@lfaa/plugins/contract";
import type { PluginsMessages } from "../locales";
import type { PluginsStatePayload } from "../api/plugins-client";
import { addPluginStream } from "../stream/add-stream";
import styles from "./Add-Plugin.module.css";

/** 添加插件弹窗：输入来源 → 流式安装 → 成功或失败都有明确结果。 */
export function AddPluginDialog({
  open,
  t,
  onClose,
  onInstalled,
}: {
  open: boolean;
  t: PluginsMessages;
  onClose: () => void;
  onInstalled: (state: PluginsStatePayload & { plugin: PluginRecord }) => void;
}) {
  const [spec, setSpec] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      setSpec("");
      setLogs([]);
      setRunning(false);
      setError(null);
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !running) {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, open, running]);

  useEffect(() => () => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  // 日志追加后自动滚到底部，安装输出才不会"停在上面"。
  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [logs]);

  if (!open) return null;

  const submit = async () => {
    const value = spec.trim();
    if (!value || running) return;
    setRunning(true);
    setLogs([]);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const state = await addPluginStream(value, {
        onLog: (line) => setLogs((prev) => [...prev, line]),
        signal: controller.signal,
      });
      onInstalled(state);
      setRunning(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRunning(false);
    } finally {
      abortRef.current = null;
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setRunning(false);
    setError(null);
  };

  const node = (
    <div className={styles.backdrop} onPointerDown={(event) => {
      if (event.target === event.currentTarget && !running) onClose();
    }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-label={t.addTitle}>
        <header className={styles.header}>
          <h2 className={styles.title}>{t.addTitle}</h2>
          <button type="button" className={styles.close} aria-label={t.cancel} disabled={running} onClick={onClose}>
            <IconX size={16} />
          </button>
        </header>

        <p className={styles.hint}>{t.addHint}</p>

        <input
          className={styles.input}
          value={spec}
          disabled={running}
          placeholder={t.addPlaceholder}
          autoFocus
          onChange={(event) => setSpec(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
        />

        {logs.length > 0 && (
          <pre ref={logRef} className={styles.log} aria-live="polite">{logs.join("\n")}</pre>
        )}

        {error && <p className={styles.error} role="alert">{error}</p>}

        <footer className={styles.actions}>
          {running ? (
            <button type="button" className={styles.btn} onClick={cancel}>{t.addCancel}</button>
          ) : (
            <button type="button" className={styles.btn} onClick={onClose}>{t.cancel}</button>
          )}
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={running || spec.trim().length === 0}
            onClick={() => void submit()}
          >
            {running ? t.addWorking : t.addConfirm}
          </button>
        </footer>
      </section>
    </div>
  );

  if (typeof document === "undefined") return node;
  return createPortal(node, document.querySelector("[data-device]") ?? document.body);
}
