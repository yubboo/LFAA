// 仓库构建配置生成器：按 DSH 模型生成 tsconfig.base.json 的 paths 门面、每包 tsconfig 与 host 聚合工程。
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.argv[2] ?? process.cwd();
const PKG_ROOT = join(ROOT, "packages");
const VENDOR_ROOT = join(ROOT, "vendor");

/** 枚举真实包目录与清单。 */
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
  if (existsSync(VENDOR_ROOT)) {
    for (const child of readdirSync(VENDOR_ROOT)) {
      const childDir = join(VENDOR_ROOT, child);
      if (statSync(childDir).isDirectory() && existsSync(join(childDir, "package.json"))) out.push(childDir);
    }
  }
  return out.map((dir) => {
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8").replace(/^\uFEFF/u, ""));
    const relDir = relative(ROOT, dir).split(sep).join("/");
    const hasContract = existsSync(join(dir, "contract", "index.ts"));
    const deps = Object.keys(manifest.dependencies ?? {});
    return { dir, relDir, manifest, hasContract, deps };
  });
}

const packages = discover();
const byName = new Map(packages.map((pkg) => [pkg.manifest.name, pkg]));

// 1) 生成 paths 门面：@lfaa/<name> → packages/<group>/<pkg>/src
//    只映射本仓 packages；vendor 是上游包，必须走它自己的 exports（产物而非源码）。
const pathLines = packages
  .filter((pkg) => !pkg.relDir.startsWith("vendor/"))
  .slice()
  .sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))
  .map((pkg) => {
    const base = `./${pkg.relDir}`;
    const lines = [`      "${pkg.manifest.name}": ["${base}/src"]`];
    if (pkg.hasContract) lines.push(`      "${pkg.manifest.name}/contract": ["${base}/contract/index.ts"]`);
    if (existsSync(join(pkg.dir, "src", "ark-plan.ts"))) {
      lines.push(`      "${pkg.manifest.name}/ark-plan": ["${base}/src/ark-plan.ts"]`);
    }
    if (existsSync(join(pkg.dir, "src", "token-plan.ts"))) {
      lines.push(`      "${pkg.manifest.name}/token-plan": ["${base}/src/token-plan.ts"]`);
    }
    // client 子路径供 Vite/测试解析到源码；不进入对外 exports。
    lines.push(`      "${pkg.manifest.name}/client": ["${base}/client"]`);
    return lines.join(",\n");
  })
  .join(",\n");

const baseConfig = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "incremental": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": false,
    "allowImportingTsExtensions": true,
    "rewriteRelativeImportExtensions": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "paths": {
${pathLines}
    }
  }
}
`;
writeFileSync(join(ROOT, "tsconfig.base.json"), baseConfig, "utf8");

// 2) 兼容壳：原有 apps 仍 extends 根 tsconfig.json
writeFileSync(
  join(ROOT, "tsconfig.json"),
  `{
  "extends": "./tsconfig.base.json",
  "files": []
}
`,
  "utf8",
);

/**
 * 找出 `src` 下自带 `package.json` 的独立工程目录。
 * 内置技能里随包分发的第三方工程（如 stageshow）自带依赖与构建脚本，依赖不在 workspace 内，
 * 纳入 workspace 类型检查只会把「找不到 vite/lucide-react」之类的跨工程错误当成本仓错误。
 */
function findNestedProjects(pkgDir) {
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 6) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "node_modules") continue;
      const full = join(dir, entry.name);
      if (existsSync(join(full, "package.json"))) {
        found.push(relative(pkgDir, full).split(sep).join("/"));
        continue;
      }
      walk(full, depth + 1);
    }
  };
  const srcDir = join(pkgDir, "src");
  if (existsSync(srcDir)) walk(srcDir, 0);
  return found;
}

// 3) 每包 tsconfig：rootDir src → outDir lib/types，references 对应 workspace 依赖
//    带 contract 的包把 rootDir 上提到包根，契约才能编译进 lib/types/contract。
for (const pkg of packages) {
  const include = ['"src"'];
  if (pkg.hasContract) include.push('"contract"');
  const nested = findNestedProjects(pkg.dir);
  const excludeBlock = nested.length > 0
    ? `,\n  "exclude": [${nested.map((dir) => `"${dir}"`).join(", ")}]`
    : "";
  const references = pkg.deps
    .map((name) => byName.get(name))
    .filter(Boolean)
    .map((dep) => `    { "path": "${relative(pkg.dir, dep.dir).split(sep).join("/")}" }`);
  const refBlock = references.length > 0
    ? `,\n  "references": [\n${references.join(",\n")}\n  ]`
    : "";
  // vendor 下是上游源码，保持其原有宽松度，避免为了过类型检查而改写上游实现。
  const isVendor = pkg.relDir.startsWith("vendor/");
  const strictBlock = isVendor
    ? `    "strict": false,
    "noImplicitAny": false,
    "noUncheckedIndexedAccess": false,
    "exactOptionalPropertyTypes": false,
    "noImplicitOverride": false,
    "isolatedModules": false,
`
    : "";
  writeFileSync(
    join(pkg.dir, "tsconfig.json"),
    `{
  "extends": "${relative(pkg.dir, join(ROOT, "tsconfig.base.json")).split(sep).join("/")}",
  "compilerOptions": {
    "rootDir": "${pkg.hasContract ? "." : "src"}",
    "outDir": "lib/types",
    "types": ["node"]${isVendor ? "," : ""}
${strictBlock}  },
  "include": [${include.join(", ")}]${excludeBlock}${refBlock}
}
`,
    "utf8",
  );
}


// 3.1) 清理旧的双面工程：客户端与测试统一由 host 聚合工程检查
for (const pkg of packages) {
  const legacy = join(pkg.dir, "tsconfig.client.json");
  if (existsSync(legacy)) rmSync(legacy, { force: true });
}

// 4) 聚合工程：引用全部包工程，并纳入测试与客户端源码做类型检查（noEmit，不产物）
const hostReferences = packages
  .slice()
  .sort((a, b) => a.relDir.localeCompare(b.relDir))
  .map((pkg) => `    { "path": "./${pkg.relDir}" }`)
  .join(",\n");

writeFileSync(
  join(ROOT, "tsconfig.host.json"),
  `{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "types": ["node", "react", "react-dom"]
  },
  "include": [
    "packages/*/*/tests/**/*.ts",
    "packages/*/*/tests/**/*.tsx",
    "packages/*/*/client/**/*.ts",
    "packages/*/*/client/**/*.tsx"
  ],
  "references": [
${hostReferences}
  ]
}
`,
  "utf8",
);

const clientDir = join(ROOT, "tsconfig.client.json");
if (existsSync(clientDir)) rmSync(clientDir, { force: true });

console.log(
  `已生成 tsconfig.base.json、tsconfig.json、tsconfig.host.json 与 ${packages.length} 个包的 tsconfig`,
);





