// 验证依赖护栏规则本身：跨功能 UI 复用、客户端越界、.tsx 落位、内核反向依赖、装配边、BOM 与未声明依赖。
// 用临时夹具目录 + `--root` 运行检查脚本，避免把违规样本留在仓库里。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

const SCRIPT = join(import.meta.dirname, "check-architecture.mjs");

/** 规则文件：与仓库正式清单同形，只保留夹具用到的条目。 */
const RULES = {
  version: 1,
  sharedUiPackages: ["@lfaa/ui-theme"],
  hostOnlyPackages: ["@lfaa/web-server"],
  crossUiImports: [{ from: "@lfaa/library", to: "@lfaa/chat", reason: "夹具：已登记的单向依赖" }],
  assemblyEdges: [{ from: "@lfaa/web-server", to: "@lfaa/bundle-web", reason: "夹具：宿主装配" }],
  upwardForbidden: [{ group: "core", forbids: ["chat", "ui", "bundle"], reason: "夹具：内核不得反向依赖" }],
  clientUi: {
    allowedGroups: ["ui", "client"],
    legacy: [{ package: "@lfaa/chat", files: 1 }],
  },
};

/** 造一个包目录：写入清单与若干源文件。 */
function writePackage(root, group, name, { files = {}, deps = {} } = {}) {
  const dir = join(root, "packages", group, name.split("/")[1] ?? name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name, private: true, dependencies: deps }, null, 2));
  for (const [rel, content] of Object.entries(files)) {
    const target = join(dir, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return dir;
}

/** 造一个最小夹具仓库：规则文件 + 若干包。 */
function makeFixture(packages) {
  const root = mkdtempSync(join(tmpdir(), "lfaa-check-arch-"));
  mkdirSync(join(root, "docs", "architecture"), { recursive: true });
  writeFileSync(join(root, "docs", "architecture", "dependency-rules.json"), JSON.stringify(RULES, null, 2));
  for (const spec of packages) writePackage(root, spec.group, spec.name, spec);
  return root;
}

/** 运行检查脚本并合并输出。 */
function runCheck(root) {
  const result = spawnSync(process.execPath, [SCRIPT, "--root", root], { encoding: "utf8" });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

/** 每个用例结束都清理临时目录。 */
function withFixture(specs, assertion) {
  const root = makeFixture(specs);
  try {
    assertion(runCheck(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("干净的夹具通过护栏", () => {
  withFixture([
    { group: "core", name: "@lfaa/core-demo", files: { "src/index.ts": "export const value = 1;\n" } },
  ], ({ status, output }) => {
    assert.equal(status, 0, output);
    assert.match(output, /依赖护栏通过/u);
  });
});

test("跨功能 UI 导入未登记时拦下，登记后放行", () => {
  const files = {
    "client/index.tsx": 'import { ChatStore } from "@lfaa/chat/client";\nexport const view = ChatStore;\n',
  };
  withFixture([
    { group: "client", name: "@lfaa/chat", files: { "client/index.tsx": "export const chat = 1;\n" } },
    { group: "client", name: "@lfaa/library", deps: { "@lfaa/chat": "workspace:*" }, files },
  ], ({ status, output }) => {
    assert.equal(status, 0, output);
  });

  withFixture([
    { group: "client", name: "@lfaa/chat", files: { "client/index.tsx": "export const chat = 1;\n" } },
    { group: "client", name: "@lfaa/review", deps: { "@lfaa/chat": "workspace:*" }, files },
  ], ({ status, output }) => {
    assert.equal(status, 1);
    assert.match(output, /\[ui-cross-import\]/u);
    assert.match(output, /dependency-rules\.json/u);
  });
});

test("客户端引入 Node 专有模块或宿主包时拦下", () => {
  withFixture([
    { group: "host", name: "@lfaa/web-server", files: { "src/index.ts": "export const server = 1;\n" } },
    {
      group: "chat",
      name: "@lfaa/chat",
      deps: { "@lfaa/web-server": "workspace:*" },
      files: {
        "client/index.ts": 'import { readFile } from "node:fs";\nimport { server } from "@lfaa/web-server";\nexport const both = [readFile, server];\n',
      },
    },
  ], ({ status, output }) => {
    assert.equal(status, 1);
    assert.match(output, /\[client-node-import\]/u);
    assert.match(output, /node:fs/u);
    assert.match(output, /@lfaa\/web-server/u);
  });
});

test("包内 .tsx 必须住在 client/ 下", () => {
  withFixture([
    { group: "core", name: "@lfaa/core-demo", files: { "src/View.tsx": "export const view = 1;\n" } },
  ], ({ status, output }) => {
    assert.equal(status, 1);
    assert.match(output, /\[tsx-place\]/u);
    assert.match(output, /src\/View\.tsx/u);
  });
});

test("内核包反向依赖业务领域时拦下", () => {
  withFixture([
    { group: "chat", name: "@lfaa/chat", files: { "client/index.ts": "export const chat = 1;\n" } },
    {
      group: "core",
      name: "@lfaa/core-demo",
      deps: { "@lfaa/chat": "workspace:*" },
      files: { "src/index.ts": 'import { chat } from "@lfaa/chat";\nexport const value = chat;\n' },
    },
  ], ({ status, output }) => {
    assert.equal(status, 1);
    assert.match(output, /\[upward-dependency\]/u);
    assert.match(output, /core-demo（core）→ @lfaa\/chat（chat）/u);
  });
});

test("未登记的装配边与未声明依赖都拦下", () => {
  withFixture([
    { group: "bundle", name: "@lfaa/bundle-web", files: { "src/index.ts": "export const bundle = 1;\n" } },
    {
      group: "chat",
      name: "@lfaa/chat",
      files: { "client/index.ts": 'import { bundle } from "@lfaa/bundle-web";\nexport const value = bundle;\n' },
    },
  ], ({ status, output }) => {
    assert.equal(status, 1);
    assert.match(output, /\[undeclared-dependency\]/u);
    assert.match(output, /\[assembly-edge\]/u);
  });
});

test("能力包里的界面必须搬进 packages/client/ui-*", () => {
  withFixture([
    {
      group: "core",
      name: "@lfaa/core-demo",
      files: { "client/index.tsx": "export const view = 1;\n" },
    },
  ], ({ status, output }) => {
    assert.equal(status, 1);
    assert.match(output, /\[ui-package-required\]/u);
    assert.match(output, /packages\/client\/ui-/u);
  });

  // 客户端组里的包不受这条规则约束。
  withFixture([
    { group: "client", name: "@lfaa/client-ui-demo", files: { "client/index.tsx": "export const view = 1;\n" } },
  ], ({ status, output }) => {
    assert.equal(status, 0, output);
  });
});

test("存量界面只能变少：基线内通过，新增界面文件即失败", () => {
  withFixture([
    { group: "chat", name: "@lfaa/chat", files: { "client/index.tsx": "export const chat = 1;\n" } },
  ], ({ status, output }) => {
    assert.equal(status, 0, output);
  });

  withFixture([
    {
      group: "chat",
      name: "@lfaa/chat",
      files: {
        "client/index.tsx": "export const chat = 1;\n",
        "client/Extra.tsx": "export const extra = 1;\n",
      },
    },
  ], ({ status, output }) => {
    assert.equal(status, 1);
    assert.match(output, /\[legacy-client-grow\]/u);
    assert.match(output, /超过基线 1 个/u);
  });
});

test("apps 引用 @lfaa 包却未声明依赖时拦下", () => {
  // 先不声明依赖，再声明后复跑：真实踩过的启动故障（apps/web 仍声明旧包名）。
  const root = makeFixture([
    { group: "client", name: "@lfaa/client-ui-demo", files: { "client/index.tsx": "export const view = 1;\n" } },
  ]);
  try {
    mkdirSync(join(root, "apps", "web", "src"), { recursive: true });
    writeFileSync(join(root, "apps", "web", "package.json"), JSON.stringify({ name: "@lfaa/app-web", private: true }));
    writeFileSync(
      join(root, "apps", "web", "src", "main.tsx"),
      'import { view } from "@lfaa/client-ui-demo/client";\nexport const app = view;\n',
    );
    const first = runCheck(root);
    assert.equal(first.status, 1, first.output);
    assert.match(first.output, /\[app-undeclared-dependency\]/u);

    writeFileSync(
      join(root, "apps", "web", "package.json"),
      JSON.stringify({ name: "@lfaa/app-web", private: true, dependencies: { "@lfaa/client-ui-demo": "workspace:*" } }),
    );
    const second = runCheck(root);
    assert.equal(second.status, 0, second.output);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("带 UTF-8 BOM 的源码与文档拦下", () => {
  withFixture([
    {
      group: "core",
      name: "@lfaa/core-demo",
      files: { "src/index.ts": "\uFEFF// 夹具：带 BOM 的文件。\nexport const value = 1;\n" },
    },
  ], ({ status, output }) => {
    assert.equal(status, 1);
    assert.match(output, /\[bom\]/u);
    assert.match(output, /editorconfig/u);
  });
});