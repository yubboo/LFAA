// 验证 lint-workspace 的规则与棘轮豁免：用临时夹具覆盖各条规则、豁免、过期提示与注释误报。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const SCRIPT = join(import.meta.dirname, "lint-workspace.mjs");

/** 造一个最小包，src 下放覆盖全部规则的夹具文件。 */
function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), "lfaa-lint-"));
  const pkg = join(root, "packages", "core", "demo");
  mkdirSync(join(pkg, "src"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
  writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "@lfaa/demo", private: true }));
  writeFileSync(
    join(pkg, "src", "bad.ts"),
    [
      "// 夹具：覆盖各条 lint 规则。",
      'import { isAbsolute } from "node:path";',
      "export const value: any = 1;",
      'console.log("debug");',
      "debugger;",
      "const equal = value == 1;",
      "export const keep = isAbsolute(String(equal));",
      "try { keep; } catch {}",
      "// @ts-ignore",
      'export const ignored: number = "x";',
      "// @ts-expect-error",
      'export const expected: number = "y";',
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(pkg, "src", "unused.ts"),
    ['// 夹具：未使用导入。', 'import { readFile } from "node:fs/promises";', "export const ok = 1;", ""].join("\n"),
  );
  writeFileSync(
    join(pkg, "src", "safe.ts"),
    [
      "// 夹具：注释与字符串里的 @ts-ignore 不是抑制指令。",
      'const pattern = /@ts-ignore/u;',
      'const text = "@ts-ignore 只是文本";',
      "export const safe = [pattern.source, text].join();",
      "",
    ].join("\n"),
  );
  return root;
}

/** 写豁免清单（规则 → 文件数组）。 */
function writeAllowlist(root, document) {
  writeFileSync(join(root, "scripts", "lint-allowlist.json"), JSON.stringify(document), "utf8");
}

function runLint(root) {
  const result = spawnSync(process.execPath, [SCRIPT, "--root", root], { encoding: "utf8" });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const BAD = "packages/core/demo/src/bad.ts";
const UNUSED = "packages/core/demo/src/unused.ts";

test("各条规则都能命中夹具里的违规", () => {
  const root = makeFixture();
  try {
    const { status, output } = runLint(root);
    assert.equal(status, 1, "存在违规时 lint 必须失败");
    for (const rule of [
      "no-unused-import",
      "no-explicit-any",
      "no-console-log",
      "no-debugger",
      "loose-equality",
      "empty-catch",
      "ts-ignore",
      "ts-expect-error-description",
    ]) {
      assert.match(output, new RegExp(`\\[${rule}\\]`, "u"), `缺少 ${rule} 命中`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("注释与字符串里的 @ts-ignore 文本不会被误判成抑制指令", () => {
  const root = makeFixture();
  try {
    const { output } = runLint(root);
    assert.doesNotMatch(output, /safe\.ts:\d+: 使用 @ts-ignore/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("豁免清单可登记既有违规，登记后不再失败", () => {
  const root = makeFixture();
  try {
    writeAllowlist(root, {
      "no-unused-import": { files: [UNUSED] },
      "no-explicit-any": { files: [BAD] },
      "no-console-log": { files: [BAD] },
      "no-debugger": { files: [BAD] },
      "loose-equality": { files: [BAD] },
      "empty-catch": { files: [BAD] },
      "ts-ignore": { files: [BAD] },
      "ts-expect-error-description": { files: [BAD] },
    });
    const { status, output } = runLint(root);
    assert.equal(status, 0, `豁免后不应失败：${output}`);
    assert.match(output, /8 项沿用既有豁免/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("过期豁免会提示删除，未知规则名会报错", () => {
  const root = makeFixture();
  try {
    writeAllowlist(root, {
      "no-unused-import": { files: [UNUSED, "packages/core/demo/src/gone.ts"] },
      "no-explicit-any": { files: [BAD] },
      "no-console-log": { files: [BAD] },
      "no-debugger": { files: [BAD] },
      "loose-equality": { files: [BAD] },
      "empty-catch": { files: [BAD] },
      "ts-ignore": { files: [BAD] },
      "ts-expect-error-description": { files: [BAD] },
      "no-unused-vars": { files: [] },
    });
    const { status, output } = runLint(root);
    assert.equal(status, 1);
    assert.match(output, /\[allowlist-stale\].*gone\.ts/u);
    assert.match(output, /未登记的规则名「no-unused-vars」/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});