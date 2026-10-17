/**
 * 功能：把旧版 data/plugins 中的 Profile 插件包和受控运行适配副本安全复制到 LFAA_HOME/plugins。
 * 作用：兼容升级时保持源目录不变，只在目标不存在时原子登记；内容冲突会停止启动并给出可恢复错误。
 * 关联文件：index.ts、dsh-wallpaper-engine-runtime.ts、launch-environment 的 homeDirectory/pluginInstallDirectory。
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { cp, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

interface Entry { path: string; type: "directory" | "file"; size: number; digest?: string }

async function manifest(root: string): Promise<Entry[]> {
  const entries: Entry[] = [];
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop()!;
    for (const name of await readdir(directory)) {
      const file = resolve(directory, name);
      const info = await lstat(file);
      if (info.isSymbolicLink() || !info.isDirectory() && !info.isFile()) throw new Error("旧插件安装目录包含链接或特殊文件；为避免越界读取，自动迁移已停止。");
      const path = relative(root, file).split(sep).join("/");
      if (info.isDirectory()) {
        entries.push({ path, type: "directory", size: 0 });
        pending.push(file);
      } else {
        if (entries.length >= 200_000) throw new Error("旧插件安装目录文件数超过安全上限；请检查后手动迁移。");
        const hash = createHash("sha256");
        for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer);
        entries.push({ path, type: "file", size: info.size, digest: hash.digest("hex") });
      }
    }
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path, "en"));
}

async function existsDirectory(path: string): Promise<boolean> {
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("插件安装路径不是普通目录；未覆盖任何文件。");
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

/** Copy one known old Profile subtree. Existing destination is accepted only when byte-for-byte identical. */
async function preserveLegacyTree(source: string, target: string, profile: string, kind: "profile" | "runtime-adapter"): Promise<void> {
  if (resolve(source) === resolve(target) || !await existsDirectory(source)) return;
  const markerName = ".lfaa-legacy-migration.json";
  if (await existsDirectory(target)) {
    try {
      const marker = JSON.parse(await readFile(resolve(target, markerName), "utf8")) as Record<string, unknown>;
      if (marker.version === 1 && marker.profile === profile && marker.kind === kind) return;
      throw new Error("旧插件目录迁移标记无效；为避免覆盖，插件加载已停止。");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const sourceManifest = await manifest(source);
  if (await existsDirectory(target)) {
    const targetManifest = await manifest(target);
    if (JSON.stringify(sourceManifest) !== JSON.stringify(targetManifest)) {
      throw new Error(`新旧插件安装位置内容不一致：${target}。为避免覆盖任一版本，请先人工核对两个目录。`);
    }
    await writeFile(resolve(target, markerName), `${JSON.stringify({ version: 1, profile, kind, migratedAt: new Date().toISOString() })}\n`, { flag: "wx", mode: 0o600 });
    return;
  }

  await mkdir(dirname(target), { recursive: true });
  const staging = resolve(dirname(target), `.legacy-${randomUUID()}`);
  try {
    await cp(source, staging, { recursive: true, force: false, errorOnExist: true, preserveTimestamps: true });
    if (JSON.stringify(sourceManifest) !== JSON.stringify(await manifest(staging))) {
      throw new Error("旧插件文件副本校验不一致；旧目录保留且没有切换安装位置。");
    }
    await writeFile(resolve(staging, markerName), `${JSON.stringify({ version: 1, profile, kind, migratedAt: new Date().toISOString() })}\n`, { flag: "wx", mode: 0o600 });
    if (await existsDirectory(target)) throw new Error("插件安装目录迁移期间目标已被创建；没有覆盖现有内容。");
    await rename(staging, target);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

export async function migrateLegacyPluginStorage(dataDirectory: string, pluginInstallDirectory: string, profile: string): Promise<void> {
  if (!/^[a-z][a-z0-9-]{0,63}$/u.test(profile)) throw new Error("当前 Profile 名称无效。");
  const legacyRoot = resolve(dataDirectory, "plugins");
  const installRoot = resolve(pluginInstallDirectory);
  const legacyProfile = resolve(legacyRoot, "profiles", profile);
  const installedProfile = resolve(installRoot, "profiles", profile);
  await preserveLegacyTree(legacyProfile, installedProfile, profile, "profile");
  await preserveLegacyTree(
    resolve(legacyRoot, "runtime-adapters", "profiles", profile),
    resolve(installRoot, "runtime-adapters", "profiles", profile), profile, "runtime-adapter"
  );
}
