/**
 * 功能：持有业务内容存储根，以及系统运行目录。
 * 作用：统一本机业务 Data 根由项目与存储设置选择；账户、凭据、会话与控制配置留在 Home。
 * 关联文件：settings-controller、writing/local-files、video/ai-video、telemetry/logger。
 */
import { existsSync, lstatSync, mkdirSync, realpathSync } from "node:fs";
import { isAbsolute, parse, relative, resolve, sep, win32 } from "node:path";
import { ensureDataDirectories, resolveDataPaths, resolveHomePaths } from "lfaa-home-paths/src/data-layout.mjs";
import { readStoredDataDirectory, saveStoredDataDirectory } from "lfaa-home-paths/src/resolve-data-directory.mjs";
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
  businessDirectories: Array<{ name: string; path: string }>;
  restartRequired: boolean;
  dataDirectoryExternallyManaged: boolean;
  changeUnavailableReason: string | null;
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
const defaultContentDirectory = (): string => config.dataDirectoryExternallyManaged
  ? resolve(config.dataDirectory)
  : resolve(config.homeDirectory, "data");

const defaultProjectStorageLocations = (row: ProjectStorageRow | undefined, savedDirectory: string): ProjectStorageLocations => {
  const legacyDirectory = !config.dataDirectoryExternallyManaged && typeof row?.content_directory === "string" && row.content_directory.trim()
    ? assertProjectContentStoragePath(row.content_directory)
    : "";
  const contentDirectory = savedDirectory || legacyDirectory || defaultContentDirectory();
  const paths = resolveDataPaths(contentDirectory);
  const businessDirectoryNames: Record<string, string> = {
    users: "账户业务文件",
    games: "游戏与项目",
    environments: "运行环境",
    lib: "工具",
    cache: "缓存",
    tmp: "临时文件",
    logs: "日志",
    backups: "备份",
    models: "模型",
    input: "输入素材",
    output: "生成输出",
    connectivity: "联机配置"
  };
  return { contentDirectory, defaultContentDirectory: defaultContentDirectory(), recommendedContentDirectory: recommendedContentDirectory(),
    logsDirectory: paths.logs, writingDirectory: contentDirectory, dramaDirectory: contentDirectory,
    runtimeDirectory: paths.environments, downloadCacheDirectory: paths.cache, temporaryDirectory: paths.tmp,
    businessDirectories: Object.entries(paths).filter(([name]) => name !== "root").map(([name, path]) => ({ name: businessDirectoryNames[name] ?? name, path })),
    restartRequired: !samePath(config.dataDirectory, contentDirectory),
    dataDirectoryExternallyManaged: config.dataDirectoryExternallyManaged,
    changeUnavailableReason: config.dataDirectoryExternallyManaged ? "LFAA_DATA_DIR 由启动配置显式指定，请修改该部署配置后重启。" : null };
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

/** 运行目录、日志与项目内容共用当前业务 Data 根；账户/控制数据仍位于 Home。 */
export function getProjectStorageLocations(): { settings: ProjectStorageLocations; configured: boolean } {
  const row = readRow();
  const storedDirectory = !config.dataDirectoryExternallyManaged ? readStoredDataDirectory(config.homeDirectory) : "";
  return { settings: defaultProjectStorageLocations(row, storedDirectory), configured: Boolean(storedDirectory || (typeof row?.content_directory === "string" && row.content_directory.trim())) };
}

/** 保存业务 Data 根选择；初始化分类，不移动或删除旧根；系统根绝不作为业务内容目录。 */
export function saveProjectContentDirectory(value: string): { settings: ProjectStorageLocations; configured: boolean } {
  if (config.dataDirectoryExternallyManaged) throw new Error("LFAA_DATA_DIR 由启动配置显式指定，请修改该部署配置后重启。");
  if (typeof value !== "string" || !value.trim() || value.length > 2_048 || /[\r\n\u0000]/u.test(value)) {
    throw new Error("内容存储位置必须是有效的本机目录。");
  }
  const candidate = value.trim();
  if (!isAbsolute(candidate)) throw new Error("内容存储位置必须是绝对路径。");
  const directory = assertProjectContentStoragePath(candidate);
  const current = getProjectStorageLocations().settings.contentDirectory;
  const row = readRow();
  ensureDataDirectories(directory);
  const savedHistory = row?.content_previous_directories;
  const previous = Array.isArray(savedHistory)
    ? savedHistory.filter((path): path is string => typeof path === "string" && path.length <= 2_048).map(path => resolve(path))
    : [];
  const contentPreviousDirectories = samePath(current, directory) ? previous : [...new Set([current, ...previous])];
  const nextRow = { ...(row ?? {}) };
  delete nextRow.content_directory;
  configuration.save("project_storage_locations", {
    ...nextRow, id: 1, content_previous_directories: contentPreviousDirectories
  });
  saveStoredDataDirectory(config.homeDirectory, directory);
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
  if (config.dataDirectoryExternallyManaged) {
    ensureDataDirectories(config.dataDirectory);
    return getProjectStorageLocations();
  }
  return saveProjectContentDirectory(getProjectStorageLocations().settings.contentDirectory);
}

function samePath(left: string, right: string): boolean {
  const normalizedLeft = resolve(left);
  const normalizedRight = resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLocaleLowerCase("en-US") === normalizedRight.toLocaleLowerCase("en-US")
    : normalizedLeft === normalizedRight;
}

/** 允许业务根使用 Home/data；拒绝覆盖/嵌套账户分类或插件 Profile。 */
export function assertProjectContentStoragePath(value: string): string {
  const homeRoot = resolve(config.homeDirectory);
  const rawDirectory = resolve(value);
  const directory = samePath(rawDirectory, homeRoot) ? resolve(homeRoot, "data") : rawDirectory;
  const accountDirectories = Object.entries(resolveHomePaths(homeRoot)).filter(([name]) => name !== "root").map(([, path]) => path);
  if (samePath(directory, homeRoot) || accountDirectories.some(path => inside(path, directory) || inside(directory, path))) {
    throw new Error("业务 Data 根不能覆盖或嵌套账户、凭据、会话和设置目录。");
  }
  const profileDirectory = resolve(config.homeDirectory, "profiles");
  if (inside(directory, profileDirectory) || inside(profileDirectory, directory)) {
    throw new Error("业务内容目录必须与插件 Profile 目录完全分开，不能相同或相互嵌套。");
  }
  return directory;
}

export function getProjectStorageDirectoryCandidates(kind: ProjectStorageKind): string[] {
  const current = getProjectStorageLocations().settings[`${kind}Directory` as keyof ProjectStorageLocations];
  const currentDirectory = typeof current === "string" ? current : "";
  const row = readRow();
  const saved = row?.[`${kind}_directory`];
  const savedContentHistory = row?.content_previous_directories;
  const contentHistory = kind !== "logs" && Array.isArray(savedContentHistory)
    ? savedContentHistory.filter((path): path is string => typeof path === "string" && path.length <= 2_048).map(path => resolve(path))
    : [];
  const legacyRoots: string[] = [];
  const history = [...contentHistory, ...(typeof saved === "string" && saved ? [resolve(saved)] : []), ...historyFor(row, kind), ...legacyRoots];
  return [...new Set([currentDirectory, ...history])];
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
  const initialStorage = getProjectStorageLocations().settings;
  if (!config.dataDirectoryExternallyManaged && !readStoredDataDirectory(config.homeDirectory) && !samePath(config.dataDirectory, initialStorage.contentDirectory)) {
    // 兼容升级前保存在 Project Storage 行中的业务根；只登记路径，不迁移或删除任何数据。
    const storedDirectory = readStoredDataDirectory(config.homeDirectory);
    if (!storedDirectory) saveStoredDataDirectory(config.homeDirectory, initialStorage.contentDirectory);
  }
  const initializedPaths = ensureDataDirectories(initialStorage.contentDirectory);
  configureFileLogDirectory(initialStorage.restartRequired ? resolveDataPaths(config.dataDirectory).logs : initializedPaths.logs);
} catch (error) {
  // 数据盘不可用不应阻止控制端启动，仍保留控制台日志。
  logger.error("控制端日志目录当前不可用，保留控制台日志。", { message: error instanceof Error ? error.message : String(error) });
}

