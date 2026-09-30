/**
 * 功能：在 LFAA 本机服务停止后迁移本机数据根目录。
 * 作用：检查迁移前置条件，复制并核对完整数据树与 SQLite，再切换开发 .env 或桌面端路径配置；失败时保留源目录和请求。
 * 关联文件：packages/workspace/data-directory/src/service.ts、packages/util/launch-environment/src/config.ts、scripts/start-dev.ps1、apps/desktop-electron/src/main.mjs、apps/desktop-tauri/src-tauri/src/main.rs、根目录 .gitignore。
 */
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { cp, lstat, mkdir, readdir, readFile, realpath, rename, rm, rmdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";

const projectRoot = process.argv[2] ? resolve(process.argv[2]) : "";
if (!projectRoot) throw new Error("用法：node scripts/apply-data-directory-migration.mjs <项目根目录>");

const optionValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? "" : "";
};
const desktopConfigurationPath = optionValue("--desktop-config") ? resolve(optionValue("--desktop-config")) : "";
const requestPath = optionValue("--request")
  ? resolve(optionValue("--request"))
  : resolve(projectRoot, ".lfaa-data-directory.pending.json");
const environmentPath = resolve(projectRoot, ".env");
const desktopMigration = Boolean(desktopConfigurationPath);

function isWithinDirectory(parentDirectory, candidateDirectory) {
  const pathFromParent = relative(parentDirectory, candidateDirectory);
  return pathFromParent === "" || (pathFromParent !== ".." && !pathFromParent.startsWith(`..${sep}`) && !isAbsolute(pathFromParent));
}

function normalizePath(value) {
  const result = resolve(value);
  return process.platform === "win32" ? result.toLocaleLowerCase("en-US") : result;
}

function normalizeWindowsDirectory(value) {
  return resolve(value).replaceAll("/", "\\").replace(/[\\]+$/u, "").toLocaleLowerCase("en-US");
}

async function assertNoSymbolicLinks(rootDirectory) {
  const pendingDirectories = [rootDirectory];
  while (pendingDirectories.length) {
    const currentDirectory = pendingDirectories.pop();
    if (!currentDirectory) continue;
    for (const entry of await readdir(currentDirectory, { withFileTypes: true })) {
      const entryPath = resolve(currentDirectory, entry.name);
      const info = await lstat(entryPath);
      if (info.isSymbolicLink()) throw new Error("源数据目录包含符号链接或目录联接。为避免把数据复制到意外位置，迁移已停止。");
      if (info.isDirectory()) pendingDirectories.push(entryPath);
    }
  }
}

async function collectManifest(rootDirectory) {
  const records = [];
  const pendingDirectories = [rootDirectory];
  while (pendingDirectories.length) {
    const currentDirectory = pendingDirectories.pop();
    if (!currentDirectory) continue;
    for (const entry of await readdir(currentDirectory, { withFileTypes: true })) {
      const entryPath = resolve(currentDirectory, entry.name);
      const info = await lstat(entryPath);
      if (info.isSymbolicLink()) throw new Error("数据树在迁移过程中出现符号链接；为保护路径边界，迁移已停止。");
      const path = relative(rootDirectory, entryPath).split(sep).join("/");
      records.push({ path, type: info.isDirectory() ? "directory" : "file", size: info.isFile() ? info.size : 0 });
      if (info.isDirectory()) pendingDirectories.push(entryPath);
    }
  }
  return records.sort((left, right) => left.path.localeCompare(right.path, "en"));
}

function hasTable(database, tableName) {
  return Boolean(database.prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName));
}

function assertDatabaseIdle(databasePath, sourceDirectory) {
  let database;
  try {
    database = new DatabaseSync(databasePath, { readOnly: true });
    const version = Number(database.prepare("PRAGMA user_version").get().user_version);
    const daemonHasDataRoot = hasTable(database, "daemon_nodes")
      && database.prepare("PRAGMA table_info(daemon_nodes)").all().some((column) => column.name === "data_root");
    if (version >= 19 && daemonHasDataRoot) {
      const localRoot = normalizeWindowsDirectory(sourceDirectory);
      const localNodePredicate = "lower(rtrim(replace(data_root, '/', char(92)), char(92))) = ?";
      const activeInstances = hasTable(database, "minecraft_instances")
        ? Number(database.prepare(`SELECT COUNT(*) AS count FROM minecraft_instances i JOIN daemon_nodes n ON n.id = i.node_id WHERE ${localNodePredicate} AND i.state NOT IN ('stopped', 'error')`).get(localRoot).count)
        : 0;
      const activeTaskTables = ["minecraft_tasks", "steamcmd_tasks", "node_file_tasks"];
      let activeTasks = 0;
      for (const tableName of activeTaskTables) {
        if (!hasTable(database, tableName)) continue;
        activeTasks += Number(database.prepare(`SELECT COUNT(*) AS count FROM ${tableName} t JOIN daemon_nodes n ON n.id = t.node_id WHERE ${localNodePredicate} AND t.status IN ('queued', 'running')`).get(localRoot).count);
      }
      if (activeInstances > 0 || activeTasks > 0) {
        throw new Error("本机仍有运行中或状态未确认的 Minecraft 实例/节点任务。请重新启动旧目录下的 LFAA，停止实例并等任务结束后，再关闭服务并重试迁移。");
      }
    }
  } finally {
    database?.close();
  }
}

function assertDatabaseHealthy(databasePath) {
  if (!databasePath) return;
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const result = database.prepare("PRAGMA quick_check").get();
    if (result?.quick_check !== "ok") throw new Error("SQLite quick_check 未通过；源目录保留，迁移没有切换。");
  } finally {
    database.close();
  }
}

async function updateEnvironmentFile(targetDirectory) {
  let content = "";
  try {
    content = await readFile(environmentPath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const hasBom = content.startsWith("\uFEFF");
  const body = hasBom ? content.slice(1) : content;
  const newline = body.includes("\r\n") ? "\r\n" : "\n";
  const lines = body ? body.split(/\r?\n/u) : [];
  const matches = lines.reduce((indices, line, index) => {
    if (/^\s*(?:export\s+)?LFAA_DATA_DIR\s*=/u.test(line)) indices.push(index);
    return indices;
  }, []);
  if (matches.length > 1) throw new Error("项目 .env 中存在多条 LFAA_DATA_DIR 配置；请先整理为一条后再重试。");

  const serializedPath = resolve(targetDirectory).replaceAll("\\", "/");
  const assignment = `LFAA_DATA_DIR="${serializedPath}"`;
  if (matches.length) lines[matches[0]] = assignment;
  else lines.push(assignment);
  const finalContent = `${hasBom ? "\uFEFF" : ""}${lines.join(newline).replace(/\r?\n*$/u, "")}${newline}`;
  const temporaryPath = `${environmentPath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, finalContent, { encoding: "utf8", flag: "wx", mode: 0o600 });
  try {
    await rename(temporaryPath, environmentPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

async function updateDesktopConfiguration(targetDirectory) {
  let settings = {};
  try {
    const parsed = JSON.parse(await readFile(desktopConfigurationPath, "utf8"));
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) settings = parsed;
  } catch (error) {
    if (error?.code !== "ENOENT") throw new Error("桌面端数据目录配置无法读取，已保留旧目录和迁移请求。");
  }

  settings.dataDirectory = targetDirectory;
  const temporaryPath = `${desktopConfigurationPath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  try {
    await rename(temporaryPath, desktopConfigurationPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

async function main() {
  let request;
  try {
    request = JSON.parse(await readFile(requestPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw new Error("无法读取项目根目录中的待处理数据目录迁移请求；原目录未改动。");
  }

  if (desktopMigration) {
    if (process.env.LFAA_DESKTOP_MODE !== "true" || process.env.LFAA_DATA_DIRECTORY_MIGRATION_SUPPORTED !== "1") {
      throw new Error("当前桌面端没有授权执行此数据目录迁移。");
    }
  } else if (process.env.LFAA_DATA_DIR_MANAGED_BY_LAUNCHER !== "1") {
    throw new Error("当前数据目录由外部环境变量管理；请修改部署配置，不执行项目级迁移。");
  }
  if (request?.version !== 1 || typeof request.migrationId !== "string" || !/^[0-9a-f-]{36}$/iu.test(request.migrationId) || typeof request.sourceDirectory !== "string" || typeof request.targetDirectory !== "string") {
    throw new Error("待处理的数据目录迁移请求格式无效；原目录未改动。");
  }
  const sourceDirectory = resolve(request.sourceDirectory);
  const targetDirectory = resolve(request.targetDirectory);
  if (!isAbsolute(request.sourceDirectory) || !isAbsolute(request.targetDirectory) || normalizePath(sourceDirectory) === normalizePath(targetDirectory)) {
    throw new Error("迁移请求必须包含两个不同的绝对目录；原目录未改动。");
  }
  if (isWithinDirectory(sourceDirectory, targetDirectory) || isWithinDirectory(targetDirectory, sourceDirectory)) {
    throw new Error("源目录和目标目录重叠；原目录未改动。");
  }
  if (!desktopMigration && (isWithinDirectory(projectRoot, targetDirectory) || isWithinDirectory(targetDirectory, projectRoot))) {
    throw new Error("自定义数据目录必须位于项目源码目录之外；原目录未改动。");
  }

  const sourceInfo = await lstat(sourceDirectory);
  if (sourceInfo.isSymbolicLink() || !sourceInfo.isDirectory()) throw new Error("源数据路径不是普通目录；原目录未改动。");
  const realSourceDirectory = await realpath(sourceDirectory);
  await mkdir(dirname(targetDirectory), { recursive: true });
  const realTargetParent = await realpath(dirname(targetDirectory));
  const finalTargetDirectory = resolve(realTargetParent, basename(targetDirectory));
  if (isWithinDirectory(realSourceDirectory, finalTargetDirectory) || isWithinDirectory(finalTargetDirectory, realSourceDirectory)) {
    throw new Error("解析符号链接后源目录和目标目录发生重叠；原目录未改动。");
  }

  let existingTarget = false;
  try {
    const targetInfo = await lstat(finalTargetDirectory);
    if (targetInfo.isSymbolicLink() || !targetInfo.isDirectory()) throw new Error("目标路径不是普通目录；原目录未改动。");
    existingTarget = true;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const migrationInfoRelativePath = `credentials/.data-directory-migration-${request.migrationId}.json`;
  const migrationInfoPath = resolve(finalTargetDirectory, migrationInfoRelativePath);
  let targetAlreadyCommitted = false;
  if (existingTarget) {
    const entries = await readdir(finalTargetDirectory);
    if (entries.length) {
      try {
        const migrationInfo = JSON.parse(await readFile(migrationInfoPath, "utf8"));
        targetAlreadyCommitted = migrationInfo.version === 1
          && normalizePath(migrationInfo.sourceDirectory) === normalizePath(sourceDirectory)
          && normalizePath(migrationInfo.targetDirectory) === normalizePath(finalTargetDirectory);
      } catch {
        targetAlreadyCommitted = false;
      }
      if (!targetAlreadyCommitted) throw new Error("目标目录在迁移前已包含文件；为避免覆盖，迁移已停止且源目录保留。");
    }
  }

  if (!targetAlreadyCommitted) {
    assertDatabaseIdle(resolve(sourceDirectory, "database", "lfaa.sqlite"), sourceDirectory);
    const sourceDatabasePath = resolve(sourceDirectory, "database", "lfaa.sqlite");
    try {
      await stat(sourceDatabasePath);
      assertDatabaseHealthy(sourceDatabasePath);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await assertNoSymbolicLinks(sourceDirectory);

    const temporaryDirectory = resolve(realTargetParent, `.${basename(finalTargetDirectory)}.lfaa-migration-${randomUUID()}`);
    try {
      await cp(realSourceDirectory, temporaryDirectory, { recursive: true, force: false, errorOnExist: true, preserveTimestamps: true });
      const sourceManifest = await collectManifest(realSourceDirectory);
      const targetManifest = await collectManifest(temporaryDirectory);
      if (JSON.stringify(sourceManifest) !== JSON.stringify(targetManifest)) {
        throw new Error("迁移副本的文件数量或大小与源目录不一致；原目录保留，没有切换位置。");
      }

      const copiedDatabasePath = resolve(temporaryDirectory, "database", "lfaa.sqlite");
      try {
        await stat(copiedDatabasePath);
        assertDatabaseHealthy(copiedDatabasePath);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }

      const temporaryMigrationInfoPath = resolve(temporaryDirectory, migrationInfoRelativePath);
      await mkdir(dirname(temporaryMigrationInfoPath), { recursive: true });
      await writeFile(temporaryMigrationInfoPath, `${JSON.stringify({ version: 1, sourceDirectory, targetDirectory: finalTargetDirectory, completedAt: new Date().toISOString() }, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });

      if (existingTarget) {
        const entries = await readdir(finalTargetDirectory);
        if (entries.length) throw new Error("目标目录在迁移期间被写入；为避免覆盖，迁移已停止且源目录保留。");
        await rmdir(finalTargetDirectory);
      }
      await rename(temporaryDirectory, finalTargetDirectory);
    } catch (error) {
      await rm(temporaryDirectory, { recursive: true, force: true });
      throw error;
    }
  } else {
    assertDatabaseIdle(resolve(sourceDirectory, "database", "lfaa.sqlite"), sourceDirectory);
    await assertNoSymbolicLinks(sourceDirectory);
    const sourceManifest = await collectManifest(realSourceDirectory);
    const targetManifest = (await collectManifest(finalTargetDirectory)).filter((record) => record.path !== migrationInfoRelativePath);
    if (JSON.stringify(sourceManifest) !== JSON.stringify(targetManifest)) {
      throw new Error("上次迁移副本与当前源目录内容不一致；为保护新增数据，本次没有切换位置。请选择一个新的空目标目录。");
    }
    assertDatabaseHealthy(resolve(sourceDirectory, "database", "lfaa.sqlite"));
    assertDatabaseHealthy(resolve(finalTargetDirectory, "database", "lfaa.sqlite"));
  }

  if (desktopMigration) await updateDesktopConfiguration(finalTargetDirectory);
  else await updateEnvironmentFile(finalTargetDirectory);
  await rm(requestPath, { force: true });
  process.stdout.write(`数据已复制并通过核对；LFAA_DATA_DIR 已切换为 ${finalTargetDirectory}。旧目录保留：${sourceDirectory}\n`);
}

async function preserveMigrationError(error) {
  try {
    const request = JSON.parse(await readFile(requestPath, "utf8"));
    request.lastError = error instanceof Error ? error.message : "数据目录迁移失败。";
    const temporaryPath = `${requestPath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(request, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(temporaryPath, requestPath);
  } catch {
    // 请求标记无法更新时，源目录和原配置仍保留；启动器会报告本次迁移错误。
  }
}

try {
  await main();
} catch (error) {
  await preserveMigrationError(error);
  process.stderr.write(`${error instanceof Error ? error.message : "数据目录迁移失败。"}\n`);
  process.exitCode = 1;
}
