// 内置连接器目录：MCP 与 CLI 条目交错排列，首屏同时出现两类，避免整屏都是同一种连接器。
import type { CatalogEntry } from "../../contract";
import { CLI_CATALOG } from "./cli";
import { MCP_CATALOG } from "./mcp";

const popularFirst = (entries: CatalogEntry[]): CatalogEntry[] =>
  [...entries.filter((entry) => entry.popular), ...entries.filter((entry) => !entry.popular)];

function interleave(left: CatalogEntry[], right: CatalogEntry[]): CatalogEntry[] {
  const merged: CatalogEntry[] = [];
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const first = left[index];
    const second = right[index];
    if (first) merged.push(first);
    if (second) merged.push(second);
  }
  return merged;
}

export const CONNECTOR_CATALOG: CatalogEntry[] = interleave(popularFirst(CLI_CATALOG), popularFirst(MCP_CATALOG));

/** 按 id 取目录条目；未知 id 返回 undefined。 */
export function findCatalogEntry(id: string): CatalogEntry | undefined {
  return CONNECTOR_CATALOG.find((entry) => entry.id === id);
}