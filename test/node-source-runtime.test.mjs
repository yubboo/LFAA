/**
 * 文件：node-source-runtime.test.mjs
 * 作用：用 Node 自己的 TypeScript source loader 验证 Host 侧 workspace package 可直接加载。
 * 负责：从真实 Web Host importer 加载 Bundle 及其 Host 依赖，防止 ESM 扩展名或不可擦除 TS 语法再次让 dev server 启动失败。
 * 不负责：Vite UI 渲染、插件安装副作用、Windows 原生能力。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("Node source runtime packages can be imported by the native TypeScript loader", () => {
  const code = 'await import("@lfaa/bundle-web-app/vite");';
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "--eval", code], {
    cwd: fileURLToPath(new URL("../apps/web/", import.meta.url)),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
});
