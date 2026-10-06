/**
 * 功能：长期回归编译后的 Harness CLI 与发布依赖。
 * 作用：启动真实 Web，检查页面、健康接口、认证和停止清理，防止只通过编译就交付。
 * 关联文件：CLI、package-loader.mjs、app-boot、package-cli.mjs、helpers/cli-process.mjs。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const temporaryRoot = resolve(root, "dist/.tmp");
async function freePort() {
  const server = createServer();
  await new Promise((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
  const port = server.address().port;
  await new Promise((done, reject) => server.close(error => error ? reject(error) : done()));
  return port;
}
async function fixture() {
  await mkdir(temporaryRoot, { recursive: true });
  const directory = await mkdtemp(resolve(temporaryRoot, "harness-cli-"));
  return { directory, async close() {
    // 测试只清理自身在根 dist 内创建的目录，不接触真实数据或其他产物。
    const path = relative(temporaryRoot, directory);
    assert.ok(path && path !== ".." && !path.startsWith(`..${sep}`));
    await rm(directory, { recursive: true, force: true });
  } };
}
function launch(directory, port, args = []) {
  const child = spawn(process.execPath, ["--import", pathToFileURL(resolve(root, "apps/cli/tests/helpers/cli-process.mjs")).href, resolve(root, "apps/cli/bin/lfaa.mjs"), "web", ...args], {
    cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: { ...process.env, NODE_ENV: "production", LFAA_LOCAL_MODE: "true", LFAA_DATA_DIR: resolve(directory, "data"), LFAA_HARNESS_HOME: "", SERVER_HOST: "127.0.0.1", SERVER_PORT: String(port), JWT_SECRET: "" }
  });
  let output = "";
  child.stdout.on("data", data => { output += data; });
  child.stderr.on("data", data => { output += data; });
  const exited = new Promise((done, reject) => { child.once("error", reject); child.once("exit", (code, signal) => done({ code, signal })); });
  return { child, exited, output: () => output };
}
async function ready(runtime, address) {
  for (let i = 0; i < 150; i++) {
    if (runtime.child.exitCode !== null || runtime.child.signalCode !== null) throw new Error(runtime.output());
    if (runtime.output().includes("LFAA Web 已就绪")) {
      const response = await fetch(`${address}/api/health`);
      assert.equal(response.status, 200);
      return;
    }
    await new Promise(done => setTimeout(done, 100));
  }
  throw new Error(`CLI 启动超时：${runtime.output()}`);
}
async function stop(runtime) {
  if (runtime.child.exitCode !== null || runtime.child.signalCode !== null) return;
  runtime.child.send("stop");
  const timer = setTimeout(() => runtime.child.kill(), 10_000);
  try { assert.deepEqual(await runtime.exited, { code: 0, signal: null }, runtime.output()); }
  finally { clearTimeout(timer); }
}

async function localNodeReady(runtime, directory) {
  if (process.platform !== "win32" || process.arch !== "x64") return;
  // 只读取测试目录内控制面的真实心跳，确认 Web 自动托管节点，而不是只看到进程启动日志。
  const database = new DatabaseSync(resolve(directory, "data/database/lfaa.sqlite"), { readOnly: true });
  try {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (database.prepare("SELECT 1 FROM daemon_nodes WHERE status='online' AND last_seen_at > ?").get(new Date(Date.now() - 20000).toISOString())) return;
      if (runtime.child.exitCode !== null || runtime.child.signalCode !== null) throw new Error(runtime.output());
      await new Promise(done => setTimeout(done, 100));
    }
    throw new Error(`Web 未自动接通本地节点：${runtime.output()}`);
  } finally { database.close(); }
}

test("生产 CLI 真实启动、认证、正常停止及同数据目录重启", { timeout: 45_000 }, async () => {
  const data = await fixture();
  const port = await freePort();
  const address = `http://127.0.0.1:${port}`;
  let runtime;
  try {
    for (let i = 0; i < 2; i++) {
      runtime = launch(data.directory, port);
      await ready(runtime, address);
      await localNodeReady(runtime, data.directory);
      assert.equal((await fetch(address)).status, 200);
      assert.equal((await fetch(`${address}/api/ai/sessions`)).status, 401);
      assert.doesNotMatch(runtime.output(), /插件未就绪|插件加载失败/);
      await stop(runtime);
    }
  } finally {
    try { if (runtime) await stop(runtime); }
    finally { await data.close(); }
  }
});

test("插件导入失败报告真实原因并释放已启动的 Web", { timeout: 25_000 }, async () => {
  const data = await fixture();
  const port = await freePort();
  let runtime;
  try {
    const home = resolve(data.directory, "harness");
    await mkdir(resolve(home, "profiles/web"), { recursive: true });
    await writeFile(resolve(home, "profiles/web/package.json"), JSON.stringify({ lfaa: { profile: { bundles: ["lfaa-base", "lfaa-web-app"] } } }));
    // 明确的失败夹具只属于测试；不在产品中注册或伪造任何插件能力。
    await writeFile(resolve(home, "cordis.patch.yml"), '- insert:\n    - id: regression-missing-entry\n      name: lfaa-agent-loop/src/regression-missing-entry.js\n');
    runtime = launch(data.directory, port, ["--home", home]);
    const timer = setTimeout(() => runtime.child.kill(), 15_000);
    try { assert.equal((await runtime.exited).code, 1, runtime.output()); }
    finally { clearTimeout(timer); }
    assert.match(runtime.output(), /插件加载失败：regression-missing-entry/);
    assert.match(runtime.output(), /Cannot find module/);
    assert.doesNotMatch(runtime.output(), /LFAA Web 已就绪/);
    const check = createServer();
    await new Promise((done, reject) => { check.once("error", reject); check.listen(port, "127.0.0.1", done); });
    await new Promise(done => check.close(done));
  } finally {
    try {
      if (runtime && runtime.child.exitCode === null && runtime.child.signalCode === null) {
        runtime.child.kill();
        await runtime.exited;
      }
    }
    finally { await data.close(); }
  }
});

test("发布清单包含全部运行能力的外部依赖", async () => {
  const packages = JSON.parse(await readFile(resolve(root, "dist/apps/control-plane/workspace.json"), "utf8"));
  const manifest = JSON.parse(await readFile(resolve(root, "dist/npm/lfaa/package.json"), "utf8"));
  for (const pkg of packages) for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
    if (!version.startsWith("workspace:")) assert.equal(manifest.dependencies[name], version, `${pkg.name} 的 ${name} 未正确打包`);
  }
  assert.ok(manifest.dependencies.ajv);
});
