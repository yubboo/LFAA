/** 功能：协调 Client Profile 图的认证态同步。作用：去重重复目标并忽略过期同步结果。关联文件：index.ts、apps/cli/tests/dsh-client-module-auth.test.mjs。 */

export interface ClientModuleAuthState {
  graph: unknown;
  authenticated: boolean;
  appliedAuthentication: boolean | null;
  pending: { authenticated: boolean; promise: Promise<void> } | null;
  revision: number;
}

export interface ClientModuleAuthSyncOptions {
  loadAuthenticatedGraph(): Promise<unknown>;
  filterUnauthenticatedGraph(graph: unknown): unknown;
  applyGraph(graph: unknown): Promise<void>;
}

/** Keep an already-applied graph stable and coalesce concurrent requests for the same auth target. */
export async function syncClientModuleGraphForAuthentication(
  runtime: ClientModuleAuthState,
  authenticated: boolean,
  options: ClientModuleAuthSyncOptions
): Promise<void> {
  if (runtime.pending?.authenticated === authenticated) return runtime.pending.promise;
  if (!runtime.pending && runtime.appliedAuthentication === authenticated) return;

  const revision = ++runtime.revision;
  if (!authenticated) runtime.authenticated = false;
  const operation = (async () => {
    let graph = runtime.graph;
    if (authenticated) graph = await options.loadAuthenticatedGraph();
    if (runtime.revision !== revision) return;
    runtime.graph = graph;
    runtime.authenticated = authenticated;
    await options.applyGraph(authenticated ? graph : options.filterUnauthenticatedGraph(graph));
    if (runtime.revision === revision) runtime.appliedAuthentication = authenticated;
  })();
  const pending = { authenticated, promise: operation };
  runtime.pending = pending;
  try {
    await operation;
  } finally {
    if (runtime.pending === pending) runtime.pending = null;
  }
}
