// 目录条目构造辅助：收敛重复字段，内置目录只关心差异部分。
import type { CatalogCategory, CatalogEntry, CatalogInput, CliActionConfig } from "../../contract";

export interface McpEntryInput {
  id: string;
  name: string;
  glyph: string;
  description: string;
  category: CatalogCategory;
  package: string;
  examples: string[];
  publisher?: string;
  version?: string;
  popular?: boolean;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  inputs?: CatalogInput[];
}

/** 构造 MCP 条目：默认 `npx -y <package>`，网站指向 npm 包页。 */
export function mcpEntry(entry: McpEntryInput): CatalogEntry {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    glyph: entry.glyph,
    category: entry.category,
    ...(entry.popular ? { popular: true } : {}),
    kind: "mcp",
    publisher: entry.publisher ?? "MCP 官方",
    version: entry.version ?? "latest",
    website: `https://www.npmjs.com/package/${entry.package}`,
    examples: entry.examples,
    ...(entry.inputs ? { inputs: entry.inputs } : {}),
    mcp: entry.url
      ? { transport: "http", url: entry.url, ...(entry.env ? { env: entry.env } : {}) }
      : {
        transport: "stdio",
        command: entry.command ?? "npx",
        args: entry.args ?? ["-y", entry.package],
        ...(entry.env ? { env: entry.env } : {}),
      },
  };
}

export interface CliEntryInput {
  id: string;
  name: string;
  glyph: string;
  description: string;
  category: CatalogCategory;
  executable: string;
  actions: CliActionConfig[];
  examples: string[];
  installs?: NonNullable<CatalogEntry["cli"]>["installs"];
  probeArgs?: string[];
  popular?: boolean;
  publisher?: string;
  version?: string;
  website?: string;
}

/** 构造 CLI 条目：可执行文件 + 声明式动作 + 可选静默安装方式。 */
export function cliEntry(entry: CliEntryInput): CatalogEntry {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    glyph: entry.glyph,
    category: entry.category,
    ...(entry.popular ? { popular: true } : {}),
    kind: "cli",
    publisher: entry.publisher ?? "开源社区",
    version: entry.version ?? "latest",
    website: entry.website ?? "https://github.com",
    examples: entry.examples,
    cli: {
      executable: entry.executable,
      actions: entry.actions,
      ...(entry.installs ? { installs: entry.installs } : {}),
      ...(entry.probeArgs ? { probeArgs: entry.probeArgs } : {}),
    },
  };
}