// 日志体检：dev-log 卷内标题编号与 updata-log 文件名编号必须各自唯一；同一轮两类日志共用编号是允许的。
// 另含调研门禁（§1.1）：自 DEV-000541 起，每条 dev-log 必须含「## 调研与参考」，并给出外链或明确写「无外部参考」及原因。
// 历史重号登记在 scripts/log-number-baseline.json，只减不增：修好一处就删一条，新增重号直接判错。
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// --root <dir> 便于用临时夹具验证规则本身，与 check-workspace 保持一致。
const rootArgIndex = process.argv.indexOf("--root");
const ROOT = rootArgIndex >= 0 && process.argv[rootArgIndex + 1] ? resolve(process.argv[rootArgIndex + 1]) : DEFAULT_ROOT;
const BASELINE = join(ROOT, "scripts", "log-number-baseline.json");
const DEV_LOG_DIR = join(ROOT, "docs", "dev-log");
const UPDATE_LOG_DIR = join(ROOT, "docs", "updata-log");

/** 统计一组编号里出现多次的项。 */
function duplicatesOf(numbers) {
  const counts = new Map();
  for (const number of numbers) counts.set(number, (counts.get(number) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([number]) => number).sort();
}

/** 读取一卷 dev-log 里的 `# DEV-000001` 标题编号。 */
function readDevLogEntries() {
  const entries = [];
  for (const name of readdirSync(DEV_LOG_DIR)) {
    if (!/^\d{6}-\d{6}\.md$/u.test(name)) continue;
    const text = readFileSync(join(DEV_LOG_DIR, name), "utf8");
    const headings = [...text.matchAll(/^#\s*DEV-(\d{6})/gmu)];
    for (const [index, heading] of headings.entries()) {
      const end = headings[index + 1]?.index ?? text.length;
      entries.push({ file: name, number: heading[1], body: text.slice(heading.index, end) });
    }
  }
  return entries;
}

/** 调研段落门禁的生效编号：之前的条目属于历史记录，不追溯补写。 */
const RESEARCH_SECTION_FROM = 541;

/** 检查一条 dev-log 是否满足调研门禁，返回问题描述；通过时返回 null。 */
function researchIssue(entry) {
  // 代码块里的模板或示例不算数：先剥掉围栏代码块，避免把模板粘进日志就蒙混过关。
  const body = entry.body.replace(/^```[\s\S]*?^```/gmu, "");
  const heading = /^##\s*调研与参考[^\n]*$/mu.exec(body);
  if (!heading) return "缺少「## 调研与参考」段落";
  const rest = body.slice(heading.index + heading[0].length);
  const nextHeading = /^#{1,2}\s/mu.exec(rest);
  const content = nextHeading ? rest.slice(0, nextHeading.index) : rest;
  if (/https?:\/\/\S+/u.test(content)) return null;
  if (/无外部参考/u.test(content)) return null;
  return "「## 调研与参考」既没有来源链接，也没有写「无外部参考」及原因";
}

/** 读取 updata-log 文件名前缀编号（每轮一条）。 */
function readUpdateLogNumbers() {
  return readdirSync(UPDATE_LOG_DIR)
    .map((name) => /^(\d{6})-/u.exec(name)?.[1])
    .filter(Boolean);
}

function loadBaseline() {
  if (!existsSync(BASELINE)) return { devLog: [], updataLog: [] };
  const parsed = JSON.parse(readFileSync(BASELINE, "utf8"));
  return { devLog: parsed.devLog ?? [], updataLog: parsed.updataLog ?? [] };
}

const baseline = loadBaseline();
const devLogEntries = readDevLogEntries();
const groups = [
  { label: "dev-log 标题编号", key: "devLog", duplicates: duplicatesOf(devLogEntries.map((entry) => entry.number)) },
  { label: "updata-log 文件名编号", key: "updataLog", duplicates: duplicatesOf(readUpdateLogNumbers()) },
];

let failed = false;
for (const group of groups) {
  const allowed = new Set(baseline[group.key] ?? []);
  const fresh = group.duplicates.filter((number) => !allowed.has(number));
  const stale = [...allowed].filter((number) => !group.duplicates.includes(number));
  const matched = group.duplicates.filter((number) => allowed.has(number)).length;
  const summary = `${group.label}：${group.duplicates.length} 组重号（已登记 ${matched} 组，基线 ${allowed.size} 组）`;
  if (fresh.length > 0) {
    failed = true;
    console.error(`✖ ${summary}；新增重号：${fresh.join("、")}`);
  } else {
    console.log(`✔ ${summary}`);
  }
  if (stale.length > 0) {
    console.warn(`⚠ ${group.key} 基线里 ${stale.join("、")} 已不再是重号，请从 scripts/log-number-baseline.json 删除`);
  }
}

// 调研门禁（§1.1）：只查生效编号之后的条目，历史条目保持原样。
const researchFailures = devLogEntries
  .filter((entry) => Number(entry.number) >= RESEARCH_SECTION_FROM)
  .map((entry) => ({ entry, issue: researchIssue(entry) }))
  .filter((item) => item.issue);

if (researchFailures.length > 0) {
  failed = true;
  for (const { entry, issue } of researchFailures) {
    console.error(`✖ ${entry.file} DEV-${entry.number}：${issue}`);
  }
  console.error("按 AGENTS.md §0 与开发规范 §1.1，先调研再动手；确实没有外部参考时写明「无外部参考」及原因。");
} else {
  console.log(`✔ dev-log 调研段落：DEV-${String(RESEARCH_SECTION_FROM).padStart(6, "0")} 起全部合规`);
}

if (failed) {
  console.error("日志检查未通过：编号必须六位全局递增（同类日志内不得重号），且生效编号后的 dev-log 必须含合规的调研段落。");
  process.exit(1);
}