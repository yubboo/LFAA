/** 功能：为加载 Host Owner 的回归创建隔离数据根。作用：必须在动态业务 import 前调用，结束关闭存储并清理夹具。关联文件：capability-mcp/skill、mcp-tools.test.mjs。 */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function isolateData(test, name) {
  if (!/^[a-z-]+$/u.test(name)) throw new Error("测试名称无效。");
  const parent = resolve(dirname(fileURLToPath(import.meta.url)), "../../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, `lfaa-${name}-`));
  process.env.LFAA_DATA_DIR = data; process.env.NODE_ENV = "test"; process.env.JWT_SECRET = ""; process.env.LFAA_HARNESS_HOME = "";
  test.after(async () => {
    const { sessionRecords } = await import("lfaa-session-persistence-jsonl/src/repository.js");
    const { configuration } = await import("lfaa-storage-domain/src/configuration.js");
    const { closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");
    sessionRecords.close(); configuration.close(); closeDatabase();
    if (dirname(data) !== parent) throw new Error("拒绝清理测试根以外的路径。");
    rmSync(data, { recursive: true, force: true });
  });
}
