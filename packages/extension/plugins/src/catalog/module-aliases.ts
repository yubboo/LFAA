// 合包后的旧插件 module 名迁移表：包名合并后，旧 profile 记录与旧会话模块列表都要映射到新包名。
// 仅覆盖本仓已合并的插件包；外部插件名原样保留。
import type { PluginRecord } from "../../contract/index";
import { toRecordId } from "./plugin-catalog";

/** 旧 module 名 → 新 module 名。 */
export const MODULE_ALIASES: Readonly<Record<string, string>> = {
  "@lfaa/tool-web": "@lfaa/web",
  "@lfaa/web-fetch-http": "@lfaa/web",
  "@lfaa/tool-goal": "@lfaa/goal",
  "@lfaa/compaction-basic": "@lfaa/compaction",
  "@lfaa/tool-result-pruner": "@lfaa/compaction",
  "@lfaa/command-compact": "@lfaa/compaction",
  "@lfaa/sandbox-policy": "@lfaa/sandbox",
  "@lfaa/sandbox-local": "@lfaa/sandbox",
};

/** 归一化模块名；未知名称原样返回。 */
export function normalizeModuleName(name: string): string {
  return MODULE_ALIASES[name] ?? name;
}

/**
 * 迁移一条旧的插件记录：改写 moduleName / id / manifest.id。
 * 不需要迁移时返回原对象，便于调用方判断是否有变化。
 */
export function normalizeRecord(record: PluginRecord): PluginRecord {
  const moduleName = normalizeModuleName(record.moduleName);
  if (moduleName === record.moduleName) return record;
  const id = toRecordId(moduleName);
  return { ...record, id, moduleName, manifest: { ...record.manifest, id } };
}