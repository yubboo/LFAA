/**
 * 功能：验证远程节点连接配置和本地节点的关闭协议。
 * 作用：连接文件只写入临时凭据目录，真实测试子进程通过 IPC 正常退出；不向真实远端发请求。
 * 关联文件：host/daemon/src/connection-config.mjs、supervisor.mjs。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { validateDaemonConnection, configureDaemonConnection } from "../../../packages/host/daemon/src/connection-config.mjs";
import { superviseLocalDaemon } from "../../../packages/host/daemon/src/supervisor.mjs";
test("连接配置校验、原子保存和运行中拒绝改身份", async () => {
  const parent = resolve(tmpdir()), data = await mkdtemp(join(parent, "lfaa-node-config-"));
  const value = { controlPlaneUrl: "https://fixture.example/api", nodeId: randomUUID(), token: "fixture-test-token-".repeat(3), displayName: "节点测试夹具" };
  try {
    assert.throws(() => validateDaemonConnection({ ...value, controlPlaneUrl: "http://fixture.example" }));
    assert.throws(() => validateDaemonConnection({ ...value, controlPlaneUrl: "https://user:password@fixture.example" }));
    assert.throws(() => validateDaemonConnection({ ...value, nodeId: "not-a-node" }));
    const file = join(data, "fixture.json"); await writeFile(file, JSON.stringify(value));
    assert.equal((await configureDaemonConnection(file, data)).nodeId, value.nodeId);
    assert.deepEqual(JSON.parse(await readFile(join(data, "credentials/daemon-connection.json"), "utf8")), value);
    await writeFile(join(data, "credentials/daemon.lock"), "测试运行标记");
    await assert.rejects(configureDaemonConnection(file, data), /先停止/u);
  } finally { assert.equal(dirname(resolve(data)), parent); await rm(data, { recursive: true, force: true }); }
});
test("托管子进程按 IPC 正常关闭，而非强制杀进程", async () => {
  const parent = resolve(tmpdir()), data = await mkdtemp(join(parent, "lfaa-node-supervisor-"));
  const marker = join(data, "stopped.txt");
  const supervisor = superviseLocalDaemon({ args: ["-e", "process.on('message',message=>{if(message.type==='lfaa-shutdown'){require('node:fs').writeFileSync(process.argv[1],'graceful');process.disconnect();}})", marker], cwd: data, onMessage: message => assert.fail(message) });
  try { await supervisor.stop(); assert.equal(await readFile(marker, "utf8"), "graceful"); }
  finally { await supervisor.stop(); assert.equal(dirname(resolve(data)), parent); await rm(data, { recursive: true, force: true }); }
});
