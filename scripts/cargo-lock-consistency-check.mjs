/**
 * 文件：cargo-lock-consistency-check.mjs
 * 作用：静态校验 Cargo workspace member 与 Cargo.lock 的 name/version 一致性，避免发布包携带过期锁文件。
 * 负责：读取 root Cargo.toml workspace members、各 member Cargo.toml package name/version、Cargo.lock package entries。
 * 不负责：联网解析 crates.io、生成/修改 Cargo.lock、替代 cargo --locked 的完整依赖解析。
 * 状态归属：无状态；Cargo.toml/Cargo.lock 是唯一事实源。
 * 对外接口：validateCargoLockConsistency(root)；CLI `node scripts/cargo-lock-consistency-check.mjs`。
 * 关联文件：Cargo.toml、Cargo.lock、scripts/windows/lfaa-setup.ps1、scripts/release-rust-check.mjs。
 * 修改注意事项：本 Gate 只能拒绝漂移，不能为了“通过”自动改写正式锁文件。
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function readText(root, relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function parseWorkspaceMembers(source) {
  const workspaceStart = source.search(/^\s*\[workspace\]\s*$/m);
  if (workspaceStart < 0) return [];
  const tail = source.slice(workspaceStart);
  const nextSection = tail.slice(1).search(/^\s*\[[^\]]+\]\s*$/m);
  const workspace = nextSection >= 0 ? tail.slice(0, nextSection + 1) : tail;
  const match = workspace.match(/\bmembers\s*=\s*\[([\s\S]*?)\]/m);
  if (!match) return [];
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1].trim()).filter(Boolean);
}

function parsePackageIdentity(source, relative) {
  const packageStart = source.search(/^\s*\[package\]\s*$/m);
  if (packageStart < 0) throw new Error(`${relative} 缺少 [package]`);
  const tail = source.slice(packageStart);
  const nextSection = tail.slice(1).search(/^\s*\[[^\]]+\]\s*$/m);
  const section = nextSection >= 0 ? tail.slice(0, nextSection + 1) : tail;
  const name = section.match(/^\s*name\s*=\s*["']([^"']+)["']\s*$/m)?.[1]?.trim();
  const version = section.match(/^\s*version\s*=\s*["']([^"']+)["']\s*$/m)?.[1]?.trim();
  if (!name || !version) throw new Error(`${relative} 缺少 package name/version`);
  return { name, version };
}

function parseLockPackages(source) {
  const packages = [];
  for (const block of source.split(/^\s*\[\[package\]\]\s*$/m).slice(1)) {
    const name = block.match(/^\s*name\s*=\s*"([^"]+)"\s*$/m)?.[1]?.trim();
    const version = block.match(/^\s*version\s*=\s*"([^"]+)"\s*$/m)?.[1]?.trim();
    if (name && version) packages.push({ name, version });
  }
  return packages;
}

export function validateCargoLockConsistency(root = process.cwd()) {
  const cargoTomlPath = path.join(root, "Cargo.toml");
  if (!fs.existsSync(cargoTomlPath)) return { members: [] };

  const members = parseWorkspaceMembers(readText(root, "Cargo.toml"));
  if (members.length === 0) return { members: [] };

  const lockPath = path.join(root, "Cargo.lock");
  if (!fs.existsSync(lockPath)) throw new Error("Cargo workspace 存在 member，但仓库缺少 Cargo.lock");
  const lockPackages = parseLockPackages(readText(root, "Cargo.lock"));

  const identities = members.map((member) => {
    const relative = `${member.replaceAll("\\", "/")}/Cargo.toml`;
    const absolute = path.join(root, member, "Cargo.toml");
    if (!fs.existsSync(absolute)) throw new Error(`Cargo workspace member 缺少 manifest：${relative}`);
    return { member, ...parsePackageIdentity(fs.readFileSync(absolute, "utf8"), relative) };
  });

  for (const identity of identities) {
    const exact = lockPackages.some((entry) => entry.name === identity.name && entry.version === identity.version);
    if (exact) continue;
    const versions = lockPackages.filter((entry) => entry.name === identity.name).map((entry) => entry.version);
    const found = versions.length > 0 ? versions.join(", ") : "<missing>";
    throw new Error(
      `Cargo.lock workspace member 漂移：${identity.member} 声明 ${identity.name} ${identity.version}，锁文件为 ${found}`,
    );
  }

  return { members: identities };
}

function runCli() {
  const result = validateCargoLockConsistency(process.cwd());
  console.log(`LFAA Cargo lock consistency check passed (${result.members.length} workspace member(s)).`);
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entry) {
  try {
    runCli();
  } catch (error) {
    console.error(`LFAA Cargo lock consistency check failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
