// 日志编号体检：dev-log 卷内标题编号与 updata-log 文件名编号必须各自唯一；同一轮两类日志共用编号是允许的。
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
function readDevLogNumbers() {
  const numbers = [];
  for (const name of readdirSync(DEV_LOG_DIR)) {
    if (!/^\d{6}-\d{6}\.md$/u.test(name)) continue;
    const text = readFileSync(join(DEV_LOG_DIR, name), "utf8");
    for (const match of text.matchAll(/^#\s*DEV-(\d{6})/gmu)) numbers.push(match[1]);
  }
  return numbers;
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
const groups = [
  { label: "dev-log 标题编号", key: "devLog", duplicates: duplicatesOf(readDevLogNumbers()) },
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

if (failed) {
  console.error("日志编号必须六位全局递增；同一轮 dev-log 与 updata-log 共用编号，但同类日志内不得重号。");
  process.exit(1);
}