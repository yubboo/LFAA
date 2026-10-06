/** 功能：验收 Connectivity Owner 的 EasyTier 任务文件。作用：证明账户隔离、节点领取、结果核验和过期不重放，不启动 Daemon 或下载运行包。 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const parent = resolve(tmpdir());
const dataDirectory = mkdtempSync(join(parent, "lfaa-connectivity-owner-"));
process.env.LFAA_DATA_DIR = dataDirectory;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "";
const { GameConnectivityService } = await import("lfaa-game-connectivity/src/service.js");
const { EASYTIER_RUNTIME_RELEASE } = await import("lfaa-game-connectivity/src/easytier-release.mjs");
const service = new GameConnectivityService({ lfaaCredentials: { registerRecordOwner() {} } });
test.after(() => {
  assert.equal(dirname(resolve(dataDirectory)), parent);
  rmSync(dataDirectory, { recursive: true, force: true });
});

test("Connectivity 任务文件按账户隔离、由指定节点领取并核验版本后完成", () => {
  const ownerId = randomUUID();
  const otherOwnerId = randomUUID();
  const nodeId = randomUUID();
  const task = service.createEasyTierInstallTask(ownerId, nodeId);
  assert.equal(task.status, "queued");
  assert.equal("command" in task, false);
  assert.equal("result" in task, false);
  assert.deepEqual(service.listEasyTierInstallTasks(otherOwnerId), []);
  assert.throws(() => service.createEasyTierInstallTask(otherOwnerId, nodeId), error => error.code === "easytier_install_pending");

  const claimed = service.claimEasyTierInstallTask(nodeId);
  assert.deepEqual(claimed, { id: task.id, version: EASYTIER_RUNTIME_RELEASE.version });
  assert.equal(service.claimEasyTierInstallTask(nodeId), null);
  assert.equal(service.completeEasyTierInstallTask(randomUUID(), task.id, true, EASYTIER_RUNTIME_RELEASE.version), false);
  assert.equal(service.completeEasyTierInstallTask(nodeId, task.id, true, "99.0.0"), true);
  assert.equal(service.getEasyTierInstallTask(ownerId, task.id).status, "failed");

  const restored = new GameConnectivityService({ lfaaCredentials: { registerRecordOwner() {} } });
  assert.equal(restored.getEasyTierInstallTask(ownerId, task.id).message, "EasyTier 安装或版本核验失败；请检查节点状态后再决定是否重试。");
  assert.equal(existsSync(join(dataDirectory, "connectivity", "easytier-install-tasks.json")), true);
});

test("Daemon 任务过期后标记结果未知、拒绝迟到完成并且不自动重放", () => {
  const ownerId = randomUUID();
  const nodeId = randomUUID();
  const task = service.createEasyTierInstallTask(ownerId, nodeId);
  assert.ok(service.claimEasyTierInstallTask(nodeId));

  const file = join(dataDirectory, "connectivity", "easytier-install-tasks.json");
  const document = JSON.parse(readFileSync(file, "utf8"));
  document.tasks.find(item => item.id === task.id).deadlineAt = new Date(Date.now() - 1000).toISOString();
  writeFileSync(file, JSON.stringify(document));

  assert.equal(service.claimEasyTierInstallTask(nodeId), null);
  assert.equal(service.getEasyTierInstallTask(ownerId, task.id).status, "unknown");
  assert.equal(service.completeEasyTierInstallTask(nodeId, task.id, true, EASYTIER_RUNTIME_RELEASE.version), false);
  assert.equal(service.claimEasyTierInstallTask(nodeId), null);
});
