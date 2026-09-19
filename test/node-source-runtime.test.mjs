/**
 * 文件：node-source-runtime.test.mjs
 * 作用：用 Node 自己的 TypeScript source loader 验证 Host 侧 workspace package 可直接加载。
 * 负责：覆盖 Vite Config 会触达的 foundation/domain/runtime/host-adapter 包，防止 ESM 扩展名或不可擦除 TS 语法再次让 dev server 启动失败。
 * 不负责：Vite UI 渲染、插件安装副作用、Windows 原生能力。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("Node source runtime packages can be imported by the native TypeScript loader", () => {
  const code = [
    "@lfaa/credentials",
    "@lfaa/plugin-sdk",
    "@lfaa/plugin-runtime",
    "@lfaa/agent-runtime",
    "@lfaa/config-system",
    "@lfaa/plugin-host-node",
  ].map((name) => `await import(${JSON.stringify(name)});`).join("\n");
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "--eval", code], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
});
