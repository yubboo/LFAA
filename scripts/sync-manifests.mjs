// 包清单生成器：按 DSH 模型写入 main/types/exports、files、repository 与 publishConfig。
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.argv[2] ?? process.cwd();
const PKG_ROOT = join(ROOT, "packages");
const REPO_URL = "git+https://github.com/yubboo/LFAA.git";

function discover() {
  const out = [];
  for (const group of readdirSync(PKG_ROOT)) {
    const groupDir = join(PKG_ROOT, group);
    if (!statSync(groupDir).isDirectory()) continue;
    if (existsSync(join(groupDir, "package.json"))) {
      out.push(groupDir);
      continue;
    }
    for (const child of readdirSync(groupDir)) {
      const childDir = join(groupDir, child);
      if (existsSync(join(childDir, "package.json"))) out.push(childDir);
    }
  }
  return out;
}

const report = [];

for (const pkgDir of discover()) {
  const file = join(pkgDir, "package.json");
  const raw = readFileSync(file, "utf8");
  const hadBom = raw.startsWith("\uFEFF");
  const manifest = JSON.parse(raw.replace(/^\uFEFF/u, ""));
  const relDir = relative(ROOT, pkgDir).split(sep).join("/");

  const hasContract = existsSync(join(pkgDir, "contract", "index.ts"));
  const hasClient = existsSync(join(pkgDir, "client"));
  const hasArkPlan = existsSync(join(pkgDir, "src", "ark-plan.ts"));
  // 带 contract 的包 rootDir 上提到包根，主入口因此落在 lib/types/src 下。
  const typesBase = hasContract ? "lib/types/src" : "lib/types";

  const exportsField = {
    ".": {
      types: `./${typesBase}/index.d.ts`,
      default: "./lib/index.js",
    },
  };
  if (hasContract) {
    exportsField["./contract"] = {
      types: "./lib/types/contract/index.d.ts",
      default: "./lib/types/contract/index.js",
    };
  }
  if (hasArkPlan) {
    exportsField["./ark-plan"] = {
      types: "./lib/types/ark-plan.d.ts",
      default: "./lib/ark-plan.js",
    };
  }
  // 源码逃生口：仅供本仓工具链、测试与热重载使用，运行时不走这条。
  exportsField["./src/*"] = "./src/*";
  if (hasClient) exportsField["./client"] = "./client/index.tsx";
  exportsField["./package.json"] = "./package.json";

  const files = ["lib"];
  if (existsSync(join(pkgDir, "src"))) files.push("src");
  if (hasClient) files.push("client");
  if (hasContract) files.push("contract");

  const next = {
    ...manifest,
    type: "module",
    main: "./lib/index.js",
    types: `./${typesBase}/index.d.ts`,
    exports: exportsField,
    files,
    publishConfig: { access: "public" },
    repository: { type: "git", url: REPO_URL, directory: relDir },
    scripts: { typecheck: "tsc -b ." },
  };
  delete next.private;

  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  report.push(`${manifest.name}  →  ${typesBase}/index.d.ts + lib/index.js`);
}

console.log(report.join("\n"));
console.log(`\n共 ${report.length} 个包已写入清单。`);
