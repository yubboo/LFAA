/**
 * Windows desktop app discovery and launch support for the local computer-use Profile.
 * App inventory is read from Windows registration sources; arbitrary filesystem paths are never model inputs.
 */
import { execFile as nodeExecFile, spawn as nodeSpawn } from "node:child_process";
import { createHash } from "node:crypto";
import { opendir, readFile, realpath, stat } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

const MAX_START_MENU_ITEMS = 1000;
const MAX_START_MENU_DIRECTORIES = 256;
const MAX_DIRECTORY_DEPTH = 8;
const MAX_DIRECTORY_ENTRIES = 5000;
const MAX_PORTABLE_APP_DIRECTORIES = 1400;
const MAX_PORTABLE_APP_ENTRIES = 24_000;
const MAX_PORTABLE_APP_DEPTH = 5;
const PORTABLE_APP_SEARCH_BUDGET_MS = 2500;
const MAX_PORTABLE_APP_MATCHES = 80;
const MAX_STEAM_LIBRARIES = 32;
const MAX_STEAM_MANIFESTS = 4000;
const MAX_MANIFEST_BYTES = 512 * 1024;
const MAX_STEAM_MANIFEST_TOTAL_BYTES = 64 * 1024 * 1024;
const MAX_LIBRARY_FILE_BYTES = 1024 * 1024;
const MAX_SEARCH_RESULTS = 10;
const MAX_RECOMMENDATIONS = 8;
const MAX_RECORDED_USERS = 64;
const MAX_HISTORY_PER_USER = 100;
const MAX_CANDIDATE_RUNS = 128;
const MAX_CANDIDATES_PER_RUN = 32;
const MAX_WINDOWS_APP_RECORDS = 1500;
const MAX_WINDOWS_PATH_DIRECTORIES = 64;
const MAX_WINDOWS_PATH_ENTRIES = 5000;
const MAX_WINDOWS_DISCOVERY_BYTES = 4 * 1024 * 1024;
const WINDOWS_DISCOVERY_TIMEOUT_MS = 6000;

type LocalAppLauncher = "Windows 开始菜单" | "Windows 应用目录" | "已安装应用" | "PATH" | "Steam" | "Windows 应用文件查找" | "用户指定路径";

export interface WindowsAppSnapshot {
  appsFolder: Array<{ name: string; appId: string }>;
  registered: Array<{ name: string; displayIcon: string; appPath: string }>;
  driveRoots?: string[];
}

interface RunCandidates {
  ids: Set<string>;
  pathQuery: string | null;
}

export interface LocalAppEntry {
  id: string;
  name: string;
  launcher: LocalAppLauncher;
  kind: "app" | "game";
  /** Internal-only process target; never returned to the model. */
  executable: string;
  /** Internal-only, fixed-shape arguments; never returned to the model. */
  args: string[];
  /** Matched filename/folder labels that aid the model's natural-language candidate comparison. */
  searchAliases?: string[];
}

export interface LocalAppSummary {
  id: string;
  name: string;
  launcher: LocalAppEntry["launcher"];
  kind: LocalAppEntry["kind"];
  searchAliases?: string[];
  launchCount: number;
  lastLaunchAt: string | null;
}

interface LocalAppLaunchResult {
  status: string;
  app: string;
  launcher: string;
  game: boolean;
  runningState: string;
}

export interface LocalAppsRuntimeOptions {
  platform?: string;
  env?: NodeJS.ProcessEnv;
  /** Test seam; production reads only the current Windows Steam registration. */
  getSteamRoot?: () => Promise<string | null>;
  /** Test seam; production reads Windows' app index and registered app paths. */
  getWindowsAppSnapshot?: (signal?: AbortSignal) => Promise<WindowsAppSnapshot>;
  /** Test seam; production starts only the validated Explorer/Steam targets below. */
  launchProcess?: (executable: string, args: string[], signal?: AbortSignal, workingDirectory?: string) => Promise<void>;
  /** Test seam; production uses the bounded portable-app scanner. */
  discoverPortableApps?: (rootPaths: string[], query: string, signal?: AbortSignal) => Promise<{ entries: LocalAppEntry[]; truncated: boolean; warnings: string[] }>;
  now?: () => number;
}

function isPathInside(parentPath: string, childPath: string): boolean {
  const childRelative = relative(resolve(parentPath), resolve(childPath));
  return childRelative === "" || (childRelative !== ".." && !childRelative.startsWith(`..${sep}`) && !isAbsolute(childRelative));
}

function decodeVdfString(value: string): string {
  return value.replace(/\\(["\\])/gu, "$1");
}

function findVdfValue(source: string, key: string): string | null {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = new RegExp(`"${escapedKey}"\\s+"((?:[^"\\\\]|\\\\.)*)"`, "iu").exec(source);
  return match ? decodeVdfString(match[1]!) : null;
}

function vdfValues(source: string, key: string): string[] {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const expression = new RegExp(`"${escapedKey}"\\s+"((?:[^"\\\\]|\\\\.)*)"`, "giu");
  return [...source.matchAll(expression)].map(match => decodeVdfString(match[1]!));
}

function safeDisplayName(value: string): string | null {
  const name = value.replace(/[\u0000-\u001f\u007f]/gu, "").trim().slice(0, 120);
  if (!name || /^(?:uninstall|uninstaller|remove|卸载)(?:\b|$)/iu.test(name)) return null;
  return name;
}

function startMenuRoots(env: NodeJS.ProcessEnv): string[] {
  const roots = [
    env.APPDATA ? join(env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs") : "",
    (env.ProgramData ?? env.PROGRAMDATA) ? join((env.ProgramData ?? env.PROGRAMDATA)!, "Microsoft", "Windows", "Start Menu", "Programs") : ""
  ].filter(Boolean);
  return [...new Set(roots.map(path => resolve(path)))];
}

function explorerExecutable(env: NodeJS.ProcessEnv): string | null {
  const systemRoot = env.SystemRoot ?? env.WINDIR;
  return systemRoot ? join(systemRoot, "explorer.exe") : null;
}

const WINDOWS_APP_SNAPSHOT_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$driveRoots = @(Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Root -match '^[A-Za-z]:\\$' -and -not $_.DisplayRoot } | Select-Object -First 16 -ExpandProperty Root)
$appsFolder = @(Get-StartApps | Where-Object { $_.Name -and $_.AppID } | Select-Object -First 1500 @{Name='name';Expression={$_.Name}}, @{Name='appId';Expression={$_.AppID}})
$registered = @()
$uninstallRoots = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
)
foreach ($root in $uninstallRoots) {
  foreach ($entry in (Get-ItemProperty -Path ($root + '\*'))) {
    if ($entry.DisplayName -and ($entry.DisplayIcon -or $entry.InstallLocation)) {
      $registered += [pscustomobject]@{ name=[string]$entry.DisplayName; displayIcon=[string]$entry.DisplayIcon; appPath=[string]$entry.InstallLocation }
    }
    if ($registered.Count -ge 1500) { break }
  }
  if ($registered.Count -ge 1500) { break }
}
$appPaths = @()
$appPathRoots = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths'
)
foreach ($root in $appPathRoots) {
  foreach ($key in (Get-ChildItem -LiteralPath $root)) {
    $target = [string]$key.GetValue('')
    if ($target) { $appPaths += [pscustomobject]@{ name=[string]$key.PSChildName; displayIcon=''; appPath=$target } }
    if ($appPaths.Count -ge 1500) { break }
  }
  if ($appPaths.Count -ge 1500) { break }
}
[pscustomobject]@{ appsFolder=@($appsFolder); registered=@($registered + $appPaths); driveRoots=@($driveRoots) } | ConvertTo-Json -Depth 4 -Compress
`;

function queryWindowsAppSnapshot(env: NodeJS.ProcessEnv, signal?: AbortSignal): Promise<WindowsAppSnapshot> {
  const systemRoot = env.SystemRoot ?? env.WINDIR;
  if (!systemRoot) return Promise.reject(new Error("未找到 Windows 系统目录。"));
  if (signal?.aborted) return Promise.reject(new DOMException("本机应用查询已取消。", "AbortError"));
  const powershell = join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  return new Promise((resolveResult, reject) => {
    nodeExecFile(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", WINDOWS_APP_SNAPSHOT_SCRIPT], {
      windowsHide: true,
      timeout: WINDOWS_DISCOVERY_TIMEOUT_MS,
      maxBuffer: MAX_WINDOWS_DISCOVERY_BYTES,
      ...(signal ? { signal } : {})
    }, (error, stdout) => {
      if (error) { reject(error); return; }
      try {
        const parsed = JSON.parse(stdout) as Partial<WindowsAppSnapshot>;
        resolveResult({
          appsFolder: Array.isArray(parsed.appsFolder) ? parsed.appsFolder.slice(0, MAX_WINDOWS_APP_RECORDS) : [],
          registered: Array.isArray(parsed.registered) ? parsed.registered.slice(0, MAX_WINDOWS_APP_RECORDS * 2) : [],
          driveRoots: Array.isArray(parsed.driveRoots) ? parsed.driveRoots.filter((root): root is string => typeof root === "string").slice(0, 16) : []
        });
      } catch { reject(new Error("Windows 应用目录返回了无效数据。")); }
    });
  });
}

function parseRegisteredExecutable(value: string, env: NodeJS.ProcessEnv): string | null {
  let source = value.trim();
  if (!source) return null;
  const quoted = /^"([^"\r\n]+\.exe)"(?:\s*,\s*-?\d+)?\s*$/iu.exec(source);
  if (quoted) source = quoted[1]!;
  else {
    const unquoted = /^(.+?\.exe)(?:\s*,\s*-?\d+)?\s*$/iu.exec(source);
    if (!unquoted) return null;
    source = unquoted[1]!;
  }
  source = source.replace(/%([^%]+)%/gu, (_match, name: string) => env[name] ?? env[name.toUpperCase()] ?? `%${name}%`);
  if (!isAbsolute(source) || extname(source).toLocaleLowerCase("en-US") !== ".exe") return null;
  if (/^(?:unins\d*|uninstall(?:er)?|remove|setup|installer)\.exe$/iu.test(basename(source))) return null;
  return resolve(source);
}

function safeAppFolderId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const appId = value.trim();
  return appId.length > 0 && appId.length <= 260 && /^[\p{L}\p{N}_.!{}-]+$/u.test(appId) ? appId : null;
}

function searchableText(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function initials(value: string): string {
  return value.match(/[\p{L}\p{N}]+/gu)?.map(token => [...token][0] ?? "").join("").toLocaleLowerCase() ?? "";
}

function appNameQueryVariants(query: string): string[] {
  const phrases = query.split(/[|;,\n]/u).map(value => value.trim()).filter(Boolean);
  const variants = new Set<string>();
  for (const phrase of phrases) {
    variants.add(phrase);
    const simplified = phrase
      .replace(/^\s*(?:(?:麻烦(?:你)?|请|帮我|帮忙|给我|我想要|我想|我需要|能不能|能否|可以帮我|打开一下|启动一下|运行一下|打开|启动|运行)\s*)+/u, "")
      .replace(/(?:的)?(?:启动器|客户端|应用程序|应用|程序|软件|工具|一下)\s*$/u, "")
      .trim();
    if (simplified && simplified !== phrase) variants.add(simplified);
  }
  return [...variants].slice(0, 8);
}

function appNameMatch(name: string, query: string): boolean {
  const normalizedName = searchableText(name);
  return appNameQueryVariants(query).some(variant => {
    const normalizedQuery = searchableText(variant);
    if (!normalizedQuery) return false;
    const words = variant.match(/[\p{L}\p{N}]+/gu)?.map(searchableText).filter(word => word.length > 1) ?? [];
    return normalizedName.includes(normalizedQuery)
      || normalizedName.startsWith(normalizedQuery)
      || initials(name).startsWith(normalizedQuery)
      || (words.length > 1 && words.every(word => normalizedName.includes(word)));
  });
}

function appNameMatchScore(name: string, query: string): number {
  const normalizedName = searchableText(name);
  const variants = appNameQueryVariants(query).map(searchableText).filter(Boolean);
  return Math.min(...variants.map(variant => normalizedName === variant ? 0
    : normalizedName.startsWith(variant) ? 1
      : initials(name).startsWith(variant) ? 2
        : normalizedName.includes(variant) ? 3 : 4));
}

function appEntryMatchScore(entry: LocalAppEntry, query: string): number {
  return Math.min(appNameMatchScore(entry.name, query), ...(entry.searchAliases ?? []).map(alias => appNameMatchScore(alias, query)));
}

function findMatchingApps(entries: LocalAppEntry[], query: string): LocalAppEntry[] {
  return entries
    .filter(entry => appNameMatch(entry.name, query) || (entry.searchAliases ?? []).some(alias => appNameMatch(alias, query)))
    .sort((left, right) => appEntryMatchScore(left, query) - appEntryMatchScore(right, query) || left.name.localeCompare(right.name));
}

interface PortableAppDirectory { path: string; depth: number; matchedFolders: string[]; }

async function scanPortableExecutables(rootPaths: string[], query: string, signal?: AbortSignal): Promise<{ entries: LocalAppEntry[]; truncated: boolean; warnings: string[] }> {
  const entries: LocalAppEntry[] = [];
  const warnings = new Set<string>();
  const normalizedRoots = rootPaths.filter(isAbsolute).map(path => {
    const resolved = resolve(path);
    return /^[A-Za-z]:\\$/u.test(resolved) ? resolved : resolved.replace(/[\\/]+$/u, "");
  });
  const pending: PortableAppDirectory[] = [...new Set(normalizedRoots)].map(path => ({ path, depth: 0, matchedFolders: [] }));
  const visited = new Set<string>();
  const skippedDirectoryNames = new Set(["$recycle.bin", "system volume information", "windows", "windowsapps", "perflogs", "recovery"]);
  const deadline = Date.now() + PORTABLE_APP_SEARCH_BUDGET_MS;
  let visitedDirectories = 0;
  let visitedEntries = 0;
  let truncated = false;

  while (pending.length > 0) {
    if (signal?.aborted) throw new DOMException("便携应用查找已取消。", "AbortError");
    if (Date.now() >= deadline || visitedDirectories >= MAX_PORTABLE_APP_DIRECTORIES || visitedEntries >= MAX_PORTABLE_APP_ENTRIES || entries.length >= MAX_PORTABLE_APP_MATCHES) {
      truncated = true;
      break;
    }
    const current = pending.shift()!;
    const directoryKey = resolve(current.path).toLocaleLowerCase("en-US");
    if (visited.has(directoryKey)) continue;
    visited.add(directoryKey);
    visitedDirectories += 1;
    let directory;
    try { directory = await opendir(current.path); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" && (error as NodeJS.ErrnoException).code !== "ENOTDIR") warnings.add("部分本机应用目录不可读取。");
      continue;
    }
    const prioritizedDirectories: PortableAppDirectory[] = [];
    const remainingDirectories: PortableAppDirectory[] = [];
    try {
      for await (const item of directory) {
        if (signal?.aborted) throw new DOMException("便携应用查找已取消。", "AbortError");
        visitedEntries += 1;
        if (visitedEntries >= MAX_PORTABLE_APP_ENTRIES || Date.now() >= deadline) { truncated = true; break; }
        const itemPath = join(current.path, item.name);
        if (item.isDirectory()) {
          if (current.depth >= MAX_PORTABLE_APP_DEPTH || skippedDirectoryNames.has(item.name.toLocaleLowerCase("en-US"))) continue;
          const matchedFolder = safeDisplayName(item.name);
          const matchedFolders = matchedFolder && appNameMatch(matchedFolder, query)
            ? [...current.matchedFolders, matchedFolder].slice(-2)
            : current.matchedFolders;
          const candidate = { path: itemPath, depth: current.depth + 1, matchedFolders };
          (matchedFolders.length > current.matchedFolders.length ? prioritizedDirectories : remainingDirectories).push(candidate);
          continue;
        }
        if (!item.isFile() || extname(item.name).toLocaleLowerCase("en-US") !== ".exe") continue;
        const filename = safeDisplayName(basename(item.name, extname(item.name)));
        if (!filename || (!appNameMatch(filename, query) && current.matchedFolders.length === 0)) continue;
        entries.push({
          id: applicationId("indexed", itemPath),
          name: filename,
          launcher: "Windows 应用文件查找",
          kind: "app",
          executable: resolve(itemPath),
          args: [],
          ...(current.matchedFolders.length ? { searchAliases: [...new Set(current.matchedFolders)] } : {})
        });
        if (entries.length >= MAX_PORTABLE_APP_MATCHES) { truncated = true; break; }
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      warnings.add("便携应用目录读取中断。");
    } finally {
      await directory.close().catch(() => undefined);
    }
    const availableDirectorySlots = Math.max(0, MAX_PORTABLE_APP_DIRECTORIES - visitedDirectories - pending.length);
    const scheduledDirectories = [...prioritizedDirectories, ...remainingDirectories];
    if (scheduledDirectories.length > availableDirectorySlots) truncated = true;
    pending.unshift(...scheduledDirectories.slice(0, availableDirectorySlots));
    if (truncated) break;
  }
  if (pending.length) truncated = true;
  if (truncated) warnings.add("便携应用查找达到本次扫描上限；可缩小应用名称后重试。");
  return { entries, truncated, warnings: [...warnings] };
}

function applicationId(source: string, value: string): string {
  return `${source}:${createHash("sha256").update(value.toLocaleLowerCase("en-US")).digest("hex").slice(0, 24)}`;
}

async function scanPathExecutables(env: NodeJS.ProcessEnv, query: string | undefined, signal?: AbortSignal): Promise<{ entries: LocalAppEntry[]; truncated: boolean; warnings: string[] }> {
  if (!query) return { entries: [], truncated: false, warnings: [] };
  const pathValue = env.Path ?? env.PATH ?? "";
  const directories = [...new Set(pathValue.split(";").map(part => part.trim().replace(/^"|"$/gu, "")).filter(isAbsolute).map(path => resolve(path)))].slice(0, MAX_WINDOWS_PATH_DIRECTORIES);
  const entries: LocalAppEntry[] = [];
  const warnings = new Set<string>();
  let visited = 0;
  let truncated = pathValue.split(";").length > MAX_WINDOWS_PATH_DIRECTORIES;
  for (const directoryPath of directories) {
    if (signal?.aborted) throw new DOMException("本机应用查询已取消。", "AbortError");
    let directory;
    try { directory = await opendir(directoryPath); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" && (error as NodeJS.ErrnoException).code !== "ENOTDIR") warnings.add("部分 PATH 目录不可读取。");
      continue;
    }
    try {
      for await (const item of directory) {
        if (signal?.aborted) throw new DOMException("本机应用查询已取消。", "AbortError");
        visited += 1;
        if (visited > MAX_WINDOWS_PATH_ENTRIES) { truncated = true; break; }
        if (!item.isFile() || extname(item.name).toLocaleLowerCase("en-US") !== ".exe") continue;
        const name = safeDisplayName(basename(item.name, extname(item.name)));
        if (!name || !appNameMatch(name, query)) continue;
        const executable = resolve(directoryPath, item.name);
        entries.push({ id: applicationId("path", executable), name, launcher: "PATH", kind: "app", executable, args: [] });
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      warnings.add("部分 PATH 目录读取中断。");
    } finally { await directory.close().catch(() => undefined); }
    if (visited > MAX_WINDOWS_PATH_ENTRIES) break;
  }
  return { entries, truncated, warnings: [...warnings] };
}

async function scanStartMenu(rootPaths: string[], signal?: AbortSignal): Promise<{ entries: LocalAppEntry[]; truncated: boolean; warnings: string[] }> {
  const entries: LocalAppEntry[] = [];
  const warnings = new Set<string>();
  const seen = new Set<string>();
  const pending = rootPaths.map(path => ({ path, depth: 0 }));
  let visitedDirectories = 0;
  let visitedEntries = 0;
  let truncated = false;

  while (pending.length > 0 && entries.length < MAX_START_MENU_ITEMS) {
    if (signal?.aborted) throw new DOMException("本机应用查询已取消。", "AbortError");
    const current = pending.shift()!;
    if (current.depth > MAX_DIRECTORY_DEPTH || visitedDirectories >= MAX_START_MENU_DIRECTORIES) {
      truncated = true;
      continue;
    }
    visitedDirectories += 1;
    let directory;
    try { directory = await opendir(current.path); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") warnings.add("部分 Windows 开始菜单目录不可读取。");
      continue;
    }
    try {
      for await (const item of directory) {
        if (signal?.aborted) throw new DOMException("本机应用查询已取消。", "AbortError");
        visitedEntries += 1;
        if (visitedEntries > MAX_DIRECTORY_ENTRIES) { truncated = true; break; }
        const itemPath = join(current.path, item.name);
        if (item.isDirectory()) {
          if (current.depth < MAX_DIRECTORY_DEPTH) pending.push({ path: itemPath, depth: current.depth + 1 });
          continue;
        }
        if (!item.isFile() || !/\.lnk$/iu.test(item.name)) continue;
        const name = safeDisplayName(item.name.replace(/\.lnk$/iu, ""));
        if (!name) continue;
        const normalizedPath = resolve(itemPath);
        const key = normalizedPath.toLocaleLowerCase("en-US");
        if (seen.has(key) || !rootPaths.some(root => isPathInside(root, normalizedPath))) continue;
        seen.add(key);
        const id = `shortcut:${createHash("sha256").update(normalizedPath).digest("hex").slice(0, 24)}`;
        entries.push({ id, name, launcher: "Windows 开始菜单", kind: "app", executable: "explorer.exe", args: [normalizedPath] });
        if (entries.length >= MAX_START_MENU_ITEMS) { truncated = true; break; }
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      warnings.add("部分 Windows 开始菜单目录读取中断。");
    } finally {
      await directory.close().catch(() => undefined);
    }
  }
  if (pending.length > 0) truncated = true;
  return { entries, truncated, warnings: [...warnings] };
}

function querySteamRootFromRegistry(): Promise<string | null> {
  if (process.platform !== "win32") return Promise.resolve(null);
  const systemRoot = process.env.SystemRoot ?? process.env.WINDIR;
  if (!systemRoot) return Promise.resolve(null);
  const registryExecutable = join(systemRoot, "System32", "reg.exe");
  const keys = [
    ["HKCU\\Software\\Valve\\Steam", "SteamPath"],
    ["HKLM\\Software\\WOW6432Node\\Valve\\Steam", "InstallPath"],
    ["HKLM\\Software\\Valve\\Steam", "InstallPath"]
  ] as const;
  return new Promise(resolveResult => {
    let pending = keys.length;
    let settled = false;
    for (const key of keys) {
      nodeExecFile(registryExecutable, ["query", key[0], "/v", key[1]], { windowsHide: true, timeout: 1500, maxBuffer: 32 * 1024 }, (error, stdout) => {
        if (!settled && !error) {
          const match = new RegExp(`^\\s*${key[1]}\\s+REG_(?:SZ|EXPAND_SZ)\\s+(.+?)\\s*$`, "imu").exec(stdout);
          if (match?.[1]) {
            settled = true;
            resolveResult(resolve(match[1].replace(/\//gu, "\\")));
            return;
          }
        }
        pending -= 1;
        if (!settled && pending === 0) resolveResult(null);
      });
    }
  });
}

async function existingDirectory(path: string): Promise<boolean> {
  try { return (await stat(path)).isDirectory(); }
  catch { return false; }
}

async function existingFile(path: string): Promise<boolean> {
  try { return (await stat(path)).isFile(); }
  catch { return false; }
}

async function steamLibraries(steamRoot: string): Promise<string[]> {
  const roots = [resolve(steamRoot)];
  const libraryFile = join(steamRoot, "steamapps", "libraryfolders.vdf");
  try {
    const details = await stat(libraryFile);
    if (!details.isFile() || details.size > MAX_LIBRARY_FILE_BYTES) return roots;
    const source = await readFile(libraryFile, "utf8");
    for (const libraryPath of vdfValues(source, "path").slice(0, MAX_STEAM_LIBRARIES - 1)) {
      if (!isAbsolute(libraryPath)) continue;
      const normalized = resolve(libraryPath);
      if (!roots.some(root => root.toLocaleLowerCase("en-US") === normalized.toLocaleLowerCase("en-US"))) roots.push(normalized);
    }
  } catch { /* Steam may use its primary library without a libraryfolders file. */ }
  return roots.slice(0, MAX_STEAM_LIBRARIES);
}

async function discoverSteamGames(steamRoot: string | null, signal?: AbortSignal): Promise<{ entries: LocalAppEntry[]; warnings: string[] }> {
  if (!steamRoot || !(await existingDirectory(steamRoot))) return { entries: [], warnings: [] };
  const executable = join(steamRoot, "steam.exe");
  try { if (!(await stat(executable)).isFile()) return { entries: [], warnings: ["检测到 Steam 目录，但未找到 Steam 客户端程序。"] }; }
  catch { return { entries: [], warnings: ["检测到 Steam 目录，但未找到 Steam 客户端程序。"] }; }

  const libraries = await steamLibraries(steamRoot);
  const entries: LocalAppEntry[] = [];
  const warnings = new Set<string>();
  let scannedManifestCount = 0;
  let scannedManifestBytes = 0;
  for (const library of libraries) {
    if (signal?.aborted) throw new DOMException("本机游戏查询已取消。", "AbortError");
    const manifestsPath = join(library, "steamapps");
    let directory;
    try { directory = await opendir(manifestsPath); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") warnings.add("部分 Steam 游戏库不可读取。");
      continue;
    }
    try {
      for await (const item of directory) {
        if (signal?.aborted) throw new DOMException("本机游戏查询已取消。", "AbortError");
        const filenameMatch = /^appmanifest_(\d+)\.acf$/iu.exec(item.name);
        if (!item.isFile() || !filenameMatch) continue;
        scannedManifestCount += 1;
        if (scannedManifestCount > MAX_STEAM_MANIFESTS) {
          warnings.add("Steam 游戏清单数量达到本次扫描上限。");
          return { entries, warnings: [...warnings] };
        }
        const appId = Number(filenameMatch[1]);
        if (!Number.isSafeInteger(appId) || appId <= 0 || appId > 2_147_483_647) continue;
        const manifestPath = join(manifestsPath, item.name);
        try {
          const details = await stat(manifestPath);
          if (details.size > MAX_MANIFEST_BYTES) continue;
          if (scannedManifestBytes + details.size > MAX_STEAM_MANIFEST_TOTAL_BYTES) {
            warnings.add("Steam 游戏清单读取达到本次总字节上限。");
            return { entries, warnings: [...warnings] };
          }
          scannedManifestBytes += details.size;
          const source = await readFile(manifestPath, "utf8");
          const manifestAppId = Number(findVdfValue(source, "appid"));
          const name = safeDisplayName(findVdfValue(source, "name") ?? "");
          const installDirectory = findVdfValue(source, "installdir");
          if (manifestAppId !== appId || !name || !installDirectory) continue;
          const commonDirectory = join(manifestsPath, "common");
          const installPath = resolve(commonDirectory, installDirectory);
          if (!isPathInside(commonDirectory, installPath) || !(await existingDirectory(installPath))) continue;
          entries.push({ id: `steam:${appId}`, name, launcher: "Steam", kind: "game", executable, args: ["-applaunch", String(appId)] });
        } catch { warnings.add("部分 Steam 游戏清单无法读取或校验。"); }
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      warnings.add("Steam 游戏清单读取中断。");
    } finally {
      await directory.close().catch(() => undefined);
    }
  }
  return { entries, warnings: [...warnings] };
}

export function createWindowsProcessLauncher(spawnProcess: typeof nodeSpawn = nodeSpawn) {
  return async (executable: string, args: string[], signal?: AbortSignal, workingDirectory?: string): Promise<void> => {
    if (signal?.aborted) throw new DOMException("启动请求已取消。", "AbortError");
    await new Promise<void>((resolveResult, reject) => {
      const child = spawnProcess(executable, args, {
        shell: false,
        windowsHide: true,
        detached: true,
        stdio: "ignore",
        ...(workingDirectory ? { cwd: workingDirectory } : {})
      });
      const onSpawn = () => {
        child.unref();
        resolveResult();
      };
      const onError = (error: Error) => {
        reject(new Error(`Windows 未能接收启动请求：${error.message}`));
      };
      child.once("spawn", onSpawn);
      child.once("error", onError);
    });
  };
}

interface LaunchCount { count: number; lastLaunchAt: number; }

export function createLocalAppsRuntime(runtimeOptions: LocalAppsRuntimeOptions = {}) {
  const options: Required<Pick<LocalAppsRuntimeOptions, "platform" | "env" | "now">> & LocalAppsRuntimeOptions = {
    ...runtimeOptions,
    platform: runtimeOptions.platform ?? process.platform,
    env: runtimeOptions.env ?? process.env,
    now: runtimeOptions.now ?? Date.now
  };
  const historyByUser = new Map<string, Map<string, LaunchCount>>();
  const latestEntries = new Map<string, LocalAppEntry>();
  const candidatesByRun = new Map<string, RunCandidates>();
  const activeLaunches = new Set<Promise<unknown>>();
  let disposed = false;

  function runKey(userId: string, agentRunId: string): string {
    return JSON.stringify([userId, agentRunId]);
  }

  function rememberCandidates(userId: string, agentRunId: string, ids: string[], pathQuery: string | null = null): void {
    const key = runKey(userId, agentRunId);
    const candidates = candidatesByRun.get(key) ?? { ids: new Set<string>(), pathQuery };
    candidates.ids.clear();
    candidates.pathQuery = pathQuery;
    for (const id of ids) {
      candidates.ids.delete(id);
      candidates.ids.add(id);
      while (candidates.ids.size > MAX_CANDIDATES_PER_RUN) candidates.ids.delete(candidates.ids.values().next().value!);
    }
    candidatesByRun.delete(key);
    candidatesByRun.set(key, candidates);
    while (candidatesByRun.size > MAX_CANDIDATE_RUNS) candidatesByRun.delete(candidatesByRun.keys().next().value!);
  }

  function consumeCandidate(userId: string, agentRunId: string, id: string): string | null | undefined {
    const key = runKey(userId, agentRunId);
    const candidates = candidatesByRun.get(key);
    if (!candidates?.ids.delete(id)) return undefined;
    if (candidates.ids.size === 0) candidatesByRun.delete(key);
    return candidates.pathQuery;
  }

  function clearRun(userId: string, agentRunId: string): void {
    candidatesByRun.delete(runKey(userId, agentRunId));
  }

  const discover = async (signal?: AbortSignal, pathQuery?: string) => {
    if (disposed) throw new Error("本机应用能力正在卸载，已拒绝新操作。");
    if (options.platform !== "win32") throw new Error("本机应用发现仅在 Windows 桌面 Profile 中可用。");
    const getSteamRoot = options.getSteamRoot ?? querySteamRootFromRegistry;
    const getWindowsAppSnapshot = options.getWindowsAppSnapshot ?? (currentSignal => queryWindowsAppSnapshot(options.env, currentSignal));
    const [startMenu, steamRoot, windowsApps, pathApps] = await Promise.all([
      scanStartMenu(startMenuRoots(options.env), signal),
      getSteamRoot().catch(() => null),
      getWindowsAppSnapshot(signal).catch(error => {
        if (signal?.aborted) throw error;
        return null;
      }),
      scanPathExecutables(options.env, pathQuery, signal)
    ]);
    const steamResult = await discoverSteamGames(steamRoot, signal);
    if (!steamRoot) steamResult.warnings.push("未检测到已注册的 Steam 客户端；Steam 游戏库不可读取。");
    const windowsEntries: LocalAppEntry[] = [];
    const explorer = explorerExecutable(options.env);
    if (windowsApps) {
      for (const record of windowsApps.appsFolder) {
        const name = typeof record.name === "string" ? safeDisplayName(record.name) : null;
        const appId = safeAppFolderId(record.appId);
        if (!name || !appId || !explorer) continue;
        windowsEntries.push({ id: applicationId("appsfolder", appId), name, launcher: "Windows 应用目录", kind: "app", executable: explorer, args: [`shell:AppsFolder\\${appId}`] });
      }
      const registeredSeen = new Set<string>();
      for (const record of windowsApps.registered) {
        const rawName = typeof record.name === "string" ? record.name : "";
        const name = safeDisplayName(rawName.replace(/\.exe$/iu, ""));
        const executable = typeof record.displayIcon === "string" ? parseRegisteredExecutable(record.displayIcon, options.env)
          : null;
        const target = executable ?? (typeof record.appPath === "string" ? parseRegisteredExecutable(record.appPath, options.env) : null);
        if (!name || !target || registeredSeen.has(target.toLocaleLowerCase("en-US")) || !(await existingFile(target))) continue;
        registeredSeen.add(target.toLocaleLowerCase("en-US"));
        windowsEntries.push({ id: applicationId("registered", target), name, launcher: "已安装应用", kind: "app", executable: target, args: [] });
      }
    }
    const nativeWarnings = windowsApps ? [] : ["Windows 应用目录和已安装软件登记暂时不可读取。"];
    const knownEntries = [...steamResult.entries, ...startMenu.entries, ...windowsEntries, ...pathApps.entries];
    const knownMatchExists = pathQuery !== undefined && knownEntries.some(entry =>
      appNameMatch(entry.name, pathQuery)
      || (entry.searchAliases ?? []).some(alias => appNameMatch(alias, pathQuery)));
    const portableApps = pathQuery && !knownMatchExists && windowsApps?.driveRoots?.length
      ? await (options.discoverPortableApps ?? scanPortableExecutables)(windowsApps.driveRoots, pathQuery, signal)
      : { entries: [] as LocalAppEntry[], truncated: false, warnings: [] as string[] };
    const knownExecutablePaths = new Map<string, LocalAppEntry>();
    for (const entry of knownEntries) {
      if (entry.launcher === "Steam" || entry.launcher === "Windows 开始菜单" || entry.launcher === "Windows 应用目录") continue;
      knownExecutablePaths.set(resolve(entry.executable).toLocaleLowerCase("en-US"), entry);
    }
    for (const portableEntry of portableApps.entries) {
      const key = resolve(portableEntry.executable).toLocaleLowerCase("en-US");
      const existing = knownExecutablePaths.get(key);
      if (existing) {
        existing.searchAliases = [...new Set([...(existing.searchAliases ?? []), ...(portableEntry.searchAliases ?? [])])].slice(0, 4);
      } else {
        knownExecutablePaths.set(key, portableEntry);
      }
    }
    const entries = [...steamResult.entries, ...startMenu.entries, ...windowsEntries, ...pathApps.entries, ...portableApps.entries.filter(entry => knownExecutablePaths.get(resolve(entry.executable).toLocaleLowerCase("en-US")) === entry)].slice(0, MAX_START_MENU_ITEMS + MAX_STEAM_MANIFESTS + MAX_WINDOWS_APP_RECORDS * 2 + MAX_WINDOWS_PATH_ENTRIES + MAX_PORTABLE_APP_MATCHES);
    let launchableEntries = entries;
    if (explorer) {
      for (const entry of entries) {
        if (entry.launcher === "Windows 开始菜单") entry.executable = explorer;
      }
    } else {
      launchableEntries = entries.filter(entry => entry.launcher !== "Windows 开始菜单" && entry.launcher !== "Windows 应用目录");
    }
    latestEntries.clear();
    for (const entry of launchableEntries) latestEntries.set(entry.id, entry);
    return {
      entries: launchableEntries,
      truncated: startMenu.truncated || pathApps.truncated || portableApps.truncated || steamResult.warnings.some(warning => warning.includes("上限")),
      warnings: [...new Set([...startMenu.warnings, ...pathApps.warnings, ...portableApps.warnings, ...nativeWarnings, ...steamResult.warnings, ...(!explorer ? ["未找到 Windows 系统目录；开始菜单和 Windows 应用目录目标不可启动。"] : [])])]
    };
  };

  function historyFor(userId: string): Map<string, LaunchCount> {
    let history = historyByUser.get(userId);
    if (!history) {
      history = new Map();
      historyByUser.set(userId, history);
      if (historyByUser.size > MAX_RECORDED_USERS) historyByUser.delete(historyByUser.keys().next().value!);
    } else {
      historyByUser.delete(userId);
      historyByUser.set(userId, history);
    }
    return history;
  }

  function recordLaunch(userId: string, id: string): void {
    const history = historyFor(userId);
    const now = options.now();
    const previous = history.get(id);
    history.set(id, { count: Math.min((previous?.count ?? 0) + 1, 1_000_000), lastLaunchAt: now });
    if (history.size > MAX_HISTORY_PER_USER) {
      const oldest = [...history.entries()].sort((left, right) => left[1].lastLaunchAt - right[1].lastLaunchAt)[0];
      if (oldest) history.delete(oldest[0]);
    }
  }

  function publicSummary(entry: LocalAppEntry, history: Map<string, LaunchCount>): LocalAppSummary {
    const usage = history.get(entry.id);
    return {
      id: entry.id,
      name: entry.name,
      launcher: entry.launcher,
      kind: entry.kind,
      ...(entry.searchAliases?.length ? { searchAliases: entry.searchAliases } : {}),
      launchCount: usage?.count ?? 0,
      lastLaunchAt: usage ? new Date(usage.lastLaunchAt).toISOString() : null
    };
  }

  async function launchEntry(entry: LocalAppEntry, userId: string, isEnabled: (userId: string) => boolean, signal?: AbortSignal): Promise<LocalAppLaunchResult> {
    if (disposed) throw new Error("本机应用能力正在卸载，已拒绝新操作。");
    if (!isEnabled(userId)) throw new Error("请先在设置中心启用本机电脑操控。");
    if (signal?.aborted) throw new DOMException("启动请求已取消。", "AbortError");
    const launchProcess = options.launchProcess ?? createWindowsProcessLauncher();
    await launchProcess(entry.executable, [...entry.args], signal, entry.launcher === "Windows 应用文件查找" ? dirname(entry.executable) : undefined);
    if (disposed) throw new Error("Windows 已接收启动请求；Profile 正在卸载，游戏运行状态未知。");
    if (entry.kind === "game") recordLaunch(userId, entry.id);
    return { status: "launch_requested", app: entry.name, launcher: entry.launcher, game: entry.kind === "game", runningState: "unverified" };
  }

  function trackLaunch<T>(pending: Promise<T>): Promise<T> {
    activeLaunches.add(pending);
    return pending.finally(() => activeLaunches.delete(pending));
  }

  return {
    async search(query: string, userId: string, agentRunId: string, signal?: AbortSignal) {
      if (disposed) throw new Error("本机应用能力正在卸载，已拒绝新操作。");
      const normalizedQuery = query.trim().toLocaleLowerCase();
      if (!normalizedQuery) throw new Error("请提供要查找的应用或游戏名称。");
      const { entries, truncated, warnings } = await discover(signal, query);
      if (disposed) throw new Error("本机应用能力已卸载；查询结果已丢弃。");
      const matches = findMatchingApps(entries, query);
      const history = historyFor(userId);
      const results = matches.slice(0, MAX_SEARCH_RESULTS).map(entry => publicSummary(entry, history));
      rememberCandidates(userId, agentRunId, results.map(entry => entry.id), query);
      return { matches: results, totalMatches: matches.length, truncated, warnings };
    },

    launchByQuery(query: string, userId: string, agentRunId: string, isEnabled: (userId: string) => boolean, signal?: AbortSignal) {
      if (disposed) return Promise.reject(new Error("本机应用能力正在卸载，已拒绝新操作。"));
      const pending = (async () => {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        if (!normalizedQuery) throw new Error("请提供要启动的应用或游戏名称。");
        if (!isEnabled(userId)) throw new Error("请先在设置中心启用本机电脑操控。");
        const { entries, truncated, warnings } = await discover(signal, query);
        if (disposed) throw new Error("本机应用能力已卸载；查询结果已丢弃。");
        if (!isEnabled(userId)) throw new Error("电脑操控授权已关闭；未发出启动请求。");
        const matches = findMatchingApps(entries, query);
        const history = historyFor(userId);
        const results = matches.slice(0, MAX_SEARCH_RESULTS).map(entry => publicSummary(entry, history));
        if (matches.length === 0) return { status: "not_found" as const, query, matches: results, truncated, warnings };
        const best = matches[0]!;
        const bestScore = appEntryMatchScore(best, query);
        if (bestScore > 2 || matches.length !== 1 || truncated) {
          rememberCandidates(userId, agentRunId, results.map(entry => entry.id), query);
          return { status: "ambiguous" as const, query, matches: results, totalMatches: matches.length, truncated, warnings };
        }
        return launchEntry(best, userId, isEnabled, signal);
      })();
      return trackLaunch(pending);
    },

    async recommend(userId: string, agentRunId: string, signal?: AbortSignal) {
      if (disposed) throw new Error("本机应用能力正在卸载，已拒绝新操作。");
      const { entries, truncated, warnings } = await discover(signal);
      if (disposed) throw new Error("本机应用能力已卸载；查询结果已丢弃。");
      const history = historyFor(userId);
      const installedById = new Map(entries.map(entry => [entry.id, entry]));
      const launchHistory = [...history.entries()]
        .map(([id, usage]) => ({ entry: installedById.get(id), usage }))
        .filter((item): item is { entry: LocalAppEntry; usage: LaunchCount } => Boolean(item.entry))
      const frequentLaunches = [...launchHistory]
        .sort((left, right) => right.usage.count - left.usage.count || right.usage.lastLaunchAt - left.usage.lastLaunchAt)
        .slice(0, MAX_RECOMMENDATIONS)
        .map(({ entry }) => publicSummary(entry, history));
      const recentLaunches = [...launchHistory]
        .sort((left, right) => right.usage.lastLaunchAt - left.usage.lastLaunchAt)
        .slice(0, MAX_RECOMMENDATIONS)
        .map(({ entry }) => publicSummary(entry, history));
      const installedSteamGames = entries.filter(entry => entry.kind === "game").slice(0, MAX_RECOMMENDATIONS).map(entry => publicSummary(entry, history));
      rememberCandidates(userId, agentRunId, [...frequentLaunches, ...recentLaunches, ...installedSteamGames].map(entry => entry.id));
      return {
        historySource: "LFAA 当前 Control Plane 进程内的启动请求；不读取 Steam 账户或 LFAA 外活动。",
        hasLaunchHistory: launchHistory.length > 0,
        recommendations: frequentLaunches,
        recentLaunches,
        installedSteamGames,
        truncated,
        warnings
      };
    },

    launch(id: string, userId: string, agentRunId: string, isEnabled: (userId: string) => boolean, signal?: AbortSignal): Promise<{ status: string; app: string; launcher: string; game: boolean; runningState: string }> {
      if (disposed) return Promise.reject(new Error("本机应用能力正在卸载，已拒绝新操作。"));
      const pending = (async () => {
        if (!isEnabled(userId)) throw new Error("请先在设置中心启用本机电脑操控。");
        const pathQuery = consumeCandidate(userId, agentRunId, id);
        if (pathQuery === undefined) throw new Error("启动目标必须来自当前这轮对话刚返回的本机搜索或游戏推荐结果；请先查询并按当前用户目标确定真实目标。未启动任何程序。");
        const { entries } = await discover(signal, pathQuery ?? undefined);
        if (disposed) throw new Error("本机应用能力已卸载；未发出启动请求。");
        if (!isEnabled(userId)) throw new Error("电脑操控授权已关闭；未发出启动请求。");
        const entry = entries.find(candidate => candidate.id === id);
        if (!entry) throw new Error("Windows 应用目录、开始菜单、已安装应用登记、PATH 或 Steam 游戏库中未找到该目标，未启动任何程序；请重新搜索。");
        return launchEntry(entry, userId, isEnabled, signal);
      })();
      return trackLaunch(pending);
    },

    launchExecutablePath(executablePath: string, userId: string, isEnabled: (userId: string) => boolean, signal?: AbortSignal): Promise<{ status: string; app: string; launcher: string; game: false; runningState: string }> {
      if (disposed) return Promise.reject(new Error("本机应用能力正在卸载，已拒绝新操作。"));
      const pending = (async () => {
        if (options.platform !== "win32") throw new Error("本机可执行文件启动仅在 Windows Profile 中可用。未启动任何程序。");
        if (!isEnabled(userId)) throw new Error("请先在设置中心启用本机电脑操控。未启动任何程序。");
        if (typeof executablePath !== "string" || executablePath.length < 1 || executablePath.length > 32_760 || /[\u0000-\u001f\u007f]/u.test(executablePath)) {
          throw new Error("请提供有效的 Windows EXE 绝对路径；未启动任何程序。");
        }
        if (!isAbsolute(executablePath) || extname(executablePath).toLocaleLowerCase() !== ".exe") {
          throw new Error("只接受 Windows EXE 绝对路径；目录、相对路径和其他文件类型均不能启动。未启动任何程序。");
        }

        let resolvedExecutable: string;
        let executableInfo;
        try {
          resolvedExecutable = await realpath(executablePath);
          executableInfo = await stat(resolvedExecutable);
        } catch {
          throw new Error("指定路径无法解析或文件不存在；未启动任何程序。");
        }
        if (!executableInfo.isFile() || extname(resolvedExecutable).toLocaleLowerCase() !== ".exe") {
          throw new Error("指定路径不是有效的 Windows EXE 文件；未启动任何程序。");
        }
        if (disposed) throw new Error("本机应用能力已卸载；未发出启动请求。");
        if (!isEnabled(userId)) throw new Error("电脑操控授权已关闭；未发出启动请求。");
        if (signal?.aborted) throw new DOMException("启动请求已取消。", "AbortError");

        const launchProcess = options.launchProcess ?? createWindowsProcessLauncher();
        await launchProcess(resolvedExecutable, [], signal, dirname(resolvedExecutable));
        if (disposed) throw new Error("Windows 已接收启动请求；Profile 正在卸载，程序运行状态未知。");
        return { status: "launch_requested", app: basename(resolvedExecutable), launcher: "用户指定路径", game: false as const, runningState: "unverified" as const };
      })();
      activeLaunches.add(pending);
      return pending.finally(() => activeLaunches.delete(pending));
    },

    approvalLabel(id: string): { name: string; launcher: LocalAppEntry["launcher"] | "本机启动器" } {
      const entry = latestEntries.get(id);
      return { name: entry?.name ?? "已发现的本机应用或游戏", launcher: entry?.launcher ?? "本机启动器" };
    },

    clearRun,

    async dispose(): Promise<void> {
      disposed = true;
      await Promise.allSettled([...activeLaunches]);
      historyByUser.clear();
      latestEntries.clear();
      candidatesByRun.clear();
    }
  };
}
