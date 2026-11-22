// 工作区租约：以「工作树路径 / 项目 / 授权根」为 scope，保证同一工作区同时只有一个会话在跑。
// 内存态、不落盘：进程退出即清空，避免僵尸租约；同一会话重入视为自己持有。
export interface LeaseHolder {
  scope: string;
  sessionId: string;
  title: string;
  acquiredAt: number;
}

export type LeaseAcquireResult =
  | { ok: true; lease: LeaseHolder }
  | { ok: false; holder: LeaseHolder };

/** 工作区被其他会话占用；HTTP 层映射为 409，文案给出等待或工作树并行两条出路。 */
export class WorkspaceBusyError extends Error {
  readonly code = "workspace_busy";

  constructor(readonly scope: string, readonly holder: LeaseHolder) {
    super(`工作区正被「${holder.title}」会话占用。请等它结束后重试，或为当前会话绑定工作树以并行执行。`);
    this.name = "WorkspaceBusyError";
  }
}

/** 计算租约 scope：绑定工作树用工作树路径，否则按项目，最后回落到授权根。 */
export function resolveWorkspaceScope(input: {
  worktreePath?: string | undefined;
  projectId?: string | null | undefined;
  roots?: readonly string[] | undefined;
}): string {
  if (input.worktreePath?.trim()) return `worktree:${input.worktreePath.trim()}`;
  if (input.projectId) return `project:${input.projectId}`;
  const root = input.roots?.find((item) => item.trim());
  return root ? `root:${root.trim()}` : "root:default";
}

/** 进程内租约表：acquire 同步完成，避免两个运行同时通过检查。 */
export class WorkspaceLeaseRegistry {
  private readonly byScope = new Map<string, LeaseHolder>();
  private readonly bySession = new Map<string, string>();

  acquire(scope: string, sessionId: string, title: string, now = Date.now()): LeaseAcquireResult {
    const existing = this.byScope.get(scope);
    if (existing && existing.sessionId !== sessionId) return { ok: false, holder: existing };
    // 同一会话换了 scope（改绑项目/工作树）时先释放旧租约，再登记新 scope。
    this.release(sessionId);
    const lease: LeaseHolder = { scope, sessionId, title, acquiredAt: now };
    this.byScope.set(scope, lease);
    this.bySession.set(sessionId, scope);
    return { ok: true, lease };
  }

  release(sessionId: string): void {
    const scope = this.bySession.get(sessionId);
    if (!scope) return;
    this.bySession.delete(sessionId);
    if (this.byScope.get(scope)?.sessionId === sessionId) this.byScope.delete(scope);
  }

  releaseScope(scope: string): void {
    const holder = this.byScope.get(scope);
    if (holder) this.release(holder.sessionId);
  }

  get(scope: string): LeaseHolder | undefined {
    return this.byScope.get(scope);
  }

  list(): LeaseHolder[] {
    return [...this.byScope.values()];
  }

  clear(): void {
    this.byScope.clear();
    this.bySession.clear();
  }
}