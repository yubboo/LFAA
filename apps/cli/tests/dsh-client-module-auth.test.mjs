/** 功能：回归 Wallpaper Engine Client Profile 图的认证同步生命周期。作用：确保基础图不重复同步、重复认证合并且过期结果不会覆盖注销。 */
import assert from 'node:assert/strict';
import test from 'node:test';

const { filterUnauthenticatedClientModules, hasWallpaperEngineClientEntry, syncClientModuleGraphForAuthentication } = await import('lfaa-client-modules/src/client/auth-sync.js');

const fullGraph = {
  rev: 'fixture-graph',
  lfaaAuthenticatedClientModules: ['dsh-plugin-wallpaper-engine', '@example/router-client'],
  entries: [
    { id: 'lfaa-base-client', inject: [] },
    { id: 'dsh-plugin-wallpaper-engine', inject: [] },
    { id: '@example/router-client', inject: [] },
    { id: '@example/consumer-client', inject: ['@example/router-client'] }
  ],
  batches: [
    { entries: ['lfaa-base-client'] },
    { entries: ['dsh-plugin-wallpaper-engine', '@example/router-client', '@example/consumer-client'] }
  ]
};

function createRuntime() {
  return {
    graph: fullGraph,
    authenticated: false,
    appliedAuthentication: false,
    pending: null,
    revision: 0
  };
}

test('filters all Host-marked authenticated client bundles and their dependent modules', () => {
  assert.equal(hasWallpaperEngineClientEntry(fullGraph), true);
  const filtered = filterUnauthenticatedClientModules(fullGraph);
  assert.deepEqual(filtered.entries.map((entry) => entry.id), ['lfaa-base-client']);
  assert.deepEqual(filtered.batches.map((batch) => batch.entries), [['lfaa-base-client']]);
  assert.notEqual(filtered.rev, fullGraph.rev, 'the filtered graph has a distinct revision for the DSH loader');
  assert.deepEqual(fullGraph.entries.map((entry) => entry.id), ['lfaa-base-client', 'dsh-plugin-wallpaper-engine', '@example/router-client', '@example/consumer-client'], 'filtering does not mutate the Host-owned graph');
  assert.equal(hasWallpaperEngineClientEntry(filtered), false);
  assert.equal(hasWallpaperEngineClientEntry(null), false);
  assert.equal(filterUnauthenticatedClientModules({ entries: [], batches: [] }).entries.length, 0, 'legacy graphs without auth metadata remain compatible');
  assert.throws(() => filterUnauthenticatedClientModules({ ...fullGraph, lfaaAuthenticatedClientModules: ['x'.repeat(201)] }), /认证声明无效/u);
});

test('reuses the complete HTML bootstrap graph and coalesces concurrent authentication sync', async () => {
  const runtime = createRuntime();
  const appliedGraphs = [];
  let fetchCalls = 0;
  const options = {
    loadAuthenticatedGraph() {
      fetchCalls += 1;
      return Promise.resolve(fullGraph);
    },
    filterUnauthenticatedGraph: filterUnauthenticatedClientModules,
    async applyGraph(graph) { await Promise.resolve(); appliedGraphs.push(graph); }
  };

  await syncClientModuleGraphForAuthentication(runtime, false, options);
  assert.equal(appliedGraphs.length, 0, 'the already-started unauthenticated graph is not reapplied');

  const firstSync = syncClientModuleGraphForAuthentication(runtime, true, options);
  const duplicateSync = syncClientModuleGraphForAuthentication(runtime, true, options);
  assert.equal(fetchCalls, 0, 'the current page already has the same graph in its HTML bootstrap');
  await Promise.all([firstSync, duplicateSync]);
  assert.equal(appliedGraphs.length, 1);
  assert.deepEqual(appliedGraphs[0].entries.map((entry) => entry.id), fullGraph.entries.map((entry) => entry.id));

  await syncClientModuleGraphForAuthentication(runtime, true, options);
  assert.equal(fetchCalls, 0, 'an already-applied authenticated graph does not trigger a Host read');
  assert.equal(appliedGraphs.length, 1);

  await syncClientModuleGraphForAuthentication(runtime, false, options);
  assert.equal(appliedGraphs.length, 2, 'logout applies one filtered graph');
  assert.deepEqual(appliedGraphs[1].entries.map((entry) => entry.id), ['lfaa-base-client']);
  await syncClientModuleGraphForAuthentication(runtime, false, options);
  assert.equal(appliedGraphs.length, 2, 'repeated unauthenticated sync stays a no-op');
});

test('a newer logout wins over a pending authenticated graph read', async () => {
  const runtime = createRuntime();
  runtime.graph = null;
  const appliedGraphs = [];
  let resolveGraph;
  const options = {
    loadAuthenticatedGraph: () => new Promise((resolve) => { resolveGraph = resolve; }),
    filterUnauthenticatedGraph: filterUnauthenticatedClientModules,
    async applyGraph(graph) { appliedGraphs.push(graph); }
  };

  const loginSync = syncClientModuleGraphForAuthentication(runtime, true, options);
  await syncClientModuleGraphForAuthentication(runtime, false, options);
  resolveGraph(fullGraph);
  await loginSync;
  assert.equal(runtime.authenticated, false);
  assert.equal(runtime.appliedAuthentication, false);
  assert.equal(appliedGraphs.length, 1);
  assert.equal(appliedGraphs[0], null, 'the stale authenticated graph is discarded after logout');
});

test('a failed authenticated graph read leaves the runtime unauthenticated and retryable', async () => {
  const runtime = createRuntime();
  runtime.graph = null;
  await assert.rejects(
    syncClientModuleGraphForAuthentication(runtime, true, {
      async loadAuthenticatedGraph() { throw new Error('Host unavailable'); },
      filterUnauthenticatedGraph: filterUnauthenticatedClientModules,
      async applyGraph() { assert.fail('a missing authenticated graph must not be applied'); }
    }),
    /Host unavailable/u
  );
  assert.equal(runtime.authenticated, false);
  assert.equal(runtime.appliedAuthentication, false);
  assert.equal(runtime.pending, null);
});
