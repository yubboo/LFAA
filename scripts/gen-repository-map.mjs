// 生成仓库目录说明书：按真实文件系统输出骨架与每个源码文件的中文职责首行。
// 骨架变动后运行 `pnpm map:sync`；`--check` 用于门禁，发现文档与磁盘不一致即退出 1。
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = join(ROOT, "docs", "architecture", "repository-map.md");
const CHECK = process.argv.includes("--check");

// 构建产物、依赖与运行数据不属于骨架；日志卷只统计条数，不逐条展开。
const SKIP_DIRS = new Set(["node_modules", ".git", "lib", "dist", ".desktop-build", ".mcdev", "data", ".agents", ".tmp"]);
const SUMMARY_DIRS = ["docs/dev-log", "docs/updata-log", "vendor"];
// 逐文件收录的范围；其余目录只出现在总览里。
const DETAIL_ROOTS = ["apps", "packages", "scripts", ".githooks", ".github", "patches", "docs/architecture", "docs/standards", "docs/templates"];

// 快速索引：路径必须真实存在，否则生成失败——避免索引指向已删除的旧骨架。
const QUICK_LINKS = [
  { label: "Windows 菜单与本地启动", targets: ["lfaa.bat", "scripts/lfaa.ps1", "scripts/ensure-dependencies.mjs"] },
  { label: "Web 服务的 Host 装配", targets: ["packages/host/web-server/src/runtime.ts", "packages/host/web-server/src/static-server.ts", "packages/bundle/web/src/index.ts"] },
  { label: "Web 前端入口与插件装配", targets: ["apps/web/index.html", "apps/web/src/main.tsx"] },
  { label: "四栏 Shell 与工作台服务", targets: ["packages/ui/layout/client/shell/WorkbenchShell.tsx", "packages/ui/layout/client/workbench-service.ts"] },
  { label: "聊天工作区与状态机", targets: ["packages/client/ui-chat/client/conversation/ChatWorkspace.tsx", "packages/client/ui-chat/client/store/chat-store.ts", "packages/client/ui-chat/client/composer/useChatComposer.ts"] },
  { label: "Agent 任务循环与工具", targets: ["packages/core/agent/src/run/agent-loop.ts", "packages/core/tools/src/index.ts", "packages/core/llm/src/index.ts"] },
  { label: "插件生命周期与来源安装", targets: ["packages/extension/plugins/src/manager/plugin-manager.ts", "packages/extension/plugins/src/manager/install-external.ts", "packages/extension/plugins/src/manager/fork-plugin.ts"] },
  { label: "项目、分区与工作树", targets: ["packages/workspace/workspace/src/index.ts", "packages/workspace/sections/src/index.ts", "packages/workspace/worktree/src/index.ts"] },
  { label: "主题与共享控件", targets: ["packages/ui/theme/client/index.tsx", "packages/ui/primitives/client/index.tsx"] },
  { label: "仓库门禁与探针", targets: ["scripts/check-workspace.mjs", "scripts/check-logs.mjs", "scripts/probe-boot.mjs", "scripts/verify-web.mts"] },
];

const missing = QUICK_LINKS.flatMap((link) => link.targets.filter((target) => !existsSync(join(ROOT, target))).map((target) => `${link.label}: ${target}`));
if (missing.length > 0) {
  console.error(`快速索引指向不存在的文件，请先修正 QUICK_LINKS：\n${missing.join("\n")}`);
  process.exit(1);
}

/** 递归收集文件；返回相对 ROOT 的 POSIX 路径。 */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
    } else if (entry.isFile()) {
      // 构建信息与临时产物不算骨架。
      if (entry.name.endsWith(".tsbuildinfo")) continue;
      out.push(relative(ROOT, join(dir, entry.name)).split(sep).join("/"));
    }
  }
  return out;
}

const allFiles = walk(ROOT).sort();
const detailed = allFiles.filter((file) => DETAIL_ROOTS.some((root) => file === root || file.startsWith(`${root}/`)));
const summaries = SUMMARY_DIRS.map((dir) => ({
  dir,
  files: allFiles.filter((file) => file.startsWith(`${dir}/`)),
  directories: new Set(allFiles.filter((file) => file.startsWith(`${dir}/`)).map((file) => dirname(file))).size,
}));
const summarySet = new Set(summaries.flatMap((item) => item.files));
const detailedOnly = detailed.filter((file) => !summarySet.has(file));

/** 取首行中文注释作为职责；没有注释时留空，由文件名承担语义。 */
function describe(file) {
  const text = readFileSync(join(ROOT, file), "utf8").replace(/^\uFEFF/u, "");
  const first = (text.split(/\r?\n/u)[0] ?? "").trim();
  const patterns = [/^\/\/\s*(.+)$/u, /^\/\*\s*(.+?)\s*\*\/\s*$/u, /^#\s*(.+)$/u, /^<!--\s*(.+?)\s*-->\s*$/u];
  for (const pattern of patterns) {
    const match = pattern.exec(first);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

/** 按目录分组；组内按文件名排序。 */
function groupByDirectory(files) {
  const groups = new Map();
  for (const file of files) {
    const dir = dirname(file);
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push(file);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

const packageCount = new Set(allFiles.filter((file) => /^packages\/[^/]+\/[^/]+\/package\.json$/u.test(file))).size;
const dirCount = new Set(allFiles.map((file) => dirname(file))).size;
const lines = [];
lines.push("# LFAA 仓库目录说明书", "");
lines.push("> 本文件由 `pnpm map:sync`（[scripts/gen-repository-map.mjs](../../scripts/gen-repository-map.mjs)）按真实文件系统生成，**不要手改**。");
lines.push("> 骨架发生变化（新增/删除/移动文件、包或目录）后，必须在同一轮运行 `pnpm map:sync` 并提交，否则 `pnpm check` 会失败。");
lines.push("");
lines.push(`当前快照：**${packageCount} 个包、${allFiles.length} 个文件、${dirCount} 个子目录**（不含 node_modules、构建产物与运行数据）。`);
lines.push("");
lines.push("## 1. 快速索引", "");
lines.push("| 想找什么 | 从哪里看 |", "| --- | --- |");
for (const link of QUICK_LINKS) {
  const links = link.targets.map((target) => `[${target.split("/").pop()}](${relative(join(ROOT, "docs", "architecture"), join(ROOT, target)).split(sep).join("/")})`);
  lines.push(`| ${link.label} | ${links.join(" → ")} |`);
}
lines.push("");
lines.push("## 2. 项目总览", "");
lines.push("### 2.1 目录树", "");
lines.push("目录后标注其下文件数；包目录标注包名。完整文件清单见第 3 节。", "");
lines.push("```text", "lfaa/");

const dirSet = new Set(["."]);
for (const file of allFiles) {
  let dir = dirname(file);
  while (dir !== "." && dir !== "") {
    dirSet.add(dir);
    dir = dirname(dir);
  }
}
const countFilesUnder = (dir) => allFiles.filter((file) => file.startsWith(`${dir}/`)).length;
const packageInfo = new Map();
for (const dir of dirSet) {
  if (!/^packages\/[^/]+\/[^/]+$/u.test(dir)) continue;
  const manifestPath = join(ROOT, dir, "package.json");
  if (!existsSync(manifestPath)) continue;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8").replace(/^\uFEFF/u, ""));
    packageInfo.set(dir, manifest.name ?? dir.split("/").pop());
  } catch {
    // 清单损坏由 check-workspace 报错，这里只跳过标注。
  }
}
const renderTree = (dir, prefix) => {
  const children = [...dirSet].filter((child) => child !== "." && dirname(child) === dir).sort();
  children.forEach((child, index) => {
    const last = index === children.length - 1;
    const label = `${child.split("/").pop()}/`;
    const name = packageInfo.get(child);
    lines.push(`${prefix}${last ? "└── " : "├── "}${label}${name ? `  # ${name}` : ""}  (${countFilesUnder(child)} 个文件)`);
    renderTree(child, `${prefix}${last ? "    " : "│   "}`);
  });
};
renderTree(".", "");
for (const file of allFiles.filter((item) => !item.includes("/"))) lines.push(`# ${file}`);
lines.push("```", "");

lines.push("### 2.2 包清单", "");
lines.push("| 分组 | 包名 | 路径 | 职责 |", "| --- | --- | --- | --- |");
const packageRows = [...packageInfo.keys()].sort().map((dir) => {
  const manifest = JSON.parse(readFileSync(join(ROOT, dir, "package.json"), "utf8").replace(/^\uFEFF/u, ""));
  return {
    group: dir.split("/")[1],
    name: manifest.name ?? dir,
    dir,
    description: (manifest.description ?? "").replace(/\|/gu, "\\|"),
  };
});
for (const row of packageRows) {
  lines.push(`| ${row.group} | \`${row.name}\` | \`${row.dir}\` | ${row.description} |`);
}
lines.push("");
lines.push("## 3. 文件清单", "");
lines.push("每条为「文件 — 首行职责注释」。没有首行注释的文件只列文件名，语义由路径承担。", "");
for (const [dir, files] of groupByDirectory(detailedOnly)) {
  lines.push(`### ${dir || "."}`, "");
  for (const file of files) {
    const description = describe(file);
    lines.push(description ? `- \`${file.split("/").pop()}\` — ${description}` : `- \`${file.split("/").pop()}\``);
  }
  lines.push("");
}
lines.push("## 4. 只做统计的目录", "");
lines.push("| 目录 | 文件数 | 子目录数 | 说明 |", "| --- | --- | --- | --- |");
const summaryNotes = {
  "docs/dev-log": "按每 200 条任务编号汇总的开发日志卷",
  "docs/updata-log": "面向用户的单条更新说明",
  "vendor": "内嵌的上游运行时源码",
};
for (const item of summaries) {
  lines.push(`| \`${item.dir}\` | ${item.files.length} | ${item.directories} | ${summaryNotes[item.dir] ?? ""} |`);
}
lines.push("");

const output = `${lines.join("\n").replace(/\n+$/u, "")}\n`;
const current = existsSync(TARGET) ? readFileSync(TARGET, "utf8") : "";
if (CHECK) {
  if (current !== output) {
    console.error("✖ 仓库目录说明书与当前骨架不一致：请运行 `pnpm map:sync` 并提交 docs/architecture/repository-map.md");
    process.exit(1);
  }
  console.log(`✔ 仓库目录说明书与骨架一致（${allFiles.length} 个文件）`);
} else {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(TARGET, output, "utf8");
  console.log(`✔ 已写入 docs/architecture/repository-map.md（${allFiles.length} 个文件、${detailedOnly.length} 条明细）`);
}