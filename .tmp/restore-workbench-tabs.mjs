// 一次性恢复脚本：WorkbenchTabs.tsx 被误做 c→o 全局替换（PowerShell 字符串下标误用）。
// 恢复思路：HEAD 版本的同一行（c→o 归一化后相同）直接取回原文；WIP 改动的行按 HEAD 前缀 + 后缀重建；
// 其余行输出待人工确认。
import { readFileSync, writeFileSync } from "node:fs";

const corrupted = readFileSync("E:/lfaa/packages/client/ui-chat/client/workbench/WorkbenchTabs.tsx", "utf8").split(/\r?\n/u);
const head = readFileSync("E:/lfaa/.tmp/wt-head.tsx", "utf8").replace(/^\uFEFF/u, "").split(/\r?\n/u);
const norm = (line) => line.replaceAll("c", "o");

const byNorm = new Map();
for (const line of head) {
  if (!byNorm.has(norm(line))) byNorm.set(norm(line), []);
  byNorm.get(norm(line)).push(line);
}
// 用于前缀匹配：HEAD 行（归一化）→ 原文，按长度倒序便于取最长前缀。
const headNorm = head.map((line) => ({ raw: line, n: norm(line) })).sort((a, b) => b.n.length - a.n.length);

const out = [];
const unresolved = [];
corrupted.forEach((line, index) => {
  const exact = byNorm.get(line);
  if (exact && exact.length > 0) {
    out.push(exact[0]);
    exact.shift();
    return;
  }
  // WIP 改动行：HEAD 里的整行是本行的前缀（归一化），补回后缀。
  const base = headNorm.find((item) => item.n.length > 0 && line.startsWith(item.n));
  if (base) {
    out.push(base.raw + line.slice(base.n.length));
    return;
  }
  // 空白行与纯新增行：先原样保留，稍后人工核对。
  if (line.trim() === "") {
    out.push("");
    return;
  }
  out.push(line);
  unresolved.push({ index: index + 1, line });
});

writeFileSync("E:/lfaa/.tmp/wt-restored.tsx", out.join("\n"));
console.log(`恢复 ${out.length} 行，待人工确认 ${unresolved.length} 行`);
for (const item of unresolved) console.log(`${item.index}\t${item.line}`);