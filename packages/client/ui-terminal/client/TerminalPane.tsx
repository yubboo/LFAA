// 真实终端面板：xterm.js 负责 ANSI/光标渲染，WebSocket 负责输入输出，尺寸随容器自适应。
// 主题色从 ui-theme 的语义变量读，浅色/深色切换时重建配色，不写死颜色。
import { memo, useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { connectTerminal, type TerminalConnection } from "./terminal-client";
import styles from "./TerminalPane.module.css";

/** 从根元素读语义色，避免在终端里写死十六进制。 */
function readThemeColors(): { background: string; foreground: string; cursor: string; selectionBackground: string } {
  const fallback = { background: "#111418", foreground: "#e6e6e6", cursor: "#e6e6e6", selectionBackground: "#3a4250" };
  if (typeof window === "undefined") return fallback;
  const style = getComputedStyle(document.documentElement);
  const pick = (name: string, downstream: string): string => style.getPropertyValue(name).trim() || downstream;
  return {
    background: pick("--color-code-bg", fallback.background) || fallback.background,
    foreground: pick("--color-code-ink", fallback.foreground) || fallback.foreground,
    cursor: pick("--color-code-ink", fallback.cursor) || fallback.cursor,
    selectionBackground: pick("--color-active", fallback.selectionBackground) || fallback.selectionBackground,
  };
}

/** 终端面板：挂载即连接，卸载只断开连接（PTY 保留在宿主，重进可续）。 */
function TerminalPaneInner({
  sessionId,
  isZh = true,
  onExit,
}: {
  /** 聊天会话 id：同一会话复用同一个 PTY。 */
  sessionId: string;
  isZh?: boolean;
  /** 终端进程退出回调（面板可据此提示重新打开）。 */
  onExit?: (code: number | undefined) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const connRef = useRef<TerminalConnection | null>(null);
  const [error, setError] = useState("");
  const [exited, setExited] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const colors = readThemeColors();
    const term = new XTerm({
      fontFamily: 'ui-monospace, "Cascadia Mono", "JetBrains Mono", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      convertEol: false,
      scrollback: 5000,
      theme: colors,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    const connection = connectTerminal({
      sessionId,
      cols: term.cols,
      rows: term.rows,
      onData: (data) => term.write(data),
      onReady: (_info, replay) => {
        if (replay) term.write(replay);
        term.focus();
      },
      onError: (message) => setError(message),
      onExit: (code) => {
        setExited(true);
        onExit?.(code);
      },
    });
    connRef.current = connection;
    const input = term.onData((data) => connection.write(data));

    // 容器尺寸变化时重算行列：拖拽期间会连续触发，用 rAF + 80ms 尾延迟合并，避免每像素一次 fit + WS resize。
    let frame = 0;
    let timer = 0;
    const applyFit = () => {
      try {
        fit.fit();
        connection.resize(term.cols, term.rows);
      } catch {
        // 面板隐藏（display:none）时尺寸为 0，忽略这次计算。
      }
    };
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        window.clearTimeout(timer);
        timer = window.setTimeout(applyFit, 80);
      });
    });
    observer.observe(host);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      observer.disconnect();
      input.dispose();
      connection.close();
      term.dispose();
    };
  }, [sessionId, onExit]);

  return (
    <div className={styles.wrap}>
      <div ref={hostRef} className={styles.host} data-testid="terminal-host" />
      {error && <p className={styles.notice}>{isZh ? `终端连接失败：${error}` : `Terminal error: ${error}`}</p>}
      {exited && !error && <p className={styles.notice}>{isZh ? "终端进程已退出" : "Terminal process exited"}</p>}
    </div>
  );
}

export const TerminalPane = memo(TerminalPaneInner);
