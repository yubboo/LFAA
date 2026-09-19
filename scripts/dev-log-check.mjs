/**
 * 文件：dev-log-check.mjs
 * 作用：检查单文件 Development Log 的编号历史、当前任务和状态字段。
 * 负责：docs/DEVELOPMENT_LOG.md 的主编号可追溯性、#20.9 当前治理任务、禁止旧 active/archive 日志目录回归。
 * 不负责：判断业务结论正确性、Runtime Log、用户是否真的完成验收。
 * 状态归属：无运行时状态；直接读取当前工作树。
 * 对外接口：`node scripts/dev-log-check.mjs`。
 * 关联文件：docs/DEVELOPMENT_LOG.md、docs/PROMPTS.md、DEVELOPMENT.md。
 * 修改注意事项：日志继续在一个文件内追加；不要恢复“一条日志一个 Markdown”。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = path.join(root, "docs", "DEVELOPMENT_LOG.md");
const fail = (message) => {
  console.error(`LFAA development log check failed: ${message}`);
  process.exit(1);
};
if (!fs.existsSync(file)) fail("missing docs/DEVELOPMENT_LOG.md");
const text = fs.readFileSync(file, "utf8");

for (let n = 1; n <= 21; n += 1) {
  const re = new RegExp(`(^|[^0-9])#${n}(?:\\.|\\s|\\b)`, "m");
  if (!re.test(text)) fail(`historical main task #${n} is not traceable in DEVELOPMENT_LOG.md`);
}
for (const token of ["#20.9", "依赖提示去重与路径可见性"]) {
  if (!text.includes(token)) fail(`current governance task missing token: ${token}`);
}
for (const token of ["#20.8", "按需依赖增量检测与复用"]) {
  if (!text.includes(token)) fail(`historical governance task missing token: ${token}`);
}
for (const token of ["#20.7", "Setup 菜单与发布门禁解耦"]) {
  if (!text.includes(token)) fail(`historical governance task missing token: ${token}`);
}
for (const token of ["#20.6", "发布环境与质量门禁闭环"]) {
  if (!text.includes(token)) fail(`historical governance task missing token: ${token}`);
}
for (const token of ["#20.5", "文档体系单文件时间线重构"]) {
  if (!text.includes(token)) fail(`historical documentation task missing token: ${token}`);
}
if (fs.existsSync(path.join(root, "docs", "logs", "development"))) {
  fail("legacy docs/logs/development directory must not return");
}
console.log("LFAA single-file development log check passed.");
