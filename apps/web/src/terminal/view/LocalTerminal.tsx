/**
 * 文件：LocalTerminal.tsx
 * 作用：把 xterm.js 浏览器终端连接到 Vite 本地开发 PTY 桥。
 * 负责：xterm 创建、主题同步、输入/输出 HMR 消息、尺寸同步、连接状态和清理生命周期。
 * 不负责：创建系统 PTY、权限提升、Agent 自动执行、正式 Tool Runtime。
 * 状态归属：本组件拥有一个浏览器终端实例和该实例的连接状态；PTY 会话归 Vite 服务端桥管理。
 * 对外接口：LocalTerminal()。
 * 关联文件：../styles/LocalTerminal.module.css、../../contracts/vite-custom-events.d.ts、apps/web/dev/bridges/terminal、@lfaa/app-shell BottomTerminal 插槽。
 * 修改注意事项：事件 payload 必须和 vite-custom-events.d.ts / vite.config.ts 同步；组件卸载必须释放监听器并发送 dispose。
 *
 * 数据流：键盘 -> xterm -> HMR input -> Vite -> node-pty -> Shell
 *        Shell -> node-pty -> HMR data -> xterm -> 屏幕
 */
import { useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import styles from "../styles/LocalTerminal.module.css";

// 浏览器端只记录连接显示状态；系统进程状态由服务端 PTY bridge 管理。
type TerminalState = "connecting" | "ready" | "exited" | "offline" | "error";

// 从 Agent Workbench CSS 变量读取颜色，确保 xterm 与浅/深主题同步。
function readTheme(container: HTMLElement) {
  const themeRoot = container.closest<HTMLElement>(".agent-theme");
  const styles = getComputedStyle(themeRoot ?? container);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  return {
    background: read("--agent-bg", "#1f1f1f"),
    foreground: read("--agent-text", "#f5f5f5"),
    cursor: read("--agent-text", "#f5f5f5"),
    cursorAccent: read("--agent-bg", "#1f1f1f"),
    selectionBackground: read("--agent-active", "#343434"),
    black: "#171717",
    brightBlack: "#737373",
    white: "#d4d4d4",
    brightWhite: "#ffffff",
  };
}

export function LocalTerminal() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<TerminalState>("connecting");

  // 一个组件生命周期对应一个 clientId；所有 HMR 事件都用 clientId 做会话隔离。
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const terminal = new Terminal({
      allowProposedApi: false,
      convertEol: false,
      cursorBlink: true,
      cursorStyle: "bar",
      fontFamily: 'Cascadia Mono, "Cascadia Code", Consolas, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      scrollback: 5000,
      theme: readTheme(host),
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(host);

    const hot = import.meta.hot;
    if (!hot) {
      terminal.writeln("\r\n[LFAA] 真实终端只在 Vite 本地开发模式启用。\r\n");
      setState("offline");
      return () => terminal.dispose();
    }

    const clientId = crypto.randomUUID();
    let disposed = false;
    let resizeFrame = 0;

    // FitAddon 先计算字符网格，再把 cols/rows 同步给 node-pty。
    const fitAndResize = () => {
      if (disposed) return;
      try { fitAddon.fit(); } catch { return; }
      hot.send("lfaa:terminal:resize", { clientId, cols: terminal.cols, rows: terminal.rows });
    };

    // ===== Vite HMR -> xterm：服务端输出与状态 =====
    const onData = (payload: { clientId: string; data: string }) => {
      if (payload.clientId !== clientId) return;
      terminal.write(payload.data);
    };
    const onReady = (payload: { clientId: string; shell: string }) => {
      if (payload.clientId !== clientId) return;
      setState("ready");
      fitAndResize();
      window.setTimeout(() => terminal.focus(), 30);
    };
    const onExit = (payload: { clientId: string; exitCode: number }) => {
      if (payload.clientId !== clientId) return;
      setState("exited");
      terminal.writeln(`\r\n[LFAA] 终端进程已退出（${payload.exitCode}）。`);
    };
    const onError = (payload: { clientId: string; message: string }) => {
      if (payload.clientId !== clientId) return;
      setState("error");
      terminal.writeln(`\r\n[LFAA] ${payload.message}\r\n`);
    };
    const onDisconnect = () => setState("offline");
    const onConnect = () => {
      if (disposed) return;
      setState("connecting");
      hot.send("lfaa:terminal:create", { clientId, cols: terminal.cols, rows: terminal.rows });
    };

    hot.on("lfaa:terminal:data", onData);
    hot.on("lfaa:terminal:ready", onReady);
    hot.on("lfaa:terminal:exit", onExit);
    hot.on("lfaa:terminal:error", onError);
    hot.on("vite:ws:disconnect", onDisconnect);
    hot.on("vite:ws:connect", onConnect);

    // ===== xterm -> Vite HMR：用户输入与窗口 Resize =====
    const input = terminal.onData((data) => hot.send("lfaa:terminal:input", { clientId, data }));
    const resizeObserver = new ResizeObserver(() => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(fitAndResize);
    });
    resizeObserver.observe(host);

    const themeRoot = host.closest<HTMLElement>(".agent-theme");
    const themeObserver = themeRoot ? new MutationObserver(() => { terminal.options.theme = readTheme(host); }) : null;
    themeObserver?.observe(themeRoot!, { attributes: true, attributeFilter: ["data-theme"] });

    fitAndResize();
    hot.send("lfaa:terminal:create", { clientId, cols: terminal.cols, rows: terminal.rows });

    // 卸载必须对称清理：observer / xterm listener / HMR listener / PTY session。
    return () => {
      disposed = true;
      window.cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      themeObserver?.disconnect();
      input.dispose();
      hot.send("lfaa:terminal:dispose", { clientId });
      hot.off("lfaa:terminal:data", onData);
      hot.off("lfaa:terminal:ready", onReady);
      hot.off("lfaa:terminal:exit", onExit);
      hot.off("lfaa:terminal:error", onError);
      hot.off("vite:ws:disconnect", onDisconnect);
      hot.off("vite:ws:connect", onConnect);
      terminal.dispose();
    };
  }, []);

  return <div className={styles.root}><div ref={hostRef} className={styles.host} /><span className={styles.state} data-state={state}>{state}</span></div>;
}
