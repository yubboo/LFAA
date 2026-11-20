// 统一测试入口：枚举 packages 与 scripts 下的 node:test 用例文件，交给 Node 测试运行器执行。
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PACKAGES_DIR = join(ROOT, "packages");
const SCRIPTS_DIR = join(ROOT, "scripts");

/** 解析 --filter / --reporter 参数；其余原样交给 Node。 */
function parseArgs(argv) {
  const options = { filter: "", reporter: "spec" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--filter" && argv[index + 1]) {
      options.filter = argv[index + 1];
      index += 1;
    } else if (arg === "--reporter" && argv[index + 1]) {
      options.reporter = argv[index + 1];
      index += 1;
    }
  }
  return options;
}

/** 递归收集测试用例文件，跳过依赖与产物目录；`pattern` 决定文件名形态。 */
function walk(dir, pattern, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry === "lib") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, pattern, out);
    else if (pattern.test(entry)) out.push(full);
  }
  return out;
}

/** 把绝对路径转成仓库相对的 posix 路径，供过滤与显示。 */
function toRelative(file) {
  return relative(ROOT, file).split(sep).join("/");
}

/** 测试前确保运行期 lib 产物存在：全新克隆（如 CI）没有 lib，插件生命周期用例会因 import 失败而挂掉。 */
function ensureRuntimeLibs() {
  const result = spawnSync(process.execPath, [join(ROOT, "scripts", "ensure-lib.mjs")], { cwd: ROOT, stdio: "inherit" });
  return result.status === 0;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!ensureRuntimeLibs()) {
    console.error("运行期 lib 产物准备失败，已中止测试。");
    process.exitCode = 1;
    return;
  }
  const all = [
    ...walk(PACKAGES_DIR, /\.test\.(ts|tsx)$/u),
    ...walk(SCRIPTS_DIR, /\.test\.mjs$/u),
  ].map((file) => ({ file, rel: toRelative(file) }));
  const selected = options.filter
    ? all.filter((item) => item.rel.includes(options.filter))
    : all;

  if (selected.length === 0) {
    console.error(
      options.filter
        ? `没有匹配「${options.filter}」的测试文件。`
        : "没有找到任何 *.test.ts / *.test.tsx 用例文件。",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`运行 ${selected.length} / ${all.length} 个测试文件（tsx + tsconfig paths → 源码）`);
  for (const item of selected) console.log(`  · ${item.rel}`);
  console.log("");

  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--test",
      `--test-reporter=${options.reporter}`,
      ...selected.map((item) => item.file),
    ],
    { cwd: ROOT, stdio: "inherit" },
  );

  if (result.error) {
    console.error("启动测试运行器失败：", result.error.message);
    process.exitCode = 1;
    return;
  }
  process.exitCode = result.status ?? 1;
}

main();


