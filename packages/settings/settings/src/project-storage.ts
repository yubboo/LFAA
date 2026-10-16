/**
 * 功能：持有控制端日志、Writing 和 AI 漫剧的默认存储目录。
 * 作用：分类目录从唯一 data 根派生，旧分区配置仅用于已有项目与环境回读。
 * 关联文件：settings-controller、writing/local-files、video/ai-video、telemetry/logger。
 */
import { existsSync, lstatSync, mkdirSync, realpathSync } from "node:fs";
import { isAbsolute, parse, relative, resolve, sep } from "node:path";
import { resolveDataPaths } from "lfaa-home-paths/src/data-layout.mjs";
import { configuration } from "lfaa-storage-domain/src/configuration.js";
import { config } from "lfaa-launch-environment/src/config.js";
import { configureFileLogDirectory, logger } from "lfaa-telemetry-logger/src/logger.js";

export interface ProjectStorageLocations {
  logsDirectory: string;
  writingDirectory: string;
  dramaDirectory: string;
  runtimeDirectory: string;
  downloadCacheDirectory: string;
  temporaryDirectory: string;
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
  runtime_directory?: string;
  download_cache_directory?: string;
  temporary_directory?: string;
  runtime_previous_directories?: string[];
  runtime_node_locations?: Record<string, RuntimeStorageLocations>;
}

export interface RuntimeStorageLocations { runtimeDirectory: string; downloadCacheDirectory: string; temporaryDirectory: string; previousRuntimeDirectories?: string[] }

const defaultProjectStorageLocations = (): ProjectStorageLocations => {
  const paths = resolveDataPaths(config.dataDirectory);
  return { logsDirectory: paths.logs, writingDirectory: paths.root, dramaDirectory: paths.root,
    runtimeDirectory: paths.environments, downloadCacheDirectory: paths.cache, temporaryDirectory: paths.tmp };
};

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

/** 分类位置仅从唯一 data 根派生；旧保存字段只供存量数据回读。 */
export function getProjectStorageLocations(): { settings: ProjectStorageLocations; configured: boolean } {
  return { settings: defaultProjectStorageLocations(), configured: true };
}

export function getProjectStorageDirectoryCandidates(kind: ProjectStorageKind): string[] {
  const current = getProjectStorageLocations().settings[`${kind}Directory` as keyof ProjectStorageLocations];
  const row = readRow();
  const saved = row?.[`${kind}_directory`];
  const history = [...(typeof saved === "string" && saved ? [resolve(saved)] : []), ...historyFor(row, kind)];
  return [...new Set([current, ...history])];
}


/** 所有分类由该设备 data 根派生；旧节点覆盖只作环境回读候选，不再决定新安装位置。 */
export function getRuntimeStorageLocations(targetId: string, dataRoot: string, platform: string,localNodeDefaults?:RuntimeStorageLocations): RuntimeStorageLocations {
  const row = readRow();
  const previous = targetId === "local"
    ? [row?.runtime_directory, ...(row?.runtime_previous_directories ?? [])]
    : [row?.runtime_node_locations?.[targetId]?.runtimeDirectory, ...(row?.runtime_node_locations?.[targetId]?.previousRuntimeDirectories ?? []), ...(localNodeDefaults?.previousRuntimeDirectories ?? [])];
  if (!dataRoot) throw new Error("目标设备尚未报告数据根目录。");
  const separator = platform === "win32" ? "\\" : "/";
  const joinNode = (part: string) => dataRoot.replace(/[\\/]$/u, "") + separator + part;
  const runtimeDirectory = joinNode("environments");
  return { runtimeDirectory, downloadCacheDirectory: joinNode("cache"), temporaryDirectory: joinNode("tmp"),
    previousRuntimeDirectories: [...new Set(previous.filter((path): path is string => typeof path === "string" && Boolean(path) && path !== runtimeDirectory))] };
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
  // 数据盘不可用不应阻止控制端启动，仍保留控制台日志。
  logger.error("控制端日志目录当前不可用，保留控制台日志。", { message: error instanceof Error ? error.message : String(error) });
}

