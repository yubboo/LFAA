// 多会话并行协调器：允许同一工作区下多个会话并发运行，并向每个活跃会话动态注入同工作区其他并发会话的实时动作摘要，避免互相踩踏。
import type { ActiveRunRecord } from "./run-records";
import type { LeaseHolder } from "./workspace-lease";

export class PeerSessionRegistry {
  private readonly active = new Map<string, LeaseHolder>();

  register(scope: string, sessionId: string, title: string, now = Date.now()): LeaseHolder {
    const holder: LeaseHolder = { scope, sessionId, title: title || "未命名会话", acquiredAt: now };
    this.active.set(sessionId, holder);
    return holder;
  }

  release(sessionId: string): void {
    this.active.delete(sessionId);
  }

  list(): LeaseHolder[] {
    return [...this.active.values()];
  }

  clear(): void {
    this.active.clear();
  }

  /** 生成同工作区其他并发会话的实时感知提示；无并发会话时返回空字符串。 */
  describePeers(
    currentSessionId: string,
    scope: string,
    runs: ReadonlyMap<string, ActiveRunRecord>,
  ): string {
    const peers = [...this.active.values()].filter(
      (item) => item.scope === scope && item.sessionId !== currentSessionId,
    );
    if (peers.length === 0) return "";

    const lines = peers.map((peer) => {
      const liveRun = [...runs.values()].find(
        (r) => r.status.sessionId === peer.sessionId && r.status.status === "running",
      );
      const lastStep = liveRun?.status.steps.at(-1);
      const action = lastStep?.toolName
        ? [lastStep.toolName, lastStep.toolTarget].filter(Boolean).join(" ")
        : (lastStep?.title || "处理中");
      return `- 会话「${peer.title}」：正在执行 ${action}`;
    });

    return [
      "同工作区多会话并行感知（当前有其他会话同时在此工作区运行）：",
      ...lines,
      "协作原则：只读查阅可放心并行；请避免修改或覆盖其他并发会话正在处理的文件，也不要强行终止它们正在运行的构建、测试或本地服务；若发现潜在文件冲突请先向用户说明。",
    ].join("\n");
  }
}
