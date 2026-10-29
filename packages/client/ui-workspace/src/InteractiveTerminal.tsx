/** 功能：展示真实节点交互式终端。作用：共享 Terminal Controller 会话控制器，保留节点选择、Shell 设置与任务输出入口。关联文件：TaskTerminal.tsx、ui-sidebar-terminal/src/useTerminalSession.ts、terminal-controller。 */
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Select } from "antd";
import { createReadPoller } from "lfaa-client-connection/src/read-poller.js";
import { hasAdminAccess, loadTerminalNodes, type ApplicationId, type TerminalNode, type UserRole, type UserSettings } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { TerminalSurface, useTerminalSession, type TerminalSurfaceHandle } from "lfaa-client-ui-sidebar-terminal/src/index.js";

export function InteractiveTerminal({ appId, sessionId, settings, role, onClose, onTasks }: { appId: ApplicationId; sessionId: string | null; settings: UserSettings; role: UserRole; onClose: () => void; onTasks: () => void }) {
  const [nodes, setNodes] = useState<TerminalNode[]>([]), [nodeId, setNodeId] = useState<string>();
  const emulator = useRef<TerminalSurfaceHandle>(null);
  const session = useTerminalSession({ surface: emulator, appId, sessionId, permissionsMode: settings.permissions.mode, scopeKey: "system-shell" });

  useEffect(() => {
    if (!hasAdminAccess(role)) return;
    let alive = true;
    const poller = createReadPoller(async () => {
      try {
        const result = await loadTerminalNodes(); if (!alive) return;
        setNodes(current => JSON.stringify(current) === JSON.stringify(result.nodes) ? current : result.nodes);
        const available = result.nodes.filter(node => node.connected);
        if (available.length === 1) setNodeId(current => current ?? available[0]!.id);
      } catch (error) { if (alive) session.reportError(error); }
    }, 10_000);
    return () => { alive = false; poller.stop(); };
  }, [role]);

  const start = async () => {
    if (!nodeId || session.busy) return;
    const size = emulator.current?.getSize() ?? { cols: 80, rows: 24 };
    await session.start({ id: crypto.randomUUID(), nodeId, appId, sessionId, ...size });
  };

  return <section className="module-terminal module-terminal--interactive" aria-label="交互式终端">
    <header className="module-terminal__header"><div><WorkbenchIcon name="terminal" size={15} /><strong>交互式终端</strong><Button size="small" onClick={onTasks}>任务输出</Button></div><button className="module-shell-icon-button" type="button" aria-label="关闭终端面板" onClick={onClose}><WorkbenchIcon name="close" size={15} /></button></header>
    <div className="module-terminal__interactive-body _block_lfaa_wallpaper_terminal">
      <div className="module-terminal__controls">
        <Select aria-label="终端目标节点" disabled={!!session.terminal || session.busy || !!session.approval} value={nodeId} placeholder="选择在线节点" options={nodes.map(node => ({ value: node.id, label: `${node.displayName}${node.connected ? "" : " · 终端未连接"}`, disabled: !node.connected }))} onChange={setNodeId} />
        {session.terminal ? <Button size="small" onClick={() => void session.stop().catch(error => session.reportError(error))}>结束会话</Button> : <Button size="small" disabled={!nodeId || !hasAdminAccess(role) || !!session.approval} loading={session.busy} onClick={() => void start()}>新建终端</Button>}
        {session.terminal?.state === "running" ? <Button size="small" title="发送 Ctrl+C；触屏也可中断当前命令" onClick={() => session.send("\x03")}>中断命令</Button> : null}
        <span>{session.terminal ? `${session.terminal.state === "exited" ? "已退出" : "已连接"} · ${session.terminal.cwd}` : `${settings.general.integratedShell} · ${settings.general.taskFolder || "节点数据目录"}`}</span>
      </div>
      {!hasAdminAccess(role) ? <Alert type="info" message="当前账户没有节点终端管理权限。" /> : null}
      {session.error ? <Alert type="error" message={session.error} closable onClose={session.clearError} /> : null}
      {session.approval ? <div className="module-terminal__approval"><p>{session.approval.summary}</p><small>{session.approval.scopeSummary}</small><div><Button size="small" loading={session.busy} onClick={() => void session.decide(true)}>批准本次会话</Button><Button size="small" disabled={session.busy} onClick={() => void session.decide(false)}>拒绝</Button></div></div> : null}
      <TerminalSurface ref={emulator} className="module-terminal__emulator" ariaLabel="终端输入和输出" inputMode="raw" inputEnabled={session.terminal?.state === "running"} onData={session.send} onResize={size => session.resize(size)} />
    </div>
  </section>;
}
