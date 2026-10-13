/** 功能：持有账户隔离的节点终端中继。作用：认证连接代际、命令应答、有界回放及断线收尾；不在控制端创建 Shell。关联文件：routes.ts、host/daemon/src/terminal-channel.mjs。 */
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import type { TerminalInfo, TerminalCommand, TerminalEvent } from "./protocol.js";
type NodeChannel = { id: string; send: (command: TerminalCommand) => void; close: () => void };
export type RegisteredTerminal = {
  userId: string; loginSessionId: string; appId: string; permissionMode: string; approved: boolean; scopeKey: string; info: TerminalInfo;
  events: EventEmitter; replay: string[]; replayBytes: number; truncated: boolean;
  lease?: ReturnType<typeof setTimeout>; follower?: (() => void) | undefined;
};
export class TerminalRegistry {
  private readonly nodes = new Map<string, NodeChannel>();
  private readonly terminals = new Map<string, RegisteredTerminal>();
  private readonly pending = new Map<string, { nodeId: string; channelId: string; resolve: (event: Extract<TerminalEvent, { type: "ack" }>) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  connected(nodeId: string): boolean { return this.nodes.has(nodeId); }
  list(userId: string): TerminalInfo[] { return [...this.terminals.values()].filter(t => t.userId === userId).map(t => t.info); }
  get(userId: string, id: string): RegisteredTerminal {
    const terminal = this.terminals.get(id);
    if (!terminal || terminal.userId !== userId) throw new ApiError(404, "terminal_not_found", "找不到当前账户的终端。");
    return terminal;
  }
  attachNode(nodeId: string, channelId: string, send: NodeChannel["send"], close: () => void): () => void {
    if (this.nodes.has(nodeId)) throw new ApiError(409, "terminal_node_connected", "节点已有终端连接。");
    this.nodes.set(nodeId, { id: channelId, send, close });
    return () => {
      if (this.nodes.get(nodeId)?.id !== channelId) return;
      this.nodes.delete(nodeId);
      for (const [id, pending] of this.pending) if (pending.nodeId === nodeId) { clearTimeout(pending.timer); this.pending.delete(id); pending.reject(new Error("节点终端连接已断开。")); }
      for (const terminal of this.terminals.values()) if (terminal.info.nodeId === nodeId) this.exited(terminal, null, "节点终端连接已断开，会话已结束。");
    };
  }
  async command(nodeId: string, command: Omit<TerminalCommand, "commandId">): Promise<Extract<TerminalEvent, { type: "ack" }>> {
    const channel = this.nodes.get(nodeId);
    if (!channel) throw new ApiError(409, "terminal_node_offline", "节点终端尚未连接，请确认目标 Daemon 已启动并更新。");
    if (this.pending.size >= 128) throw new ApiError(429, "terminal_busy", "终端请求过多，请稍后重试。");
    const commandId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(commandId); channel.close();
        reject(new ApiError(504, "terminal_timeout", "节点终端响应超时，会话已结束。"));
      }, 15_000);
      timer.unref();
      this.pending.set(commandId, { nodeId, channelId: channel.id, resolve, reject, timer });
      try { channel.send({ ...command, commandId }); }
      catch (error) { clearTimeout(timer); this.pending.delete(commandId); reject(error); }
    });
  }
  accept(nodeId: string, channelId: string, event: TerminalEvent): void {
    if (this.nodes.get(nodeId)?.id !== channelId) throw new ApiError(409, "terminal_channel_expired", "终端连接已经失效。");
    if (event.type === "ack") {
      const pending = this.pending.get(event.commandId);
      if (!pending || pending.nodeId !== nodeId || pending.channelId !== channelId) return;
      clearTimeout(pending.timer); this.pending.delete(event.commandId);
      if (event.ok) pending.resolve(event);
      else pending.reject(new ApiError(422, "terminal_execution_failed", event.message || "节点无法执行终端操作。"));
      return;
    }
    const terminal = this.terminals.get(event.id);
    if (!terminal || terminal.info.nodeId !== nodeId || terminal.info.state === "exited") return;
    if (event.type === "exit") { this.exited(terminal, event.exitCode, event.message); return; }
    terminal.replay.push(event.data); terminal.replayBytes += Buffer.byteLength(event.data);
    while (terminal.replayBytes > 256 * 1024 && terminal.replay.length) { terminal.replayBytes -= Buffer.byteLength(terminal.replay.shift()!); terminal.truncated = true; }
    terminal.events.emit("output", event.data);
  }
  async create(owner: Pick<RegisteredTerminal, "userId" | "loginSessionId" | "appId" | "permissionMode" | "approved" | "scopeKey">, input: TerminalInfo & { shell: string }): Promise<TerminalInfo> {
    if (this.terminals.has(input.id)) throw new ApiError(409, "terminal_exists", "终端标识已存在。");
    if (this.terminals.size >= 64 || [...this.terminals.values()].filter(t => t.userId === owner.userId).length >= 8) throw new ApiError(429, "terminal_limit", "终端数量已达上限，请先关闭旧会话。");
    const { shell, ...info } = input;
    const terminal: RegisteredTerminal = { ...owner, info, events: new EventEmitter(), replay: [], replayBytes: 0, truncated: false };
    this.terminals.set(info.id, terminal); this.releaseFollower(terminal);
    try {
      await this.command(info.nodeId, { type: "create", id: info.id, cwd: info.cwd, shell, cols: info.cols, rows: info.rows });
      if (terminal.info.state === "starting") terminal.info = { ...terminal.info, state: "running" };
      return terminal.info;
    } catch (error) { await this.close(owner.userId, info.id); throw error; }
  }
  follow(terminal: RegisteredTerminal, finish: () => void): () => void {
    terminal.follower?.(); clearTimeout(terminal.lease); terminal.follower = finish;
    return () => { if (terminal.follower !== finish) return; terminal.follower = undefined; this.releaseFollower(terminal); };
  }
  private releaseFollower(terminal: RegisteredTerminal): void {
    clearTimeout(terminal.lease);
    terminal.lease = setTimeout(() => { void this.close(terminal.userId, terminal.info.id); }, 30_000);
    terminal.lease.unref();
  }
  private exited(terminal: RegisteredTerminal, exitCode: number | null, message?: string): void {
    if (terminal.info.state === "exited") return;
    terminal.info = { ...terminal.info, state: "exited", exitCode };
    terminal.events.emit("exit", { exitCode, message });
    this.releaseFollower(terminal);
  }
  async close(userId: string, id: string): Promise<void> {
    const terminal = this.terminals.get(id);
    if (!terminal || terminal.userId !== userId) return;
    this.terminals.delete(id); clearTimeout(terminal.lease);
    this.exited(terminal, null); clearTimeout(terminal.lease); terminal.follower?.(); terminal.events.removeAllListeners();
    if (this.nodes.has(terminal.info.nodeId)) await this.command(terminal.info.nodeId, { type: "close", id }).catch(() => undefined);
  }
  dispose(): void {
    for (const channel of this.nodes.values()) channel.close();
    this.nodes.clear();
    for (const terminal of this.terminals.values()) { clearTimeout(terminal.lease); terminal.follower?.(); terminal.events.removeAllListeners(); }
    this.terminals.clear();
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error("终端控制器已卸载。")); }
    this.pending.clear();
  }
}
