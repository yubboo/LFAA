/** 功能：登记权威会话服务。作用：完成旧表退役并随 Harness 生命周期释放写锁。关联文件：repository.ts、core/session、bundle/base。 */
import type { Context } from "@deepseek-ai/cordis";
import { sessionRecords } from "./repository.js";
import { retireLegacyFileTables } from "lfaa-storage-domain/src/migration.js";
export const name = "lfaaSessionPersistence";
export function apply(ctx: Context): void { retireLegacyFileTables(); ctx.provide(name, sessionRecords); ctx.effect(() => () => sessionRecords.close()); }
