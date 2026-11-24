// 仓库级 Lint：用仓库已有的 TypeScript 编译器 API 做 AST 规则检查（无需联网安装 linter）。
// 只覆盖高信号、低误报的规则；规则与既有豁免由 scripts/lint-allowlist.json 管理，只减不增。
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import ts from "typescript";

const rootFlag = process.argv.indexOf("--root");
const ROOT = rootFlag === -1
  ? resolve(import.meta.dirname, "..")
  : resolve(process.argv[rootFlag + 1] ?? ".");
const PACKAGES_DIR = join(ROOT, "packages");
const APPS_DIR = join(ROOT, "apps");

const findings = [];
const ALLOWLIST_PATH = join(ROOT, "scripts", "lint-allowlist.json");
const ALLOWLIST_RULES = [
  "no-unused-import",
  "no-explicit-any",
  "no-console-log",
  "no-debugger",
  "loose-equality",
  "empty-catch",
  "ts-ignore",
  "ts-expect-error-description",
];
const allowlist = new Map(ALLOWLIST_RULES.map((rule) => [rule, new Set()]));
const usedAllowlist = new Set();

/** 记录一条违规；`file` 统一转成仓库相对的 posix 路径。 */
function report(rule, file, line, message) {
  findings.push({ rule, file: relative(ROOT, file).split(sep).join("/"), line, message });
}

/** 读取豁免清单；缺失时按空清单处理，便于夹具直接跑规则。 */
function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return;
  let raw;
  try {
    raw = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8").replace(/^\uFEFF/u, ""));
  } catch (error) {
    report("allowlist", ALLOWLIST_PATH, 0, `清单不是合法 JSON：${error.message}`);
    return;
  }
  for (const [rule, entries] of Object.entries(raw)) {
    if (rule.startsWith("$")) continue;
    const target = allowlist.get(rule);
    if (!target) {
      report("allowlist", ALLOWLIST_PATH, 0, `未登记的规则名「${rule}」；可用规则：${ALLOWLIST_RULES.join(" / ")}`);
      continue;
    }
    const list = Array.isArray(entries) ? entries : Array.isArray(entries?.files) ? entries.files : [];
    for (const entry of list) target.add(String(entry).split("\\").join("/"));
  }
}

/** 判断违规文件是否已登记豁免。 */
function isAllowed(rule, relPath) {
  const entries = allowlist.get(rule);
  if (!entries?.has(relPath)) return false;
  usedAllowlist.add(`${rule}\u0000${relPath}`);
  return true;
}

/** 汇总未命中的豁免条目：文件已修好或删除，提示同步删清单。 */
function reportStaleAllowlist() {
  for (const [rule, entries] of allowlist) {
    for (const entry of entries) {
      if (!usedAllowlist.has(`${rule}\u0000${entry}`)) {
        console.log(`⚠ [allowlist-stale] ${entry}: 豁免已不再违规（${rule}），请从 scripts/lint-allowlist.json 删除`);
      }
    }
  }
}

/** 递归枚举源文件，跳过依赖与构建产物目录。 */
function walk(dir, suffixes, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry === "lib" || entry === ".git" || entry === "builtin-skills") continue;
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, suffixes, out);
    else if (suffixes.some((suffix) => entry.endsWith(suffix))) out.push(full);
  }
  return out;
}

/** 收集需要检查的源文件：包的 src/client/contract 与 apps 的 src，不含测试。 */
function collectFiles() {
  const files = [];
  if (existsSync(PACKAGES_DIR)) {
    for (const group of readdirSync(PACKAGES_DIR)) {
      const groupDir = join(PACKAGES_DIR, group);
      if (!statSync(groupDir).isDirectory()) continue;
      const candidates = existsSync(join(groupDir, "package.json")) ? [groupDir] : readdirSync(groupDir).map((name) => join(groupDir, name));
      for (const pkgDir of candidates) {
        if (!existsSync(join(pkgDir, "package.json"))) continue;
        for (const role of ["src", "client", "contract"]) {
          const roleDir = join(pkgDir, role);
          if (!existsSync(roleDir)) continue;
          for (const file of walk(roleDir, [".ts", ".tsx"])) {
            if (file.includes(`${sep}tests${sep}`)) continue;
            files.push(file);
          }
        }
      }
    }
  }
  if (existsSync(APPS_DIR)) {
    for (const file of walk(APPS_DIR, [".ts", ".tsx"])) {
      if (file.includes(`${sep}tests${sep}`) || file.includes(`${sep}dist${sep}`)) continue;
      files.push(file);
    }
  }
  return files;
}

/** console 只允许 warn/error：log/debug 等属于调试残留。 */
const CONSOLE_METHODS = new Set(["log", "debug", "trace", "dir", "table", "group", "groupEnd"]);
const TS_DIRECTIVE = /@ts-(ignore|nocheck|expect-error)/u;

/** 单文件检查：一次 AST 遍历收集所有规则的命中。 */
function lintFile(file) {
  const text = readFileSync(file, "utf8").replace(/^\uFEFF/u, "");
  const scriptKind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, scriptKind);
  const relPath = relative(ROOT, file).split(sep).join("/");
  const allowed = (rule) => isAllowed(rule, relPath);

  // 1) 未使用导入：先收集导入绑定名与声明区间，再统计区间外的标识符引用。
  const importedNames = new Map();
  const importRanges = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
    importRanges.push([statement.pos, statement.end]);
    const clause = statement.importClause;
    if (clause.name) importedNames.set(clause.name.text, clause.name);
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) importedNames.set(element.name.text, element.name);
    } else if (bindings && ts.isNamespaceImport(bindings)) {
      importedNames.set(bindings.name.text, bindings.name);
    }
  }
  const usedNames = new Set();
  const withinImport = (position) => importRanges.some(([start, end]) => position >= start && position < end);
  const visit = (node) => {
    if (ts.isIdentifier(node) && !withinImport(node.getStart(sourceFile))) usedNames.add(node.text);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  const line = (node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

  if (!allowed("no-unused-import")) {
    for (const [name, node] of importedNames) {
      if (usedNames.has(name)) continue;
      report("no-unused-import", file, line(node), `导入的 \`${name}\` 未被使用`);
    }
  }

  const walkNodes = (node) => {
    // 2) 显式 any：禁止无解释的 any 类型。
    if (node.kind === ts.SyntaxKind.AnyKeyword && !allowed("no-explicit-any")) {
      report("no-explicit-any", file, line(node), "出现显式 `any`；改用具体类型或 unknown + 收窄");
    }
    // 3) debugger 残留。
    if (ts.isDebuggerStatement(node) && !allowed("no-debugger")) {
      report("no-debugger", file, line(node), "残留 debugger 语句");
    }
    // 4) console.log 等调试输出（warn/error 允许）。
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const target = node.expression;
      if (ts.isIdentifier(target.expression) && target.expression.text === "console" && CONSOLE_METHODS.has(target.name.text) && !allowed("no-console-log")) {
        report("no-console-log", file, line(node), `console.${target.name.text} 属于调试输出；改用结构化日志或 console.error/warn`);
      }
    }
    // 5) 宽松相等：null 比较是常见惯用法，放行。
    if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken || node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken) && !allowed("loose-equality")) {
      const comparesNull = node.left.kind === ts.SyntaxKind.NullKeyword || node.right.kind === ts.SyntaxKind.NullKeyword;
      if (!comparesNull) report("loose-equality", file, line(node), "使用 ==/!=；改用 ===/!==");
    }
    // 6) 空 catch：吞异常；带注释说明理由的不拦。
    if (ts.isCatchClause(node) && node.block.statements.length === 0 && !allowed("empty-catch")) {
      const body = text.slice(node.block.pos, node.block.end);
      if (!/\/\/|\/\*/u.test(body)) report("empty-catch", file, line(node), "空 catch 静默吞掉异常；至少记录原因");
    }
    ts.forEachChild(node, walkNodes);
  };
  walkNodes(sourceFile);

  // 7) TypeScript 抑制指令：只认注释内容以指令开头的情况（TS 本身也这样生效），
//    注释里“顺带提到”或字符串/正则里出现该文本都不算指令。
  const lines = text.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index] ?? "";
    const trimmedStart = current.trimStart();
    let contentStart = -1;
    if (current.includes("//")) {
      contentStart = current.indexOf("//") + 2;
    } else if (trimmedStart.startsWith("*") && !trimmedStart.startsWith("*/")) {
      // 块注释续行：`* @ts-ignore`。
      contentStart = current.indexOf("*") + 1;
    } else if (current.includes("/*")) {
      contentStart = current.indexOf("/*") + 2;
    }
    if (contentStart === -1) continue;
    const content = current.slice(contentStart).trim();
    const match = TS_DIRECTIVE.exec(content);
    if (!match || match.index !== 0) continue;
    const directive = match[0];
    if (directive === "@ts-ignore" || directive === "@ts-nocheck") {
      if (!allowed("ts-ignore")) report("ts-ignore", file, index + 1, `使用 ${directive}；修复类型问题而不是压制`);
      continue;
    }
    // @ts-expect-error 后面的说明文字不算空；只有光秃秃一条指令才算无解释。
    const rest = content.slice(directive.length).replace(/^[\s:：*-]+/u, "").trim();
    if (rest.length === 0 && !allowed("ts-expect-error-description")) {
      report("ts-expect-error-description", file, index + 1, "@ts-expect-error 缺少说明文字");
    }
  }
}

function main() {
  loadAllowlist();
  const files = collectFiles();
  for (const file of files) lintFile(file);
  reportStaleAllowlist();

  const byRule = new Map();
  for (const item of findings) byRule.set(item.rule, (byRule.get(item.rule) ?? 0) + 1);
  for (const item of findings) {
    console.log(item.line > 0 ? `✖ [${item.rule}] ${item.file}:${item.line}: ${item.message}` : `✖ [${item.rule}] ${item.file}: ${item.message}`);
  }
  const allowedNote = usedAllowlist.size > 0 ? `（其中 ${usedAllowlist.size} 项沿用既有豁免）` : "";
  const summary = [...byRule].map(([rule, count]) => `${rule}=${count}`).join(" ");
  console.log(`\nLint 检查 ${files.length} 个文件：${findings.length} 个问题${allowedNote}`);
  if (summary) console.log(`规则分布：${summary}`);
  process.exitCode = findings.length > 0 ? 1 : 0;
}

main();