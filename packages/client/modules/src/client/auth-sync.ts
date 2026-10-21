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

/** Whether an applied DSH graph contains the Wallpaper Engine client entry. */
export function hasWallpaperEngineClientEntry(graph: unknown): boolean {
  if (typeof graph !== "object" || graph === null) return false;
  const entries = (graph as { entries?: unknown }).entries;
  return Array.isArray(entries) && entries.some((entry) => typeof entry === "object" && entry !== null
    && (entry as { id?: unknown }).id === "dsh-plugin-wallpaper-engine");
}

/** Filter Host-declared authenticated Client modules and every module that injects them. */
export function filterUnauthenticatedClientModules(graph: unknown): unknown {
  if (typeof graph !== "object" || graph === null || !Array.isArray((graph as { entries?: unknown }).entries)
    || !Array.isArray((graph as { batches?: unknown }).batches)) return graph;
  const source = graph as { rev?: unknown; entries: unknown[]; batches: unknown[]; lfaaAuthenticatedClientModules?: unknown };
  const declared = source.lfaaAuthenticatedClientModules;
  if (declared === undefined) return graph;
  if (!Array.isArray(declared) || declared.length > 128 || declared.some((id) => typeof id !== "string" || id.length > 200)) {
    throw new Error("DSH 启动图中的 LFAA Client 认证声明无效。");
  }

  const present = new Set(source.entries.flatMap((entry) => isRecord(entry) && typeof entry.id === "string" ? [entry.id] : []));
  const blocked = new Set((declared as string[]).filter((id) => present.has(id)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of source.entries) {
      if (!isRecord(entry) || typeof entry.id !== "string" || blocked.has(entry.id) || !Array.isArray(entry.inject)) continue;
      if (entry.inject.some((id) => typeof id === "string" && blocked.has(id))) {
        blocked.add(entry.id);
        changed = true;
      }
    }
  }
  if (blocked.size === 0) return graph;

  const entries = source.entries.filter((entry) => !isRecord(entry) || typeof entry.id !== "string" || !blocked.has(entry.id));
  const batches = source.batches.flatMap((batch) => {
    if (!isRecord(batch) || !Array.isArray(batch.entries)) return [batch];
    const selected = batch.entries.filter((id) => typeof id !== "string" || !blocked.has(id));
    return selected.length ? [{ ...batch, entries: selected }] : [];
  });
  const revision = typeof source.rev === "string" ? `${source.rev}.lfaa-anon-${authModuleRevision([...blocked].sort())}` : source.rev;
  return { ...source, rev: revision, entries, batches };
}

function authModuleRevision(moduleIds: readonly string[]): string {
  let hash = 14695981039346656037n;
  for (const character of JSON.stringify(moduleIds)) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return hash.toString(16).padStart(16, "0");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReusableClientModuleGraph(graph: unknown): boolean {
  if (typeof graph !== "object" || graph === null) return false;
  const candidate = graph as { entries?: unknown; batches?: unknown };
  return Array.isArray(candidate.entries) && Array.isArray(candidate.batches);
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
    if (authenticated && !isReusableClientModuleGraph(graph)) graph = await options.loadAuthenticatedGraph();
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
