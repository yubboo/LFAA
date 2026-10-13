/**
 * 功能：持有控制端日志、Writing 和 AI 漫剧的默认存储目录。
 * 作用：保留旧目录供已有项目回读，并让新项目按当前 Settings 配置落盘。
 * 关联文件：settings-controller、writing/local-files、video/ai-video、telemetry/logger。
 */
import { existsSync, lstatSync, mkdirSync, realpathSync } from "node:fs";
import { isAbsolute, parse, relative, resolve, sep } from "node:path";
import { configuration } from "lfaa-storage-domain/src/configuration.js";
import { config } from "lfaa-launch-environment/src/config.js";
import { configureFileLogDirectory, logger } from "lfaa-telemetry-logger/src/logger.js";

export interface ProjectStorageLocations {
  logsDirectory: string;
  writingDirectory: string;
  dramaDirectory: string;
}

export type ProjectStorageKind = "logs" | "writing" | "drama";

interface ProjectStorageRow extends Record<string, unknown> {
  id: number;
  logs_directory?: string | null;
  writing_directory?: string | null;
  drama_directory?: string | null;
  logs_previous_directories?: string[];
  writing_previous_directories?: string[];
  drama_previous_directories?: string[];
}

const defaultProjectStorageLocations = (): ProjectStorageLocations => ({
  logsDirectory: resolve(config.dataDirectory, "logs"),
  writingDirectory: resolve(config.dataDirectory),
  dramaDirectory: resolve(config.dataDirectory)
});

function readRow(): ProjectStorageRow | undefined {
  return configuration.get("project_storage_locations", row => row.id === 1) as ProjectStorageRow | undefined;
}

function normalizedSavedPath(value: unknown, fallback: string, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 2_048 || /[\r\n\u0000]/u.test(value)) throw new Error(`${label}必须是有效的本机目录。`);
  const candidate = value.trim();
  if (isAbsolute(candidate)) return resolve(candidate);
  if (candidate.includes("\\") || /^[a-z]:/iu.test(candidate)) throw new Error(`${label}必须使用本机可识别的绝对路径。`);
  const segments = candidate.split("/");
  if (segments.some(segment => !segment || segment === "." || segment === "..")) throw new Error(`${label}不能包含空路径段或父目录跳转。`);
  return resolve(fallback, ...segments);
}

function inside(parent: string, target: string): boolean {
  const path = relative(resolve(parent), resolve(target));
  return path === "" || path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function ensureRealDirectory(path: string): void {
  const target = resolve(path);
  const root = parse(target).root;
  if (!root) throw new Error("存储目录必须是本机绝对路径。");
  let current = root;
  for (const segment of relative(root, target).split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    if (!existsSync(current)) {
      try { mkdirSync(current); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    }
    const info = lstatSync(current);
    const actual = realpathSync(current);
    const samePath = process.platform === "win32" ? actual.toLocaleLowerCase("en-US") === current.toLocaleLowerCase("en-US") : actual === current;
    if (!info.isDirectory() || info.isSymbolicLink() || !samePath) throw new Error("存储位置包含链接或非目录路径，拒绝写入。");
  }
}

function historyFor(row: ProjectStorageRow | undefined, kind: ProjectStorageKind): string[] {
  const value = row?.[`${kind}_previous_directories`];
  return Array.isArray(value) ? value.filter((path): path is string => typeof path === "string" && path.length <= 2_048).map(path => resolve(path)) : [];
}

export function getProjectStorageLocations(): { settings: ProjectStorageLocations; configured: boolean } {
  const defaults = defaultProjectStorageLocations();
  const row = readRow();
  const settings = {
    logsDirectory: normalizedSavedPath(row?.logs_directory ?? defaults.logsDirectory, config.dataDirectory, "日志目录"),
    writingDirectory: normalizedSavedPath(row?.writing_directory ?? defaults.writingDirectory, config.dataDirectory, "写作目录"),
    dramaDirectory: normalizedSavedPath(row?.drama_directory ?? defaults.dramaDirectory, config.dataDirectory, "漫剧目录")
  };
  return {
    configured: Boolean(row),
    settings
  };
}

export function getProjectStorageDirectoryCandidates(kind: ProjectStorageKind): string[] {
  const current = getProjectStorageLocations().settings[`${kind}Directory` as keyof ProjectStorageLocations];
  const history = historyFor(readRow(), kind);
  return [...new Set([current, ...history])];
}

export function saveProjectStorageLocations(input: ProjectStorageLocations): { settings: ProjectStorageLocations; configured: boolean } {
  const defaults = defaultProjectStorageLocations();
  const current = getProjectStorageLocations().settings;
  const next: ProjectStorageLocations = {
    logsDirectory: normalizedSavedPath(input.logsDirectory, config.dataDirectory, "日志目录"),
    writingDirectory: normalizedSavedPath(input.writingDirectory, config.dataDirectory, "写作目录"),
    dramaDirectory: normalizedSavedPath(input.dramaDirectory, config.dataDirectory, "漫剧目录")
  };
  for (const path of Object.values(next)) ensureRealDirectory(path);

  const previousRow = readRow();
  const record: ProjectStorageRow = { id: 1 };
  for (const kind of ["logs", "writing", "drama"] as const) {
    const field = `${kind}Directory` as keyof ProjectStorageLocations;
    const column = `${kind}_directory` as const;
    const previousColumn = `${kind}_previous_directories` as const;
    const history = historyFor(previousRow, kind);
    if (current[field] !== next[field]) {
      history.unshift(current[field]);
      const unique = [...new Set(history)];
      if (unique.length > 32) throw new Error(`${kind === "logs" ? "日志" : kind === "writing" ? "写作" : "漫剧"}存储位置历史已达上限；请先整理旧位置后再修改。`);
      record[previousColumn] = unique;
    } else if (history.length) record[previousColumn] = history;
    record[column] = next[field] === defaults[field] ? null : next[field];
  }
  configuration.save("project_storage_locations", record);
  configureFileLogDirectory(next.logsDirectory);
  return getProjectStorageLocations();
}

export function isOutsideProjectDataDirectory(path: string): boolean {
  try { return !inside(config.dataDirectory, normalizedSavedPath(path, config.dataDirectory, "存储目录")); }
  catch { return true; }
}

export function ensureProjectStorageDirectory(path: string): string {
  const normalized = normalizedSavedPath(path, config.dataDirectory, "存储目录");
  ensureRealDirectory(normalized);
  return normalized;
}

try {
  const initialLogDirectory = getProjectStorageLocations().settings.logsDirectory;
  ensureRealDirectory(initialLogDirectory);
  configureFileLogDirectory(initialLogDirectory);
} catch (error) {
  // Removable or unavailable user storage must not prevent the control plane from starting; console logging remains active.
  logger.error("控制端日志目录当前不可用，保留控制台日志。", { message: error instanceof Error ? error.message : String(error) });
}

