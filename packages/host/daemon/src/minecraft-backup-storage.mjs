import { randomUUID } from "node:crypto";
import { lstat, mkdir, opendir, rename, rmdir } from "node:fs/promises";
import { resolve } from "node:path";

async function ensureDataDirectory(dataDirectory, relativePath) {
  const root = resolve(dataDirectory);
  const rootInfo = await lstat(root);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) throw new Error("LFAA Data 根目录不能是符号链接或非目录路径。");

  let current = root;
  for (const segment of relativePath.split(/[\\/]+/u).filter(Boolean)) {
    current = resolve(current, segment);
    try {
      await mkdir(current);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
    const info = await lstat(current);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("LFAA 游戏备份目录不能是符号链接或非目录路径。");
  }
  return current;
}

async function hasEntries(directory) {
  const handle = await opendir(directory);
  try {
    return Boolean(await handle.read());
  } finally {
    await handle.close();
  }
}

async function migrateLegacyMinecraftBackupDirectory(dataDirectory, minecraftBackupDirectory) {
  const gamesDirectory = resolve(dataDirectory, "games");
  const gamesInfo = await lstat(gamesDirectory);
  if (gamesInfo.isSymbolicLink() || !gamesInfo.isDirectory()) throw new Error("LFAA 游戏目录不能是符号链接或非目录路径。");

  const legacyDirectory = resolve(gamesDirectory, "minecraft-backups");
  let legacyInfo;
  try {
    legacyInfo = await lstat(legacyDirectory);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  if (legacyInfo.isSymbolicLink() || !legacyInfo.isDirectory()) throw new Error("遗留 Minecraft 备份路径不能是符号链接或非目录路径。");

  if (!(await hasEntries(legacyDirectory))) {
    await rmdir(legacyDirectory);
    return { kind: "removed-empty-legacy-directory" };
  }

  const targetDirectory = resolve(minecraftBackupDirectory, `legacy-games-minecraft-backups-${Date.now()}-${randomUUID()}`);
  try {
    await lstat(targetDirectory);
    throw new Error("Minecraft 遗留备份迁移目标已存在；原目录已保留。");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await rename(legacyDirectory, targetDirectory);
  return { kind: "moved-legacy-backup-directory", targetDirectory };
}

/** Prepare game-scoped backup roots and preserve any old Minecraft backup tree. */
export async function initializeGameBackupDirectories(dataDirectory) {
  const minecraftBackupDirectory = await ensureDataDirectory(dataDirectory, "backups/minecraft");
  const steamBackupDirectory = await ensureDataDirectory(dataDirectory, "backups/steam");
  const legacyMigration = await migrateLegacyMinecraftBackupDirectory(dataDirectory, minecraftBackupDirectory);
  return { minecraftBackupDirectory, steamBackupDirectory, legacyMigration };
}
