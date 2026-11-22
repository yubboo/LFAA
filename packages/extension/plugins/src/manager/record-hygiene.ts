// 插件记录的合包迁移：旧 module 名归一化，并按记录 id 合并重复项（启用状态取并集）。
import type { PluginRecord } from "../../contract/index";
import { normalizeRecord } from "../catalog/module-aliases";

export interface NormalizedRecords {
  records: PluginRecord[];
  /** 是否有记录被改写或合并；调用方据此决定是否回写。 */
  changed: boolean;
}

export function normalizeRecords(records: readonly PluginRecord[]): NormalizedRecords {
  const merged = new Map<string, PluginRecord>();
  let changed = false;
  for (const record of records) {
    const normalized = normalizeRecord(record);
    if (normalized !== record) changed = true;
    const existing = merged.get(normalized.id);
    merged.set(normalized.id, existing
      ? { ...existing, enabled: existing.enabled || normalized.enabled }
      : normalized);
  }
  const next = [...merged.values()];
  if (next.length !== records.length) changed = true;
  return { records: next, changed };
}