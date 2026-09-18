/**
 * 文件：config-schema-check.mjs
 * 作用：对 Config Schema 基线执行无需第三方依赖的静态安全与结构门禁。
 * 负责：包存在、版本常量单一、credentialRef 边界、禁止 Secret 字段声明、公开入口与关键文件头。
 * 不负责：替代 TypeScript typecheck、运行时单元测试、Storage/Migration 测试或用户验收。
 * 状态归属：无运行时状态；直接读取 @lfaa/config-system 当前源码。
 * 对外接口：node scripts/config-schema-check.mjs。
 * 关联文件：packages/config-system/src/config-schema.ts、config-validator.ts、index.ts、package.json。
 * 修改注意事项：只能强化 Config Schema 硬边界，不得通过弱化正则让 Secret 明文字段通过。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const fail = (message) => {
  console.error(`LFAA config schema check failed: ${message}`);
  process.exit(1);
};
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const packagePath = "packages/config-system/package.json";
if (!fs.existsSync(path.join(root, packagePath))) fail("missing packages/config-system");
const pkg = JSON.parse(read(packagePath));
if (pkg.name !== "@lfaa/config-system" || pkg.author !== "二鱼") fail("package identity must be @lfaa/config-system / 二鱼");

const schema = read("packages/config-system/src/config-schema.ts");
const validator = read("packages/config-system/src/config-validator.ts");
const index = read("packages/config-system/src/index.ts");
const combined = `${schema}\n${validator}`;

const versionDeclarations = schema.match(/export const CONFIG_SCHEMA_VERSION\s*=\s*1\b/g) ?? [];
if (versionDeclarations.length !== 1) fail("CONFIG_SCHEMA_VERSION = 1 must have exactly one source declaration");
if (!schema.includes("credentialRef: string | null")) fail("Account schema must use credentialRef");
for (const forbidden of ["apiKey:", "api_key:", "accessToken:", "refreshToken:", "clientSecret:", "password:", "privateKey:"]) {
  if (combined.includes(forbidden)) fail(`plaintext Secret field declaration is forbidden: ${forbidden}`);
}
if (!validator.includes("assertNoSecretOrDangerousKeys")) fail("runtime Secret field rejection is required");
if (!index.includes('export * from "./config-schema.ts"') || !index.includes('export * from "./config-validator.ts"')) {
  fail("public API must export schema and validator from src/index.ts");
}
for (const [relative, text] of [
  ["config-schema.ts", schema],
  ["config-validator.ts", validator],
  ["index.ts", index],
]) {
  for (const field of ["文件：", "作用：", "负责：", "不负责：", "状态归属：", "对外接口：", "关联文件：", "修改注意事项："]) {
    if (!text.slice(0, 3000).includes(field)) fail(`${relative} missing header field ${field}`);
  }
}
console.log("LFAA config schema check passed (Schema v1).");
