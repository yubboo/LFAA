/**
 * 功能：为标准 CLI 回归中的每个 Node 测试进程隔离账户 Home、业务 Data 和账户主目录。
 * 作用：并行测试不得访问用户数据或共用 SQLite；退出时只清理本进程创建的临时根。
 * 关联文件：apps/cli/package.json 的 test 命令。
 */
import { basename, dirname, join, resolve } from "node:path";
import { existsSync, mkdtempSync, mkdirSync, promises as fs } from "node:fs";
import { tmpdir } from "node:os";

const prefix = "lfaa-cli-test-worker-";
const temporaryRoot = mkdtempSync(join(tmpdir(), prefix));
const accountHome = join(temporaryRoot, "account-home");
const profile = join(temporaryRoot, "profile");
const dataDirectory = join(temporaryRoot, "data");
mkdirSync(accountHome, { recursive: true });
mkdirSync(profile, { recursive: true });
mkdirSync(dataDirectory, { recursive: true });

process.env.LFAA_HOME = accountHome;
process.env.LFAA_DATA_DIR = dataDirectory;
process.env.USERPROFILE = profile;
process.env.HOME = profile;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "";
process.env.LFAA_HARNESS_HOME = "";
delete process.env.LFAA_DATA_DIR_CONFIGURED;
delete process.env.LFAA_DATA_DIR_MANAGED_BY_LAUNCHER;
delete process.env.LFAA_DATA_DIR_MANAGED_BY_DESKTOP;

process.once("beforeExit", async () => {
  if (dirname(temporaryRoot) !== resolve(tmpdir()) || !basename(temporaryRoot).startsWith(prefix)) return;
  if (existsSync(join(accountHome, "database", "lfaa.sqlite"))) {
    const { database, closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");
    if (database.isOpen) {
      const [{ configuration }, { sessionRecords }] = await Promise.all([
        import("lfaa-storage-domain/src/configuration.js"),
        import("lfaa-session-persistence-jsonl/src/repository.js")
      ]);
      sessionRecords.close();
      configuration.close();
      closeDatabase();
    }
  }
  await fs.rm(temporaryRoot, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
});
