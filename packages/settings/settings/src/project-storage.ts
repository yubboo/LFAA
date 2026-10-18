/**
 * 功能：持有业务内容存储根，以及系统运行目录。
 * 作用：小说、漫剧与游戏内容使用可选择的内容根；账户、AI、会话、环境与日志继续由系统数据根管理。
 * 关联文件：settings-controller、writing/local-files、video/ai-video、telemetry/logger。
 */
import { existsSync, lstatSync, mkdirSync, realpathSync } from "node:fs";
import { isAbsolute, parse, relative, resolve, sep, win32 } from "node:path";
import { resolveDataPaths } from "lfaa-home-paths/src/data-layout.mjs";
import { configuration } from "lfaa-storage-domain/src/configuration.js";
import { config } from "lfaa-launch-environment/src/config.js";
import { configureFileLogDirectory, logger } from "lfaa-telemetry-logger/src/logger.js";

export interface ProjectStorageLocations {
  contentDirectory: string;
  defaultContentDirectory: string;
  recommendedContentDirectory: string;
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
  content_directory?: string | null;
  content_previous_directories?: string[];
  runtime_directory?: string;
  download_cache_directory?: string;
  temporary_directory?: string;
  runtime_previous_directories?: string[];
  runtime_node_locations?: Record<string, RuntimeStorageLocations>;
}

export interface RuntimeStorageLocations { runtimeDirectory: string; downloadCacheDirectory: string; temporaryDirectory: string; previousRuntimeDirectories?: string[] }

const recommendedContentDirectory = (): string => resolve(config.desktopInstallDirectory || config.repositoryRoot, "data");
const defaultContentDirectory = (): string => resolve(config.homeDirectory, "data");

const defaultProjectStorageLocations = (): ProjectStorageLocations => {
  const paths = resolveDataPaths(config.dataDirectory);
  const row = readRow();
  const contentDirectory = typeof row?.content_directory === "string" && row.content_directory.trim()
    ? resolve(row.content_directory)
    : defaultContentDirectory();
  return { contentDirectory, defaultContentDirectory: defaultContentDirectory(), recommendedContentDirectory: recommendedContentDirectory(),
    logsDirectory: paths.logs, writingDirectory: contentDirectory, dramaDirectory: contentDirectory,
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

/** 系统运行目录继续由系统 data 根派生；业务内容默认使用 LFAA Home/data，推荐位置由项目/安装根动态解析。 */
export function getProjectStorageLocations(): { settings: ProjectStorageLocations; configured: boolean } {
  const row = readRow();
  return { settings: defaultProjectStorageLocations(), configured: typeof row?.content_directory === "string" && Boolean(row.content_directory.trim()) };
}

/** 记录内容根选择；现有非空目录可以直接作为新内容根，不移动、复制或覆盖其中数据；系统根绝不作为业务内容目录。 */
export function saveProjectContentDirectory(value: string): { settings: ProjectStorageLocations; configured: boolean } {
  if (typeof value !== "string" || !value.trim() || value.length > 2_048 || /[\r\n\u0000]/u.test(value)) {
    throw new Error("内容存储位置必须是有效的本机目录。");
  }
  const candidate = value.trim();
  if (!isAbsolute(candidate)) throw new Error("内容存储位置必须是绝对路径。");
  const directory = assertProjectContentStoragePath(candidate);
  const current = getProjectStorageLocations().settings.contentDirectory;
  const row = readRow();
  ensureRealDirectory(directory);
  const savedHistory = row?.content_previous_directories;
  const previous = Array.isArray(savedHistory)
    ? savedHistory.filter((path): path is string => typeof path === "string" && path.length <= 2_048).map(path => resolve(path))
    : [];
  const contentPreviousDirectories = samePath(current, directory) ? previous : [...new Set([current, ...previous])];
  configuration.save("project_storage_locations", {
    ...(row ?? {}), id: 1, content_directory: directory, content_previous_directories: contentPreviousDirectories
  });
  return getProjectStorageLocations();
}

/** 本机 Daemon 的相对游戏目录改由所选业务内容根承载；远端节点继续使用自己的数据根。 */
export function getLocalProjectContentPath(dataRoot: string | null, relativeDirectory: string): string | null {
  if (!dataRoot || !sameWindowsPath(dataRoot, config.dataDirectory)) return null;
  if (typeof relativeDirectory !== "string" || !relativeDirectory || win32.isAbsolute(relativeDirectory)) {
    throw new Error("业务内容子目录必须是相对路径。");
  }
  const segments = relativeDirectory.split(/[\\/]/u);
  if (segments.some(segment => !segment || segment === "." || segment === ".." || /[<>:"|?*\u0000-\u001f]/u.test(segment))) {
    throw new Error("业务内容子目录包含无效路径片段。");
  }
  return win32.resolve(getProjectStorageLocations().settings.contentDirectory, ...segments);
}

function sameWindowsPath(left: string, right: string): boolean {
  return win32.resolve(left).toLocaleLowerCase("en-US") === win32.resolve(right).toLocaleLowerCase("en-US");
}

/** 首次提醒的“不更改”只确认当前有效位置，不改写系统根或内容路径。 */
export function confirmProjectContentDirectory(): { settings: ProjectStorageLocations; configured: boolean } {
  return saveProjectContentDirectory(getProjectStorageLocations().settings.contentDirectory);
}

function samePath(left: string, right: string): boolean {
  const normalizedLeft = resolve(left);
  const normalizedRight = resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLocaleLowerCase("en-US") === normalizedRight.toLocaleLowerCase("en-US")
    : normalizedLeft === normalizedRight;
}

/** 允许 LFAA Home/data 与 Home 共存；拒绝业务根覆盖系统分类目录或插件 Profile。 */
export function assertProjectContentStoragePath(value: string): string {
  const directory = resolve(value);
  const systemRoot = resolve(config.dataDirectory);
  const systemDirectories = samePath(systemRoot, config.homeDirectory)
    ? Object.entries(resolveDataPaths(systemRoot)).filter(([name]) => name !== "root").map(([, path]) => path)
    : [systemRoot];
  if (systemDirectories.some(path => inside(path, directory) || inside(directory, path))) {
    throw new Error("业务内容目录不能与系统账户、Provider、会话或设置目录相同或相互嵌套。");
  }
  const profileDirectory = resolve(config.homeDirectory, "profiles");
  if (inside(directory, profileDirectory) || inside(profileDirectory, directory)) {
    throw new Error("业务内容目录必须与插件 Profile 目录完全分开，不能相同或相互嵌套。");
  }
  return directory;
}

export function getProjectStorageDirectoryCandidates(kind: ProjectStorageKind): string[] {
  const current = getProjectStorageLocations().settings[`${kind}Directory` as keyof ProjectStorageLocations];
  const row = readRow();
  const saved = row?.[`${kind}_directory`];
  const savedContentHistory = row?.content_previous_directories;
  const contentHistory = kind !== "logs" && Array.isArray(savedContentHistory)
    ? savedContentHistory.filter((path): path is string => typeof path === "string" && path.length <= 2_048).map(path => resolve(path))
    : [];
  const legacyRoots: string[] = [];
  const history = [...contentHistory, ...(typeof saved === "string" && saved ? [resolve(saved)] : []), ...historyFor(row, kind), ...legacyRoots];
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
  try {
    const normalized = normalizedSavedPath(path, defaultContentDirectory(), "存储目录");
    return !inside(config.dataDirectory, normalized) && !inside(getProjectStorageLocations().settings.contentDirectory, normalized);
  }
  catch { return true; }
}

export function ensureProjectStorageDirectory(path: string): string {
  const normalized = normalizedSavedPath(path, defaultContentDirectory(), "存储目录");
  const directory = assertProjectContentStoragePath(normalized);
  ensureRealDirectory(directory);
  return directory;
}

try {
  const initialLogDirectory = getProjectStorageLocations().settings.logsDirectory;
  ensureRealDirectory(initialLogDirectory);
  configureFileLogDirectory(initialLogDirectory);
} catch (error) {
  // 数据盘不可用不应阻止控制端启动，仍保留控制台日志。
  logger.error("控制端日志目录当前不可用，保留控制台日志。", { message: error instanceof Error ? error.message : String(error) });
}

