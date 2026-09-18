import { useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import "./local-terminal.css";

type TerminalState = "connecting" | "ready" | "exited" | "offline" | "error";

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

    const fitAndResize = () => {
      if (disposed) return;
      try { fitAddon.fit(); } catch { return; }
      hot.send("lfaa:terminal:resize", { clientId, cols: terminal.cols, rows: terminal.rows });
    };

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

  return <div className="lfaa-local-terminal"><div ref={hostRef} className="lfaa-local-terminal__host" /><span className={`lfaa-local-terminal__state is-${state}`}>{state}</span></div>;
}
