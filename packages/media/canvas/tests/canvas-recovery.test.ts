// 验证宿主重新装配后续查已提交的厂商任务，其他镜头的已选结果保持可用。
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as wait } from "node:timers/promises";
import type { CanvasRun } from "../contract/index";
import { CanvasRunner } from "../src/canvas-runner";
import { CanvasStore } from "../src/canvas-store";

test("重新装配只查询已有视频任务，避免再次向厂商投递，并保留另一镜头的结果", async () => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-canvas-run-"));
  const store = new CanvasStore(root);
  const dir = store.boardDir("test-project", randomUUID());
  const base = { createdAt: new Date().toISOString(), inputs: {}, prompt: "Orbit slowly", settings: {}, kind: "video" } as const;
  const first: CanvasRun = { ...base, id: randomUUID(), nodeId: randomUUID(), status: "succeeded", assetId: randomUUID() };
  const second: CanvasRun = { ...base, id: randomUUID(), nodeId: randomUUID(), status: "running", taskId: "existing", profileId: "profile", model: "wan3.0-video" };
  let submitted = 0;
  let queries = 0;
  const runner = new CanvasRunner(store, {
    generateImage: async () => { throw new Error("Unexpected image call"); },
    submitVideo: async () => { submitted++; throw new Error("Unexpected resubmission"); },
    querySubmittedVideo: async (input) => {
      queries++;
      assert.equal(input.taskId, "existing");
      return { ...input, model: input.modelId, elapsedMs: 0, status: "FAILED", message: "provider detail" };
    },
  });
  try {
    await Promise.all([store.saveRun(dir, first), store.saveRun(dir, second)]);
    for (const run of await store.runs(dir)) {
      runner.advance(dir, run);
      runner.advance(dir, run);
    }
    for (let retry = 0; retry < 30 && (await store.run(dir, second.id))?.status === "running"; retry++) await wait(20);
    assert.equal(submitted, 0);
    assert.equal(queries, 1);
    assert.equal((await store.run(dir, first.id))?.assetId, first.assetId);
    assert.equal((await store.run(dir, second.id))?.status, "failed");
  } finally {
    runner.stop();
    await rm(root, { recursive: true, force: true });
  }
});
