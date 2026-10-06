/** 功能：回归 Wallpaper Engine Client Profile 图的认证同步生命周期。作用：确保基础图不重复同步、重复认证合并且过期结果不会覆盖注销。 */
import assert from 'node:assert/strict';
import test from 'node:test';

const { syncClientModuleGraphForAuthentication } = await import('lfaa-client-modules/src/client/auth-sync.js');

const fullGraph = {
  entries: [{ id: 'lfaa-base-client' }, { id: 'dsh-plugin-wallpaper-engine' }],
  batches: [{ entries: ['lfaa-base-client', 'dsh-plugin-wallpaper-engine'] }]
};

function filterUnauthenticatedGraph(graph) {
  return {
    ...graph,
    entries: graph.entries.filter((entry) => entry.id !== 'dsh-plugin-wallpaper-engine'),
    batches: graph.batches.map((batch) => ({
      ...batch,
      entries: batch.entries.filter((id) => id !== 'dsh-plugin-wallpaper-engine')
    }))
  };
}

function createRuntime() {
  return {
    graph: filterUnauthenticatedGraph(fullGraph),
    authenticated: false,
    appliedAuthentication: false,
    pending: null,
    revision: 0
  };
}

test('coalesces authentication sync and preserves the already-started base graph', async () => {
  const runtime = createRuntime();
  const appliedGraphs = [];
  let fetchCalls = 0;
  let resolveGraph;
  const options = {
    loadAuthenticatedGraph() {
      fetchCalls += 1;
      return new Promise((resolve) => { resolveGraph = resolve; });
    },
    filterUnauthenticatedGraph,
    async applyGraph(graph) { appliedGraphs.push(graph); }
  };

  await syncClientModuleGraphForAuthentication(runtime, false, options);
  assert.equal(appliedGraphs.length, 0, 'the already-started unauthenticated graph is not reapplied');

  const firstSync = syncClientModuleGraphForAuthentication(runtime, true, options);
  const duplicateSync = syncClientModuleGraphForAuthentication(runtime, true, options);
  assert.equal(fetchCalls, 1, 'concurrent requests for the same auth target share one graph read');
  resolveGraph(fullGraph);
  await Promise.all([firstSync, duplicateSync]);
  assert.equal(appliedGraphs.length, 1);
  assert.deepEqual(appliedGraphs[0].entries.map((entry) => entry.id), ['lfaa-base-client', 'dsh-plugin-wallpaper-engine']);

  await syncClientModuleGraphForAuthentication(runtime, true, options);
  assert.equal(fetchCalls, 1, 'an already-applied authenticated graph is not reloaded');
  assert.equal(appliedGraphs.length, 1);

  await syncClientModuleGraphForAuthentication(runtime, false, options);
  assert.equal(appliedGraphs.length, 2, 'logout applies one filtered graph');
  assert.deepEqual(appliedGraphs[1].entries.map((entry) => entry.id), ['lfaa-base-client']);
  await syncClientModuleGraphForAuthentication(runtime, false, options);
  assert.equal(appliedGraphs.length, 2, 'repeated unauthenticated sync stays a no-op');
});

test('a newer logout wins over a pending authenticated graph read', async () => {
  const runtime = createRuntime();
  const appliedGraphs = [];
  let resolveGraph;
  const options = {
    loadAuthenticatedGraph: () => new Promise((resolve) => { resolveGraph = resolve; }),
    filterUnauthenticatedGraph,
    async applyGraph(graph) { appliedGraphs.push(graph); }
  };

  const loginSync = syncClientModuleGraphForAuthentication(runtime, true, options);
  await syncClientModuleGraphForAuthentication(runtime, false, options);
  resolveGraph(fullGraph);
  await loginSync;
  assert.equal(runtime.authenticated, false);
  assert.equal(runtime.appliedAuthentication, false);
  assert.equal(appliedGraphs.length, 1);
  assert.deepEqual(appliedGraphs[0].entries.map((entry) => entry.id), ['lfaa-base-client']);
});

test('a failed authenticated graph read leaves the runtime unauthenticated and retryable', async () => {
  const runtime = createRuntime();
  await assert.rejects(
    syncClientModuleGraphForAuthentication(runtime, true, {
      async loadAuthenticatedGraph() { throw new Error('Host unavailable'); },
      filterUnauthenticatedGraph,
      async applyGraph() { assert.fail('a missing authenticated graph must not be applied'); }
    }),
    /Host unavailable/u
  );
  assert.equal(runtime.authenticated, false);
  assert.equal(runtime.appliedAuthentication, false);
  assert.equal(runtime.pending, null);
});
