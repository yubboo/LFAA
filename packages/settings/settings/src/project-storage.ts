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

const defaultProjectStorageLocations = (): ProjectStorageLocations => ({
  logsDirectory: resolve(config.dataDirectory, "logs"),
  writingDirectory: resolve(config.dataDirectory),
  dramaDirectory: resolve(config.dataDirectory),
  runtimeDirectory: resolve(config.dataDirectory, "environments"),
  downloadCacheDirectory: resolve(config.dataDirectory, "cache"),
  temporaryDirectory: resolve(config.dataDirectory, "tmp")
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
    dramaDirectory: normalizedSavedPath(row?.drama_directory ?? defaults.dramaDirectory, config.dataDirectory, "漫剧目录"),
    runtimeDirectory: normalizedSavedPath(row?.runtime_directory ?? defaults.runtimeDirectory, config.dataDirectory, "运行环境目录"),
    downloadCacheDirectory: normalizedSavedPath(row?.download_cache_directory ?? defaults.downloadCacheDirectory, config.dataDirectory, "下载缓存目录"),
    temporaryDirectory: normalizedSavedPath(row?.temporary_directory ?? defaults.temporaryDirectory, config.dataDirectory, "临时目录")
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

export function saveProjectStorageLocations(input: Pick<ProjectStorageLocations,"logsDirectory"|"writingDirectory"|"dramaDirectory"> & Partial<ProjectStorageLocations>): { settings: ProjectStorageLocations; configured: boolean } {
  const defaults = defaultProjectStorageLocations();
  const current = getProjectStorageLocations().settings;
  const next: ProjectStorageLocations = {
    logsDirectory: normalizedSavedPath(input.logsDirectory, config.dataDirectory, "日志目录"),
    writingDirectory: normalizedSavedPath(input.writingDirectory, config.dataDirectory, "写作目录"),
    dramaDirectory: normalizedSavedPath(input.dramaDirectory, config.dataDirectory, "漫剧目录"),
    runtimeDirectory: normalizedSavedPath(input.runtimeDirectory ?? current.runtimeDirectory, config.dataDirectory, "运行环境目录"),
    downloadCacheDirectory: normalizedSavedPath(input.downloadCacheDirectory ?? current.downloadCacheDirectory, config.dataDirectory, "下载缓存目录"),
    temporaryDirectory: normalizedSavedPath(input.temporaryDirectory ?? current.temporaryDirectory, config.dataDirectory, "临时目录")
  };
  for (const path of Object.values(next)) ensureRealDirectory(path);

  const previousRow = readRow();
  const record: ProjectStorageRow = { ...previousRow, id: 1 };
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
  record.runtime_directory = next.runtimeDirectory;
  record.download_cache_directory = next.downloadCacheDirectory;
  record.temporary_directory = next.temporaryDirectory;
  record.runtime_previous_directories = [...new Set([...(current.runtimeDirectory !== next.runtimeDirectory ? [current.runtimeDirectory] : []), ...(previousRow?.runtime_previous_directories ?? [])])];
  if(record.runtime_previous_directories.length > 32) throw new Error("运行环境历史目录已达上限，请先核查仍被引用的位置。");
  configuration.save("project_storage_locations", record);
  configureFileLogDirectory(next.logsDirectory);
  return getProjectStorageLocations();
}

/** 本机设置与远端覆盖分开；默认远端路径必须由该设备数据根推导，不能复用控制端绝对路径。 */
export function getRuntimeStorageLocations(targetId: string, dataRoot: string, platform: string,localNodeDefaults?:RuntimeStorageLocations): RuntimeStorageLocations {
  const row = readRow();
  if(targetId === "local") { const current = getProjectStorageLocations().settings; return {runtimeDirectory:current.runtimeDirectory,downloadCacheDirectory:current.downloadCacheDirectory,temporaryDirectory:current.temporaryDirectory,previousRuntimeDirectories:row?.runtime_previous_directories ?? []}; }
  const saved = row?.runtime_node_locations?.[targetId];
  if(saved) return structuredClone(saved);
  if(localNodeDefaults)return structuredClone(localNodeDefaults);
  // 节点返回自己的目录分隔符；控制端可以在与节点不同的平台运行。
  const separator = platform === "win32" ? "\\" : "/";
  const joinNode = (part:string) => `${dataRoot.replace(/[\\/]$/u,"")}${separator}${part}`;
  if(!dataRoot) throw new Error("目标设备尚未报告数据根目录。");
  return {runtimeDirectory:joinNode("environments"),downloadCacheDirectory:joinNode("cache"),temporaryDirectory:joinNode("tmp"),previousRuntimeDirectories:[]};
}

export function saveRuntimeNodeStorageLocations(targetId:string,input:RuntimeStorageLocations):RuntimeStorageLocations {
  if(!/^[a-f0-9-]{36}$/iu.test(targetId))throw new Error("运行环境设备标识无效。");
  const row=readRow();const nodes={...(row?.runtime_node_locations ?? {})};const previous=nodes[targetId];
  if(!Object.hasOwn(nodes,targetId)&&Object.keys(nodes).length>=128)throw new Error("运行环境设备配置数量已达上限。");
  nodes[targetId]={...input,previousRuntimeDirectories:[...new Set([...(previous&&previous.runtimeDirectory!==input.runtimeDirectory?[previous.runtimeDirectory]:[]),...(previous?.previousRuntimeDirectories??[]),...(input.previousRuntimeDirectories??[])])]};
  if(nodes[targetId].previousRuntimeDirectories!.length>32)throw new Error("目标设备运行环境历史目录已达上限。");
  configuration.save("project_storage_locations",{...row,id:1,runtime_node_locations:nodes});
  return structuredClone(nodes[targetId]);
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

