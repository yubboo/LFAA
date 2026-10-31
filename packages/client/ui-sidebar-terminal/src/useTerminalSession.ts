/** 功能：共享交互式终端会话控制。作用：统一 Shell 与受管服务端控制台的认证会话、权限审批、SSE、输入/缩放队列及资源清理。关联文件：InteractiveTerminal.tsx、MinecraftWorkspace.tsx、terminal-controller。 */
import { useEffect, useRef, useState, type RefObject } from "react";
import { closeTerminal, createTerminal, decideAiApproval, getErrorMessage, resizeTerminal, sendTerminalInput, type AiToolApproval, type ApplicationId, type CreateTerminalInput, type TerminalInfo } from "lfaa-client-connection/src/api.js";
import type { TerminalSurfaceHandle, TerminalSurfaceSize } from "./TerminalSurface.js";

export interface TerminalSessionController {
  terminal?: TerminalInfo;
  approval?: AiToolApproval;
  error: string;
  busy: boolean;
  transportDisconnected: boolean;
  start(request: CreateTerminalInput, bypassBusy?: boolean): Promise<void>;
  decide(approved: boolean): Promise<void>;
  stop(): Promise<void>;
  clearError(): void;
  reportError(error: unknown): void;
  send(data: string): void;
  resize(size?: TerminalSurfaceSize): void;
}

export function useTerminalSession({ surface, appId, sessionId, permissionsMode, scopeKey, preserveSurfaceOnConnect = false, quietExit = false, quietTransportDisconnect = false }: {
  surface: RefObject<TerminalSurfaceHandle>;
  appId: ApplicationId;
  sessionId: string | null;
  permissionsMode: string;
  scopeKey: string;
  preserveSurfaceOnConnect?: boolean;
  quietExit?: boolean;
  quietTransportDisconnect?: boolean;
}): TerminalSessionController {
  const [terminal, setTerminal] = useState<TerminalInfo>(), [approval, setApproval] = useState<AiToolApproval>(), [error, setError] = useState(""), [busy, setBusy] = useState(false), [transportDisconnected, setTransportDisconnected] = useState(false);
  const active = useRef<TerminalInfo>(), stream = useRef<EventSource>(), pending = useRef<CreateTerminalInput>(), mounted = useRef(false), generation = useRef(0), startInFlight = useRef(false);
  const input = useRef(""), inputBusy = useRef(false), resizeBusy = useRef(false), latestSize = useRef<TerminalSurfaceSize>();
  const send = useRef<(data: string) => void>(() => {}), resize = useRef<(size?: TerminalSurfaceSize) => void>(() => {});

  const stop = async () => {
    generation.current++;
    const current = active.current;
    active.current = undefined;
    stream.current?.close(); stream.current = undefined;
    input.current = ""; latestSize.current = undefined;
    surface.current?.setInputEnabled(false);
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

  resize.current = size => {
    if (!surface.current || !active.current || active.current.state !== "running") return;
    latestSize.current = size ?? surface.current.getSize();
    if (resizeBusy.current) return;
    resizeBusy.current = true;
    void (async () => {
      while (latestSize.current && active.current?.state === "running") {
        const next = latestSize.current; latestSize.current = undefined;
        if (next.cols === active.current.cols && next.rows === active.current.rows) continue;
        const current = active.current;
        await resizeTerminal(current.id, next.cols, next.rows);
        if (active.current?.id === current.id) active.current = { ...active.current, ...next };
      }
    })().catch(error => { if (mounted.current) setError(getErrorMessage(error)); }).finally(() => { resizeBusy.current = false; });
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; void stop().catch(() => {}); };
  }, []);

  useEffect(() => {
    if (active.current) void stop().catch(error => { if (mounted.current) setError(getErrorMessage(error)); });
    else generation.current++;
    setApproval(undefined); pending.current = undefined;
  }, [appId, sessionId, permissionsMode, scopeKey]);

  const start = async (request: CreateTerminalInput, bypassBusy = false) => {
    if ((busy || startInFlight.current) && !bypassBusy) return;
    if (startInFlight.current) return;
    startInFlight.current = true;
    const requestGeneration = generation.current;
    setBusy(true); setError(""); setTransportDisconnected(false);
    try {
      pending.current = request;
      const result = await createTerminal(request);
      if (!mounted.current || generation.current !== requestGeneration) { if (result.terminal) await closeTerminal(result.terminal.id); return; }
      if (result.approval) { setApproval(result.approval); return; }
      if (!result.terminal) throw new Error("服务端未返回终端会话。");
      setApproval(undefined); pending.current = undefined;
      active.current = result.terminal; setTerminal(result.terminal);
      const emulator = surface.current;
      if (!emulator) { await closeTerminal(result.terminal.id); active.current = undefined; return; }
      if (!preserveSurfaceOnConnect) emulator.reset();
      emulator.setInputEnabled(true);
      let queued = 0;
      const source = new EventSource(`/api/terminals/${encodeURIComponent(result.terminal.id)}/follow`); stream.current = source;
      source.addEventListener("ready", event => {
        const frame = JSON.parse((event as MessageEvent).data);
        if (!preserveSurfaceOnConnect) emulator.reset();
        if (frame.truncated) emulator.writeln("[较早的输出已截断]");
      });
      source.addEventListener("output", event => {
        const data = JSON.parse((event as MessageEvent).data).data as string;
        queued += data.length;
        if (queued > 512 * 1024) { setError("终端输出超过绘制容量，会话已关闭。"); void stop().catch(() => {}); return; }
        emulator.write(data, () => { queued -= data.length; });
      });
      source.addEventListener("exit", event => {
        const frame = JSON.parse((event as MessageEvent).data);
        if (quietTransportDisconnect && frame.exitCode === null && frame.message === "节点终端连接已断开，会话已结束。") {
          setTransportDisconnected(true); setError(""); emulator.reset(); emulator.setInputEnabled(false); source.close(); void stop().catch(() => {}); return;
        }
        if (active.current) { active.current = { ...active.current, state: "exited", exitCode: frame.exitCode }; setTerminal(active.current); }
        emulator.setInputEnabled(false);
        if (!quietExit) emulator.writeln(`\r\n[会话已结束，退出码：${frame.exitCode ?? "未知"}]`);
        if (frame.message && !quietExit) setError(frame.message); source.close();
      });
      source.onerror = () => { source.close(); if (mounted.current) {
        emulator.setInputEnabled(false);
        if (quietTransportDisconnect) { setTransportDisconnected(true); setError(""); emulator.reset(); }
        else setError("终端连接已断开，请重新创建会话。");
        void stop().catch(() => {});
      } };
      resize.current(); emulator.focus();
    } catch (error) { if (mounted.current && generation.current === requestGeneration) {
      pending.current = undefined;
      const message = getErrorMessage(error);
      if (quietTransportDisconnect && /终端通道不可用|终端通道当前不可用|交互式终端尚未连接|节点终端连接已断开/u.test(message)) { setTransportDisconnected(true); setError(""); surface.current?.reset(); }
      else setError(message);
    } }
    finally { startInFlight.current = false; if (mounted.current) setBusy(false); }
  };

  const decide = async (approved: boolean) => {
    if (!approval || !pending.current || busy) return;
    const decisionGeneration = generation.current;
    setBusy(true);
    try {
      await decideAiApproval(approval.id, approved ? "approved" : "denied");
      if (generation.current !== decisionGeneration || !pending.current) return;
      const request = { ...pending.current, approvalId: approval.id };
      setApproval(undefined); pending.current = undefined;
      if (approved) {
        setBusy(false);
        await start(request, true);
      }
    } catch (error) { if (mounted.current) setError(getErrorMessage(error)); }
    finally { if (mounted.current) setBusy(false); }
  };

  return { terminal, approval, error, busy, transportDisconnected, start, decide, stop, clearError: () => setError(""), reportError: cause => setError(getErrorMessage(cause)), send: data => send.current(data), resize: size => resize.current(size) };
}
