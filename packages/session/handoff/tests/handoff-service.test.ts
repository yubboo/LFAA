// 验证交接服务：创建/方向过滤/项目隔离、接手与取消权限、持久化往返。
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { buildHandoffObjective, HandoffService } from "../src/index";

async function withStore(task: (service: HandoffService, path: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-handoff-"));
  const path = join(dir, "handoffs.json");
  try {
    await task(new HandoffService(new Context(), { storeFilePath: path }), path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("创建后按收件/发件方向与项目过滤，重新实例化仍可读取", async () => {
  await withStore(async (service, path) => {
    const directed = await service.create({
      fromSessionId: "s1",
      projectId: "p1",
      title: "拆分循环",
      summary: "A1–A4 已完成，剩余 B1",
      nextSteps: ["写 4 条回调单测", "跑 verify:web"],
      toSessionId: "s2",
    });
    const broadcast = await service.create({
      fromSessionId: "s1",
      projectId: "p1",
      title: "整理文档",
      summary: "目录说明书待补",
    });
    await service.create({
      fromSessionId: "s1",
      projectId: "p2",
      title: "别的项目",
      summary: "不应出现在 p1",
    });

    const incoming = await service.list({ sessionId: "s2", direction: "incoming", status: "pending", projectId: "p1" });
    assert.deepEqual(incoming.map((item) => item.id).sort(), [directed.id, broadcast.id].sort());

    const other = await service.list({ sessionId: "s3", direction: "incoming", status: "pending", projectId: "p1" });
    assert.deepEqual(other.map((item) => item.id), [broadcast.id]);

    const outgoing = await service.list({ sessionId: "s1", direction: "outgoing", status: "pending", projectId: "p1" });
    assert.equal(outgoing.length, 2);

    const reopened = new HandoffService(new Context(), { storeFilePath: path });
    const persisted = await reopened.list({ sessionId: "s2", direction: "incoming", projectId: "p1" });
    assert.equal(persisted.find((item) => item.id === directed.id)?.title, "拆分循环");
    assert.deepEqual(persisted.find((item) => item.id === directed.id)?.nextSteps, ["写 4 条回调单测", "跑 verify:web"]);
  });
});

test("接手：指定接收方可接手并写入 goalId，自己或未指定方被拒", async () => {
  await withStore(async (service) => {
    const item = await service.create({
      fromSessionId: "s1",
      projectId: "p1",
      title: "接手任务",
      summary: "把 B2 做完",
      toSessionId: "s2",
    });
    await assert.rejects(() => service.accept(item.id, "s1", "g1"), /自己发出的交接/u);
    await assert.rejects(() => service.accept(item.id, "s3", "g1"), /其他会话/u);

    const accepted = await service.accept(item.id, "s2", "g1");
    assert.equal(accepted.status, "accepted");
    assert.equal(accepted.acceptedBySessionId, "s2");
    assert.equal(accepted.goalId, "g1");
    assert.ok((accepted.acceptedAt ?? 0) > 0);

    await assert.rejects(() => service.accept(item.id, "s2", "g2"), /已经处理/u);
    assert.equal((await service.list({ status: "pending" })).length, 0);
    assert.equal((await service.list({ status: "accepted" })).length, 1);
  });
});

test("取消权限：发送方与指定接收方可以，广播接收方不能取消", async () => {
  await withStore(async (service) => {
    const broadcast = await service.create({ fromSessionId: "s1", projectId: "p1", title: "广播", summary: "摘要" });
    const directed = await service.create({ fromSessionId: "s1", projectId: "p1", title: "定向", summary: "摘要", toSessionId: "s2" });

    await assert.rejects(() => service.cancel(broadcast.id, "s2"), /发送方或指定接收方/u);
    assert.equal((await service.cancel(broadcast.id, "s1")).status, "cancelled");
    assert.equal((await service.cancel(directed.id, "s2")).status, "cancelled");
    await assert.rejects(() => service.cancel(directed.id, "s1"), /已经处理/u);
  });
});

test("文本归一与必填校验；objective 带下一步", async () => {
  await withStore(async (service) => {
    await assert.rejects(
      () => service.create({ fromSessionId: "s1", projectId: "p1", title: " ", summary: "x" }),
      /标题不能为空/u,
    );
    await assert.rejects(
      () => service.create({ fromSessionId: "s1", projectId: "p1", title: "t", summary: " " }),
      /摘要不能为空/u,
    );
  });
  assert.equal(buildHandoffObjective({ summary: "摘要", nextSteps: ["一", "二"] }), "摘要\n\n下一步：\n- 一\n- 二");
  assert.equal(buildHandoffObjective({ summary: "摘要", nextSteps: [] }), "摘要");
});