// 一次性盘点：列出所有快捷键默认键位、所在文件与分组，检查内部重复。
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = "E:/lfaa/packages";
const found = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "lib" || entry === "dist") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) { walk(full); continue; }
    if (!/\.(ts|tsx)$/u.test(entry) || /\.test\./u.test(entry)) continue;
    const text = readFileSync(full, "utf8");
    const idRe = /id:\s*"([^"]+)"/gu;
    const ids = [...text.matchAll(idRe)];
    const keyRe = /defaultKeys:\s*"([^"]+)"/gu;
    const keys = [...text.matchAll(keyRe)];
    if (keys.length === 0) continue;
    for (const k of keys) {
      const before = text.slice(0, k.index);
      const idMatch = [...before.matchAll(idRe)].at(-1);
      found.push({ key: k[1], id: idMatch?.[1] ?? "?", file: full.replace("E:/lfaa/", "") });
    }
  }
}
walk(root);
found.sort((a, b) => a.key.localeCompare(b.key));
const byKey = new Map();
for (const item of found) {
  if (!byKey.has(item.key)) byKey.set(item.key, []);
  byKey.get(item.key).push(item);
}
for (const [key, items] of byKey) {
  const dup = items.length > 1 ? "  <== 重复" : "";
  console.log(`${key}\t${items.map((i) => i.id).join(" / ")}${dup}`);
}
console.log(`\n合计 ${found.length} 个动作，${byKey.size} 个不同键位`);