// 回归测试：README 双语配对脚本必须在 Windows CRLF 检出下判定一致，避免 CI 因换行差异误报过期。
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "verify-translation-pairing.mjs");

/** 造一个含单包的临时仓库根，返回包目录。 */
function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), "lfaa-pair-"));
  const pkg = join(root, "packages", "core", "demo");
  mkdirSync(pkg, { recursive: true });
  writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "@lfaa/demo", private: true }));
  writeFileSync(join(pkg, "README.md"), "---\ndescription: \"demo\"\nkind: \"core\"\n---\n\n# demo\n\n## Usage\n\nRun it.\n");
  writeFileSync(join(pkg, "README.zh.md"), "---\ndescription: \"demo\"\nkind: \"core\"\n---\n\n# 演示\n\n## 用法\n\n直接运行。\n");
  return { root, pkg };
}

/** 跑配对脚本，返回退出码与输出。 */
function runPair(root, args) {
  try {
    const output = execFileSync(process.execPath, [SCRIPT, root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, output };
  } catch (error) {
    return { code: error.status ?? 1, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

test("README 双语配对：记录文件为 CRLF 时仍判定一致", () => {
  const { root, pkg } = makeFixture();
  assert.equal(runPair(root, ["--write"]).code, 0, "前置生成应成功");
  const recordPath = join(pkg, "README.i18n.yaml");
  const record = readFileSync(recordPath, "utf8").replace(/\r\n/gu, "\n");
  writeFileSync(recordPath, record.replace(/\n/gu, "\r\n"), "utf8");
  const result = runPair(root, []);
  assert.equal(result.code, 0, `CRLF 记录不应被判过期：${result.output}`);
  assert.match(result.output, /双语配对一致/u);
});

test("README 双语配对：内容真的变化时仍然报错", () => {
  const { root, pkg } = makeFixture();
  assert.equal(runPair(root, ["--write"]).code, 0);
  writeFileSync(join(pkg, "README.md"), "---\ndescription: \"demo\"\nkind: \"core\"\n---\n\n# demo\n\n## Usage\n\nRun it differently.\n");
  const result = runPair(root, []);
  assert.equal(result.code, 1, "英文内容变化必须被检出");
  assert.match(result.output, /双语配对记录过期/u);
});