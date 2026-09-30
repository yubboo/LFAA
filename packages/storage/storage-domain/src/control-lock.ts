/** 功能：协调控制端文件写锁的领取。作用：借控制面已有事务串行回收崩溃锁，避免两个启动进程同时替换锁。关联文件：configuration.ts、会话 repository.ts、storage-json/FileLease。 */
export function withControlLock<T>(database: { exec(statement: string): void }, action: () => T): T {
  database.exec("BEGIN IMMEDIATE;");
  try { const result = action(); database.exec("COMMIT;"); return result; }
  catch (error) { database.exec("ROLLBACK;"); throw error; }
}
