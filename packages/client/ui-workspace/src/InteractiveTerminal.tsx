/** 功能：展示真实节点交互式终端。作用：按账户设置映射 xterm，串行发送输入/缩放、有界绘制输出并在卸载关闭会话。关联文件：TaskTerminal.tsx、connection/api.ts、terminal-controller。 */
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Select } from "antd";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { createReadPoller } from "lfaa-client-connection/src/read-poller.js";
import { closeTerminal, createTerminal, decideAiApproval, getErrorMessage, hasAdminAccess, loadTerminalNodes, resizeTerminal, sendTerminalInput, type AiToolApproval, type ApplicationId, type CreateTerminalInput, type TerminalInfo, type TerminalNode, type UserRole, type UserSettings } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";

export function InteractiveTerminal({ appId, sessionId, settings, role, onClose, onTasks }: { appId: ApplicationId; sessionId: string | null; settings: UserSettings; role: UserRole; onClose: () => void; onTasks: () => void }) {
  const [nodes, setNodes] = useState<TerminalNode[]>([]), [nodeId, setNodeId] = useState<string>(), [terminal, setTerminal] = useState<TerminalInfo>(), [approval, setApproval] = useState<AiToolApproval>(), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const host = useRef<HTMLDivElement>(null), emulator = useRef<Terminal>(), fit = useRef<FitAddon>(), active = useRef<TerminalInfo>(), stream = useRef<EventSource>(), pending = useRef<CreateTerminalInput>(), mounted = useRef(false);
  const input = useRef(""), inputBusy = useRef(false), resizeBusy = useRef(false), latestSize = useRef<{ cols: number; rows: number }>(), send = useRef<(data: string) => void>(() => {}), resize = useRef<() => void>(() => {});
  const stop = async () => {
    const current = active.current; active.current = undefined; stream.current?.close(); stream.current = undefined;
    input.current = ""; latestSize.current = undefined;
    if (emulator.current) emulator.current.options.disableStdin = true;
    if (mounted.current) setTerminal(undefined);
    if (current) await closeTerminal(current.id);
  };
  send.current = data => {
    if (!active.current || active.current.state !== "running") return;
    input.current += data;
    if (input.current.length > 64 * 1024) { setError("输入超过容量，会话已关闭。"); void stop().catch(() => {}); return; }
    if (inputBusy.current) return;
    inputBusy.current = true;
    void (async () => {
      while (input.current && active.current?.state === "running") {
        let end = Math.min(8192, input.current.length);
        if (end < input.current.length && /[\uD800-\uDBFF]/u.test(input.current[end - 1]!)) end--;
        const id = active.current.id, data = input.current.slice(0, end); input.current = input.current.slice(end);
        await sendTerminalInput(id, data);
      }
    })().catch(error => { if (mounted.current) setError(getErrorMessage(error)); void stop().catch(() => {}); }).finally(() => { inputBusy.current = false; });
  };
  resize.current = () => {
    if (!emulator.current || !active.current || active.current.state !== "running") return;
    latestSize.current = { cols: emulator.current.cols, rows: emulator.current.rows };
    if (resizeBusy.current) return;
    resizeBusy.current = true;
    void (async () => {
      while (latestSize.current && active.current?.state === "running") {
        const size = latestSize.current; latestSize.current = undefined;
        if (size.cols === active.current.cols && size.rows === active.current.rows) continue;
        const current = active.current;
        await resizeTerminal(current.id, size.cols, size.rows);
        if (active.current?.id === current.id) active.current = { ...active.current, ...size };
      }
    })().catch(error => { if (mounted.current) setError(getErrorMessage(error)); }).finally(() => { resizeBusy.current = false; });
  };
  useEffect(() => {
    mounted.current = true;
    const element = host.current!;
    const term = new Terminal({ allowTransparency: true, scrollback: 2000, cursorBlink: false, screenReaderMode: true, disableStdin: true });
    const addon = new FitAddon(); term.loadAddon(addon); term.open(element);
    emulator.current = term; fit.current = addon;
    let frame = 0, themeSignature = "";
    const adapt = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const style = getComputedStyle(element), shell = element.closest(".workbench-shell");
        const color = (name: string) => style.getPropertyValue(name).trim();
        term.options.fontFamily = color("--settings-code-font") || style.fontFamily;
        term.options.fontSize = parseFloat(color("--settings-code-font-size")) || parseFloat(style.fontSize);
        const theme = { background: "#00000000", foreground: color("--color-text-primary"), cursor: color("--settings-accent") || color("--color-brand"), selectionBackground: color("--color-brand-subtle"),
          red: color("--color-status-error"), green: color("--color-status-success"), yellow: color("--color-status-warning"), blue: color("--color-brand"), cyan: color("--color-brand"), magenta: color("--color-brand"), white: color("--color-text-heading"), black: color("--color-text-primary"),
          // ANSI 高亮色同样读取主题，避免 PowerShell 的亮黄/亮白在浅色背景下消失。
          brightRed: color("--color-status-error"), brightGreen: color("--color-status-success"), brightYellow: color("--color-status-warning"), brightBlue: color("--color-brand"), brightCyan: color("--color-brand"), brightMagenta: color("--color-brand"), brightWhite: color("--color-text-heading"), brightBlack: color("--color-text-muted") };
        // 拉伸时颜色未变就不重设 xterm 主题，避免无变化的全屏重绘。
        const nextTheme = JSON.stringify(theme);
        if (nextTheme !== themeSignature) { term.options.theme = theme; themeSignature = nextTheme; }
        term.options.cursorBlink = shell?.getAttribute("data-reduced-motion") === "off";
        if (element.clientWidth > 0 && element.clientHeight > 0) {
          addon.fit();
          // 超宽/超高容器仍遵守节点协议的容量上限，避免把正常窗口缩放变成无效请求。
          if (term.cols > 500 || term.rows > 300) term.resize(Math.min(500, term.cols), Math.min(300, term.rows));
          resize.current();
        }
      });
    };
    const sizeObserver = new ResizeObserver(adapt); sizeObserver.observe(element);
    const themeObserver = new MutationObserver(adapt), shell = element.closest(".workbench-shell");
    if (shell) themeObserver.observe(shell, { attributes: true, attributeFilter: ["style", "data-theme", "data-reduced-motion"] });
    const subscription = term.onData(data => send.current(data)); adapt();
    return () => {
      mounted.current = false; cancelAnimationFrame(frame); sizeObserver.disconnect(); themeObserver.disconnect(); subscription.dispose();
      void stop().catch(() => {}); term.dispose(); emulator.current = undefined; fit.current = undefined;
    };
  }, []);
  useEffect(() => {
    if (!hasAdminAccess(role)) return;
    let alive = true;
    const poller = createReadPoller(async () => {
      try {
        const result = await loadTerminalNodes(); if (!alive) return;
        setNodes(current => JSON.stringify(current) === JSON.stringify(result.nodes) ? current : result.nodes);
        const available = result.nodes.filter(node => node.connected);
        if (available.length === 1) setNodeId(current => current ?? available[0]!.id);
      } catch (error) { if (alive) setError(getErrorMessage(error)); }
    }, 10_000);
    return () => { alive = false; poller.stop(); };
  }, [role]);
  useEffect(() => { if (active.current) void stop().catch(error => setError(getErrorMessage(error))); setApproval(undefined); pending.current = undefined; }, [appId, settings.permissions.mode]);
  const start = async (request?: CreateTerminalInput) => {
    if (!nodeId || busy) return;
    setBusy(true); setError("");
    try {
      const body = request ?? { id: crypto.randomUUID(), nodeId, appId, sessionId, cols: emulator.current?.cols ?? 80, rows: emulator.current?.rows ?? 24 };
      pending.current = body;
      const result = await createTerminal(body);
      if (!mounted.current) { if (result.terminal) await closeTerminal(result.terminal.id); return; }
      if (result.approval) { setApproval(result.approval); return; }
      if (!result.terminal) throw new Error("服务端未返回终端会话。");
      setApproval(undefined); pending.current = undefined;
      active.current = result.terminal; setTerminal(result.terminal);
      const term = emulator.current!; term.reset(); term.options.disableStdin = false;
      let queued = 0;
      const source = new EventSource(`/api/terminals/${encodeURIComponent(result.terminal.id)}/follow`); stream.current = source;
      source.addEventListener("ready", event => {
        const frame = JSON.parse((event as MessageEvent).data);
        term.reset(); if (frame.truncated) term.writeln("[较早的输出已截断]");
      });
      source.addEventListener("output", event => {
        const data = JSON.parse((event as MessageEvent).data).data as string;
        queued += data.length;
        if (queued > 512 * 1024) { setError("终端输出超过绘制容量，会话已关闭。"); void stop().catch(() => {}); return; }
        term.write(data, () => { queued -= data.length; });
      });
      source.addEventListener("exit", event => {
        const frame = JSON.parse((event as MessageEvent).data);
        if (active.current) { active.current = { ...active.current, state: "exited", exitCode: frame.exitCode }; setTerminal(active.current); }
        term.options.disableStdin = true; term.writeln(`\r\n[会话已结束，退出码：${frame.exitCode ?? "未知"}]`);
        if (frame.message) setError(frame.message); source.close();
      });
      source.onerror = () => { source.close(); if (mounted.current) { term.options.disableStdin = true; setError("终端连接已断开，请重新创建会话。"); void stop().catch(() => {}); } };
      resize.current(); term.focus();
    } catch (error) { if (mounted.current) setError(getErrorMessage(error)); }
    finally { if (mounted.current) setBusy(false); }
  };
  const decide = async (approved: boolean) => {
    if (!approval || !pending.current || busy) return;
    setBusy(true);
    try {
      await decideAiApproval(approval.id, approved ? "approved" : "denied");
      const body = { ...pending.current, approvalId: approval.id }; setApproval(undefined);
      setBusy(false);
      if (approved) await start(body); else pending.current = undefined;
    } catch (error) { setError(getErrorMessage(error)); setBusy(false); }
  };
  return <section className="module-terminal module-terminal--interactive" aria-label="交互式终端">
    <header className="module-terminal__header"><div><WorkbenchIcon name="terminal" size={15} /><strong>交互式终端</strong><Button size="small" onClick={onTasks}>任务输出</Button></div><button className="module-shell-icon-button" type="button" aria-label="关闭终端面板" onClick={onClose}><WorkbenchIcon name="close" size={15} /></button></header>
    <div className="module-terminal__interactive-body _block_lfaa_wallpaper_terminal">
      <div className="module-terminal__controls">
        <Select aria-label="终端目标节点" disabled={!!terminal || busy || !!approval} value={nodeId} placeholder="选择在线节点" options={nodes.map(node => ({ value: node.id, label: `${node.displayName}${node.connected ? "" : " · 终端未连接"}`, disabled: !node.connected }))} onChange={setNodeId} />
        {terminal ? <Button size="small" onClick={() => void stop().catch(error => setError(getErrorMessage(error)))}>结束会话</Button> : <Button size="small" disabled={!nodeId || !hasAdminAccess(role) || !!approval} loading={busy} onClick={() => void start()}>新建终端</Button>}
        {terminal?.state === "running" ? <Button size="small" title="发送 Ctrl+C；触屏也可中断当前命令" onClick={() => send.current("\x03")}>中断命令</Button> : null}
        <span>{terminal ? `${terminal.state === "exited" ? "已退出" : "已连接"} · ${terminal.cwd}` : `${settings.general.integratedShell} · ${settings.general.taskFolder || "节点数据目录"}`}</span>
      </div>
      {!hasAdminAccess(role) ? <Alert type="info" message="当前账户没有节点终端管理权限。" /> : null}
      {error ? <Alert type="error" message={error} closable onClose={() => setError("")} /> : null}
      {approval ? <div className="module-terminal__approval"><p>{approval.summary}</p><small>{approval.scopeSummary}</small><div><Button size="small" loading={busy} onClick={() => void decide(true)}>批准本次会话</Button><Button size="small" disabled={busy} onClick={() => void decide(false)}>拒绝</Button></div></div> : null}
      <div ref={host} className="module-terminal__emulator" aria-label="终端输入和输出" />
    </div>
  </section>;
}
