/** 功能：提供共享 xterm 终端表面。作用：用同一渲染/主题/容器尺寸承载系统 Shell 与受管服务端 PTY 原始流。关联文件：ui-workspace/src/InteractiveTerminal.tsx、ui-sidebar-terminal/src/useTerminalSession.ts、ui-minecraft/src/MinecraftWorkspace.tsx。 */
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import "./TerminalSurface.css";

export interface TerminalSurfaceSize {
  cols: number;
  rows: number;
}

export interface TerminalSurfaceHandle {
  write(data: string, callback?: () => void): void;
  writeOutput(data: string): void;
  writeln(data: string): void;
  reset(): void;
  focus(): void;
  setLine(value: string): void;
  setInputEnabled(enabled: boolean): void;
  getSize(): TerminalSurfaceSize;
}

export interface TerminalSurfaceProps {
  ariaLabel?: string;
  className?: string;
  initialMessage?: string;
  inputEnabled?: boolean;
  inputMode?: "raw" | "line";
  inputPlaceholder?: string;
  maxLineLength?: number;
  onCommand?: (command: string) => unknown | Promise<unknown>;
  onData?: (data: string) => void;
  onResize?: (size: TerminalSurfaceSize) => void;
  prompt?: string;
}

export const TerminalSurface = forwardRef<TerminalSurfaceHandle, TerminalSurfaceProps>(function TerminalSurface({
  ariaLabel = "终端输出",
  className = "",
  initialMessage = "",
  inputEnabled = false,
  inputMode = "raw",
  inputPlaceholder = "输入命令并按 Enter",
  maxLineLength = 4096,
  onCommand,
  onData,
  onResize,
  prompt = ">"
}, forwardedRef) {
  const host = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId().replace(/:/gu, "");
  const emulator = useRef<Terminal>();
  const fit = useRef<FitAddon>();
  const inputEnabledRef = useRef(inputEnabled);
  const inputModeRef = useRef(inputMode);
  const onDataRef = useRef(onData);
  const onCommandRef = useRef(onCommand);
  const onResizeRef = useRef(onResize);
  const promptRef = useRef(prompt);
  const commandPending = useRef(false);
  const allowedInput = useRef(inputEnabled);
  const commandHistory = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const [line, setLineState] = useState("");
  const [pending, setPending] = useState(false);
  const lineRef = useRef(line);
  inputEnabledRef.current = inputEnabled && !pending;
  allowedInput.current = inputEnabled;
  inputModeRef.current = inputMode;
  onDataRef.current = onData;
  onCommandRef.current = onCommand;
  onResizeRef.current = onResize;
  promptRef.current = prompt;
  lineRef.current = line;

  const setLine = (value: string) => {
    const normalized = value.replace(/[\u0000-\u001f\u007f]/gu, "").slice(0, Math.max(1, maxLineLength));
    lineRef.current = normalized;
    historyIndex.current = -1;
    setLineState(normalized);
  };

  useImperativeHandle(forwardedRef, () => ({
    write(data, callback) { emulator.current?.write(data, callback); },
    writeOutput(data) { emulator.current?.write(data); },
    writeln(data) { emulator.current?.writeln(data); },
    reset() { emulator.current?.reset(); setLine(""); },
    focus() { inputModeRef.current === "line" ? input.current?.focus() : emulator.current?.focus(); },
    setLine(value) { setLine(value); input.current?.focus(); },
    setInputEnabled(enabled) {
      inputEnabledRef.current = enabled && !commandPending.current;
      if (emulator.current) emulator.current.options.disableStdin = inputModeRef.current !== "raw" || !inputEnabledRef.current;
    },
    getSize() { return { cols: Math.max(2, emulator.current?.cols ?? 80), rows: Math.max(2, emulator.current?.rows ?? 24) }; }
  }), [maxLineLength]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const term = new Terminal({ allowTransparency: true, scrollback: 2000, cursorBlink: false, screenReaderMode: true, disableStdin: inputMode !== "raw" || !inputEnabled });
    const addon = new FitAddon();
    term.loadAddon(addon);
    term.open(element);
    emulator.current = term;
    fit.current = addon;
    if (initialMessage) term.write(initialMessage);

    let frame = 0;
    let themeSignature = "";
    const adapt = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const style = getComputedStyle(element);
        const shell = element.closest(".workbench-shell");
        const color = (name: string) => style.getPropertyValue(name).trim();
        term.options.fontFamily = color("--settings-code-font") || style.fontFamily;
        term.options.fontSize = parseFloat(color("--settings-code-font-size")) || parseFloat(style.fontSize);
        const theme = {
          background: "#00000000", foreground: color("--color-text-primary"), cursor: color("--settings-accent") || color("--color-brand"), selectionBackground: color("--color-brand-subtle"),
          red: color("--color-status-error"), green: color("--color-status-success"), yellow: color("--color-status-warning"), blue: color("--color-brand"), cyan: color("--color-brand"), magenta: color("--color-brand"), white: color("--color-text-heading"), black: color("--color-text-primary"),
          brightRed: color("--color-status-error"), brightGreen: color("--color-status-success"), brightYellow: color("--color-status-warning"), brightBlue: color("--color-brand"), brightCyan: color("--color-brand"), brightMagenta: color("--color-brand"), brightWhite: color("--color-text-heading"), brightBlack: color("--color-text-muted")
        };
        const nextTheme = JSON.stringify(theme);
        if (nextTheme !== themeSignature) { term.options.theme = theme; themeSignature = nextTheme; }
        term.options.cursorBlink = shell?.getAttribute("data-reduced-motion") === "off";
        if (element.clientWidth > 0 && element.clientHeight > 0) {
          addon.fit();
          if (term.cols > 500 || term.rows > 300) term.resize(Math.min(500, term.cols), Math.min(300, term.rows));
          onResizeRef.current?.({ cols: Math.max(2, term.cols), rows: Math.max(2, term.rows) });
        }
      });
    };
    const sizeObserver = new ResizeObserver(adapt);
    sizeObserver.observe(element);
    const themeObserver = new MutationObserver(adapt);
    const shell = element.closest(".workbench-shell");
    if (shell) themeObserver.observe(shell, { attributes: true, attributeFilter: ["style", "data-theme", "data-reduced-motion"] });

    const subscription = term.onData(data => {
      if (inputModeRef.current === "raw" && inputEnabledRef.current) onDataRef.current?.(data);
    });
    adapt();
    return () => {
      cancelAnimationFrame(frame);
      sizeObserver.disconnect();
      themeObserver.disconnect();
      subscription.dispose();
      term.dispose();
      emulator.current = undefined;
      fit.current = undefined;
    };
  }, []);

  useEffect(() => {
    const term = emulator.current;
    if (term) term.options.disableStdin = inputMode !== "raw" || !inputEnabled;
    inputEnabledRef.current = inputEnabled && !pending;
  }, [inputEnabled, inputMode, pending]);

  const submitLine = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inputEnabledRef.current || commandPending.current) return;
    const command = lineRef.current.trim();
    setLine("");
    input.current?.focus();
    if (!command) return;
    commandHistory.current = [...commandHistory.current.filter(item => item !== command), command].slice(-100);
    historyIndex.current = -1;
    emulator.current?.write(`\r\n\x1b[34m${promptRef.current}\x1b[0m ${command}\r\n`);
    try {
      const result = onCommandRef.current?.(command);
      if (result && typeof (result as PromiseLike<unknown>).then === "function") {
        commandPending.current = true;
        inputEnabledRef.current = false;
        setPending(true);
        await result;
      }
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error).replace(/[\u0000-\u001f\u007f]/gu, " ").slice(0, 240);
      emulator.current?.writeln(`[命令发送失败] ${message}`);
    } finally {
      commandPending.current = false;
      setPending(false);
      inputEnabledRef.current = allowedInput.current;
      input.current?.focus();
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowUp" && commandHistory.current.length) {
      event.preventDefault();
      const index = historyIndex.current < 0 ? commandHistory.current.length - 1 : Math.max(0, historyIndex.current - 1);
      historyIndex.current = index;
      setLine(commandHistory.current[index] ?? "");
    } else if (event.key === "ArrowDown" && historyIndex.current >= 0) {
      event.preventDefault();
      const index = historyIndex.current + 1;
      historyIndex.current = index >= commandHistory.current.length ? -1 : index;
      setLine(index >= commandHistory.current.length ? "" : commandHistory.current[index] ?? "");
    } else if (event.key === "Escape" || (event.ctrlKey && event.key.toLowerCase() === "c")) {
      event.preventDefault();
      setLine("");
    }
  };

  const classNames = ["lfaa-terminal-surface", className].filter(Boolean).join(" ");
  return <div className={classNames}>
    <div ref={host} className="lfaa-terminal-surface__output" aria-label={ariaLabel} />
    {inputMode === "line" ? <form className="lfaa-terminal-surface__line-entry" onSubmit={event => void submitLine(event)}>
      <label className="lfaa-terminal-surface__prompt" htmlFor={inputId}>{prompt}</label>
      <input ref={input} id={inputId} aria-label="终端命令输入" autoComplete="off" spellCheck={false} maxLength={Math.max(1, maxLineLength)} disabled={!inputEnabled || pending} placeholder={inputPlaceholder} value={line} onChange={event => setLine(event.target.value)} onKeyDown={handleInputKeyDown} />
      <span className="lfaa-terminal-surface__hint">Enter 发送 · ↑ 历史 · Ctrl+C 清空</span>
    </form> : null}
  </div>;
});
