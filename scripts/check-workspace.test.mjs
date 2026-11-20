// 验证 check-workspace 的新增规则本身：文件规模、client 越界相对导入、写死颜色与豁免清单棘轮。
// 用临时夹具目录 + `--root` 运行检查脚本，避免把违规样本留在仓库里。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const SCRIPT = join(import.meta.dirname, "check-workspace.mjs");

/** 造一个最小包：含一个超限 tsx、一个 client 越界导入、一个写死颜色的样式文件。 */
function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), "lfaa-check-"));
  const pkg = join(root, "packages", "core", "demo");
  mkdirSync(join(pkg, "src"), { recursive: true });
  mkdirSync(join(pkg, "client"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
  writeFileSync(
    join(pkg, "package.json"),
    JSON.stringify({ name: "@lfaa/demo", private: true, exports: { ".": "./src/index.ts" } }),
  );
  writeFileSync(
    join(pkg, "README.md"),
    '---\ndescription: "demo"\nkind: "core"\n---\n\n# demo\n',
  );
  writeFileSync(join(pkg, "README.zh.md"), "---\ndescription: \"demo\"\nkind: \"core\"\n---\n");
  writeFileSync(join(pkg, "README.i18n.yaml"), "/:\n  en: 0\n  zh: 0\n");
  writeFileSync(join(pkg, "src", "index.ts"), "// 夹具包入口：仅用于检查规则回归。\nexport const value = 1;\n");
  writeFileSync(
    join(pkg, "client", "Legacy.tsx"),
    '// 夹具：client 用相对路径导入 Host 内部模块。\nimport { value } from "../src/index";\nexport const view = value;\n',
  );
  writeFileSync(
    join(pkg, "client", "Theme.module.css"),
    "/* 夹具：写死颜色，应当被拦下。 */\n.card { color: #ff0000; background: rgba(0, 0, 0, 0.4); }\n",
  );
  writeFileSync(
    join(pkg, "client", "Heavy.tsx"),
    `// 夹具：超过 tsx 硬上限。\n${"const line = 1;\n".repeat(401)}`,
  );
  return root;
}

/** 写入豁免清单（规则 → 文件数组）。 */
function writeAllowlist(root, document) {
  writeFileSync(join(root, "scripts", "check-allowlist.json"), JSON.stringify(document), "utf8");
}

function runCheck(root) {
  const result = spawnSync(process.execPath, [SCRIPT, "--root", root], { encoding: "utf8" });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

/** 造一个只含样式文件的夹具，用于验证主题色规则的精确定义。 */
function makeCssFixture() {
  const root = mkdtempSync(join(tmpdir(), "lfaa-check-css-"));
  const pkg = join(root, "packages", "core", "demo");
  mkdirSync(join(pkg, "client"), { recursive: true });
  mkdirSync(join(root, "scripts"), { recursive: true });
  writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "@lfaa/demo", private: true, exports: { ".": "./src/index.ts" } }));
  for (const name of ["README.md", "README.zh.md", "README.i18n.yaml"]) {
    writeFileSync(join(pkg, name), name === "README.md" ? '---\ndescription: "demo"\nkind: "core"\n---\n\n# demo\n' : "/:\n  en: 0\n");
  }
  mkdirSync(join(pkg, "src"), { recursive: true });
  writeFileSync(join(pkg, "src", "index.ts"), "// 夹具包入口：仅用于检查规则回归。\nexport const value = 1;\n");
  writeFileSync(
    join(pkg, "client", "Theme.module.css"),
    [
      "/* 夹具：阴影与半透明材质允许，固定色与固定色回退禁止。 */",
      ".card {",
      "  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.3);",
      "  background: rgb(15 23 28 / 0.08);",
      "  border-color: rgb(15 23 28 / 0.12);",
      "}",
      ".bad {",
      "  color: var(--color-ink, #111111);",
      "}",
      ".also-bad {",
      "  background: #f5f5f5;",
      "}",
      "",
    ].join("\n"),
  );
  return root;
}

test("主题色规则：阴影与半透明材质放行，固定色及其 var() 回退必须被拦", () => {
  const root = makeCssFixture();
  try {
    const { status, output } = runCheck(root);
    assert.equal(status, 1, "存在写死颜色时检查必须失败");
    // 同一个文件里 2 行违规：var() 固定色回退 + 裸写背景色。
    assert.match(output, /\[css-theme-literal\].*2 处写死颜色（行 8, 11）/u);
    assert.match(output, /\[css-theme-literal\].*禁止/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("新增规则能拦住超限文件、client 越界导入与写死颜色", () => {
  const root = makeFixture();
  try {
    const { status, output } = runCheck(root);
    assert.equal(status, 1, "存在违规时检查必须失败");
    assert.match(output, /\[file-size\].*超过硬上限 400/u);
    assert.match(output, /\[client-isolation\].*禁止相对导入 Host 内部文件/u);
    assert.match(output, /\[css-theme-literal\].*1 处写死颜色/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("豁免清单可登记既有债务，登记后不再报错", () => {
  const root = makeFixture();
  try {
    writeAllowlist(root, {
      "file-size": { files: ["packages/core/demo/client/Heavy.tsx"] },
      "client-host-relative": { files: ["packages/core/demo/client/Legacy.tsx"] },
      "css-theme-literal": { files: ["packages/core/demo/client/Theme.module.css"] },
    });
    const { status, output } = runCheck(root);
    assert.equal(status, 0, `豁免后不应失败：${output}`);
    assert.match(output, /3 项沿用既有豁免/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("已修好的豁免项会提示删除，避免清单固化", () => {
  const root = makeFixture();
  try {
    writeAllowlist(root, {
      "file-size": { files: ["packages/core/demo/client/Heavy.tsx", "packages/core/demo/client/Gone.tsx"] },
      "client-host-relative": { files: ["packages/core/demo/client/Legacy.tsx"] },
      "css-theme-literal": { files: ["packages/core/demo/client/Theme.module.css"] },
    });
    const { output } = runCheck(root);
    assert.match(output, /\[allowlist-stale\].*Gone\.tsx/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("豁免清单里的未知规则名直接报错，避免拼写导致豁免静默失效", () => {
  const root = makeFixture();
  try {
    writeAllowlist(root, { "file-sizes": { files: [] } });
    const { status, output } = runCheck(root);
    assert.equal(status, 1);
    assert.match(output, /\[allowlist\].*未登记的规则名「file-sizes」/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});