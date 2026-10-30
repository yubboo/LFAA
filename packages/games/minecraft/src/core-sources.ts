/**
 * 功能：解析多核心版本、构建与经过校验的下载工件。
 * 作用：统一 PaperMC、FastMirror、Mojang 和 Mohist 来源，不接受浏览器提供下载地址或摘要。
 * 关联文件：catalog.ts 提供 Mojang 元数据；service.ts 与 deployment-service.ts 派发节点任务；核心面板消费目录接口。
 */
import { ApiError } from "lfaa-util-values/src/http-error.js";
import {fetchRuntimeResource} from "lfaa-runtime-environment/src/network.mjs";

export const minecraftCoreNames = ["Vanilla", "Paper", "Purpur", "Folia", "Leaves", "Fabric", "Forge", "Arclight", "CatServer", "SpongeForge", "SpongeNeo", "SpongeVanilla", "BungeeCord", "Velocity", "Nukkit", "PocketMine", "Youer"] as const;
export type MinecraftCoreName = typeof minecraftCoreNames[number];
export type CoreCategory = "pure" | "mod" | "vanilla" | "proxy" | "bedrock";
export type CoreLaunchKind = "jar" | "forge" | "sponge-forge" | "sponge-neo" | "php";
export type MinecraftServerType = "vanilla" | "plugin" | "modded" | "hybrid" | "proxy" | "bedrock";
export interface MinecraftCoreCompatibility {
  serverType: MinecraftServerType;
  compatibleContent: readonly string[];
}
export interface MinecraftCoreSummary {
  name: MinecraftCoreName; category: CoreCategory; versions: string[]; homepage: string;
  source: "papermc" | "fastmirror" | "mohist"; launchKind: CoreLaunchKind;
  serverType: MinecraftServerType; compatibleContent: readonly string[];
}
export interface MinecraftCoreBuild { id: string; updatedAt: string; digest: string; }
export interface CoreArtifact {
  core: MinecraftCoreName; version: string; build: string; category: CoreCategory; launchKind: CoreLaunchKind;
  url: string; algorithm: "sha1" | "sha256"; digest: string; filename: string;
  javaMajor: number; source: string; loaderArtifact?: { url: string; algorithm: "sha1"; digest: string } | undefined;
  phpArtifact?: { url: string; algorithm: "sha256"; digest: string } | undefined;
}
/** 核心目录 Owner 的能力分类；来源 category 另用于部署协议/端口行为，不能表示插件兼容性。 */
const coreCompatibility: Record<MinecraftCoreName, MinecraftCoreCompatibility> = {
  Vanilla: { serverType: "vanilla", compatibleContent: ["原版 Java 客户端；不提供模组加载器或服务端插件 API"] },
  Paper: { serverType: "plugin", compatibleContent: ["Bukkit/Spigot/Paper 插件；仍须核对目标游戏版本和插件 API"] },
  Purpur: { serverType: "plugin", compatibleContent: ["Bukkit/Spigot/Paper 插件；仍须核对目标游戏版本和插件 API"] },
  Folia: { serverType: "plugin", compatibleContent: ["Folia 兼容插件；不能默认认为所有 Paper 插件均兼容"] },
  Leaves: { serverType: "plugin", compatibleContent: ["Paper 兼容插件；仍须核对目标游戏版本和插件 API"] },
  Fabric: { serverType: "modded", compatibleContent: ["Fabric 加载器模组；不兼容 Bukkit/Spigot/Paper 插件"] },
  Forge: { serverType: "modded", compatibleContent: ["Forge 加载器模组；不兼容 Fabric 模组或 Bukkit/Spigot 插件"] },
  Arclight: { serverType: "hybrid", compatibleContent: ["对应版本支持的 Bukkit/Spigot 插件与模组加载器模组；具体兼容组合以该版本构建说明为准"] },
  CatServer: { serverType: "hybrid", compatibleContent: ["Forge 模组与 Bukkit/Spigot 插件；兼容性以该核心版本为准"] },
  SpongeForge: { serverType: "hybrid", compatibleContent: ["SpongeAPI 插件与 Forge 模组；插件类型不是 Bukkit API"] },
  SpongeNeo: { serverType: "hybrid", compatibleContent: ["SpongeAPI 插件与 NeoForge 模组；插件类型不是 Bukkit API"] },
  SpongeVanilla: { serverType: "plugin", compatibleContent: ["SpongeAPI 插件；不是 Bukkit API，也不加载 Forge 模组"] },
  BungeeCord: { serverType: "proxy", compatibleContent: ["Java 版多服代理及 BungeeCord 插件；需要已运行的后端服务器"] },
  Velocity: { serverType: "proxy", compatibleContent: ["Java 版多服代理及 Velocity 插件；需要已运行的后端服务器"] },
  Nukkit: { serverType: "bedrock", compatibleContent: ["基岩版客户端与 Nukkit 插件；不是 Java 版游戏服务端"] },
  PocketMine: { serverType: "bedrock", compatibleContent: ["基岩版客户端与 PocketMine-MP PHP 插件；使用 PHP 运行时，不使用 Java"] },
  Youer: { serverType: "hybrid", compatibleContent: ["NeoForge 模组与 Paper/Purpur API 插件；兼容性以该核心版本为准"] },
};
/** 给 AI 工具和目录调用方返回防变更副本，分类仍只有一个权威来源。 */
export function getMinecraftCoreCompatibility(core: string): MinecraftCoreCompatibility {
  const name = requireMinecraftCore(core);
  const profile = coreCompatibility[name];
  return { serverType: profile.serverType, compatibleContent: [...profile.compatibleContent] };
}
const fastMirrorBase = "https://download.fastmirror.net";
const mohistBase = "https://api.mohistmc.cn";
const paperBase = "https://fill.papermc.io/v3/projects/paper";
const cache = new Map<string, { expiresAt: number; data: unknown }>();
const jsonSourceHosts = ["download.fastmirror.net", "api.mohistmc.cn", "piston-meta.mojang.com", "launchermeta.mojang.com", "fill.papermc.io"] as const;
/** 只读元数据允许一次网络重试；不重放节点写入，失败保留可操作的来源提示。 */
async function sourceRequest(url: string | URL, init: RequestInit = {}): Promise<Response> {
    try {
      const headers = new Headers(init.headers);
      if (new URL(url).hostname === "fill.papermc.io") headers.set("User-Agent", "LFAA-Harness (https://github.com/yubboo/LFAA)");
      return await fetchRuntimeResource(url, { signal: AbortSignal.timeout(20_000), ...init, headers });
    }
    catch { throw new ApiError(502, "minecraft_source_connection_failed", `无法连接核心来源 ${new URL(url).hostname}，请检查网络后刷新或重试。`); }
}

function isRetryableSourceFailure(error: unknown): error is ApiError {
  return error instanceof ApiError && error.errorCode === "minecraft_source_connection_failed";
}

function officialMojangFallbackUrl(url: URL): URL | null {
  if (url.hostname !== "piston-meta.mojang.com") return null;
  const fallback = new URL(url);
  fallback.hostname = "launchermeta.mojang.com";
  return fallback;
}

async function readJsonSource<T>(url: URL): Promise<T> {
  const response = await sourceRequest(url, { redirect: "error" });
  if (!response.ok) {
    await response.body?.cancel();
    if ([408, 425, 429, 500, 502, 503, 504].includes(response.status)) {
      throw new ApiError(502, "minecraft_source_connection_failed", `核心来源 ${url.hostname} 暂时不可用。`);
    }
    throw new ApiError(502, "minecraft_catalog_unavailable", `核心目录请求失败（${response.status}）。`);
  }
  return await response.json() as T;
}

/** API 路径分段编码；版本可含空格，但绝不作为实例目录或命令使用。 */
export function validateCoreCoordinate(value: string): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 120 || /[\u0000-\u001f/\\?#]/u.test(value) || value === "." || value === "..") {
    throw new ApiError(400, "minecraft_core_coordinate_invalid", "核心版本或构建标识无效。");
  }
  return value;
}
export function requireMinecraftCore(value: string): MinecraftCoreName {
  const normalized = minecraftCoreNames.find(name => name.toLowerCase() === value.trim().toLowerCase());
  if (!normalized) throw new ApiError(400, "minecraft_core_unknown", "核心尚未登记。");
  return normalized;
}
async function json<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && hit.expiresAt > Date.now()) return hit.data as T;
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port && parsed.port !== "443" || !(jsonSourceHosts as readonly string[]).includes(parsed.hostname)) throw new ApiError(502, "minecraft_source_invalid", "核心目录来源无效。");
  let data: T;
  try {
    data = await readJsonSource<T>(parsed);
  } catch (primaryError) {
    const fallback = officialMojangFallbackUrl(parsed);
    if (!fallback || !isRetryableSourceFailure(primaryError)) throw primaryError;
    try {
      data = await readJsonSource<T>(fallback);
    } catch (fallbackError) {
      if (isRetryableSourceFailure(fallbackError)) {
        throw new ApiError(502, "minecraft_source_connection_failed", "无法连接 Mojang 官方元数据主来源 piston-meta.mojang.com 或备用来源 launchermeta.mojang.com，请检查网络后刷新或重试。");
      }
      throw fallbackError;
    }
  }
  cache.set(url, { data, expiresAt: Date.now() + 60_000 });
  return data;
}
async function mirror<T>(path: string): Promise<T> {
  const response = await json<{ success: boolean; data: T }>(`${fastMirrorBase}/api/v3${path}`);
  if (response.success !== true || response.data == null) throw new ApiError(502, "minecraft_mirror_response_invalid", "FastMirror 未返回有效核心目录。");
  return response.data;
}
interface PaperBuild {
  id: number; time: string; channel: string;
  downloads: Record<string, { name: string; url: string; checksums: { sha256: string } }>;
}
export async function getPaperCoreSummary(): Promise<MinecraftCoreSummary> {
  const project = await json<{ versions: Record<string, string[]> }>(paperBase);
  const versions = Object.values(project.versions ?? {}).flat();
  if (!versions.length || !versions.every(v => typeof v === "string")) throw new ApiError(502, "minecraft_paper_catalog_invalid", "PaperMC 未返回有效版本目录。");
  return { name: "Paper", category: "pure", versions, homepage: "https://papermc.io", source: "papermc", launchKind: "jar", ...getMinecraftCoreCompatibility("Paper") };
}
async function paperBuilds(version: string): Promise<PaperBuild[]> {
  const rows = await json<PaperBuild[]>(`${paperBase}/versions/${encodeURIComponent(version)}/builds`);
  if (!Array.isArray(rows) || rows.some(row => !Number.isSafeInteger(row.id) || row.id <= 0)) throw new ApiError(502, "minecraft_paper_builds_invalid", "PaperMC 构建目录格式无效。");
  return rows.sort((a, b) => b.id - a.id);
}
async function youerVersions(): Promise<{ versions: string[] }> {
  const key = "youer-page-versions", hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.data as { versions: string[] };
  const response = await sourceRequest("https://www.mohistmc.cn/download/youer", { redirect: "error" });
  if (!response.ok) throw new ApiError(502, "minecraft_youer_catalog_unavailable", "Mohist 版本页面不可用。");
  // 官网通过 Next 页面属性提供可选版本，没有伪造一个不存在的版本 API。
  const html = (await response.text()).replace(/\\"/gu, '"');
  const match = html.match(/"projectName":"youer","availableVersions":(\[[^\]]*\])/u);
  if (!match) throw new ApiError(502, "minecraft_youer_catalog_changed", "Mohist 页面版本合同变化，请更新来源适配器。");
  const versions: unknown = JSON.parse(match[1]!);
  if (!Array.isArray(versions) || !versions.every(v => typeof v === "string")) throw new ApiError(502, "minecraft_youer_catalog_invalid", "Mohist 版本属性无效。");
  const data = { versions: versions as string[] };
  cache.set(key, { data, expiresAt: Date.now() + 60_000 });
  return data;
}
export async function listMinecraftCores(): Promise<{ cores: MinecraftCoreSummary[]; errors: string[] }> {
  const cores: MinecraftCoreSummary[] = [], errors: string[] = [];
  // 来源彼此独立；一个来源故障不会让另一个来源的目录消失。
  const results = await Promise.allSettled([
    mirror<Array<{ name: string; tag: CoreCategory; homepage: string; mc_versions: string[] }>>(""),
    youerVersions(), getPaperCoreSummary()
  ]);
  if (results[0].status === "fulfilled" && Array.isArray(results[0].value)) {
    for (const item of results[0].value) {
      if (!(minecraftCoreNames as readonly string[]).includes(item.name) || !Array.isArray(item.mc_versions)) continue;
      const name = requireMinecraftCore(item.name);
      const category = ["pure", "mod", "vanilla", "proxy", "bedrock"].includes(item.tag) ? item.tag : "mod";
      const homepage = typeof item.homepage === "string" && /^https:\/\//u.test(item.homepage) ? item.homepage : "https://www.fastmirror.net/#/home";
      cores.push({ name, category, homepage, versions: item.mc_versions.filter(v => typeof v === "string" && v.length <= 120 && !/[\u0000-\u001f/\\?#]/u.test(v)), source: "fastmirror", launchKind: name === "Forge" ? "forge" : name === "SpongeForge" ? "sponge-forge" : name === "SpongeNeo" ? "sponge-neo" : name === "PocketMine" ? "php" : "jar", ...getMinecraftCoreCompatibility(name) });
    }
  } else errors.push("FastMirror 核心目录暂不可用。");
  if (results[1].status === "fulfilled" && Array.isArray(results[1].value.versions)) {
    cores.push({ name: "Youer", category: "mod", homepage: "https://www.mohistmc.cn/download/youer", versions: results[1].value.versions.filter(v => typeof v === "string"), source: "mohist", launchKind: "jar", ...getMinecraftCoreCompatibility("Youer") });
  } else errors.push("Mohist Youer 版本目录暂不可用。");
  if (results[2].status === "fulfilled") {
    const previous = cores.findIndex(core => core.name === "Paper");
    if (previous >= 0) cores.splice(previous, 1);
    cores.push(results[2].value);
  } else {
    // Paper 部署只接受 PaperMC 官方版本/构建；镜像目录里的 Paper 会造成后续必然失败的选项。
    const mirrorPaper = cores.findIndex(core => core.name === "Paper");
    if (mirrorPaper >= 0) cores.splice(mirrorPaper, 1);
    errors.push("PaperMC 官方版本目录暂不可用。");
  }
  return { cores, errors };
}
async function requireCoreVersion(core: string, version: string): Promise<MinecraftCoreSummary> {
  const name = requireMinecraftCore(core);
  validateCoreCoordinate(version);
  // 已明确 Paper 时只请求其官方目录，避免等候无关核心来源。
  const entry = name === "Paper" ? await getPaperCoreSummary() : (await listMinecraftCores()).cores.find(c => c.name === name);
  if (!entry) throw new ApiError(502, "minecraft_core_source_unavailable", "无法从来源确认该核心。");
  if (!entry.versions.includes(version)) throw new ApiError(400, "minecraft_core_version_unknown", "该来源没有此核心版本，请刷新目录。");
  return entry;
}
interface YouerBuild { id: number; build_date: string; file_sha256: string; download_url: string; }
export async function listMinecraftCoreBuilds(core: string, version: string, offset = 0): Promise<{ builds: MinecraftCoreBuild[]; count: number }> {
  const entry = await requireCoreVersion(core, version);
  if (!Number.isInteger(offset) || offset < 0 || offset > 100_000) throw new ApiError(400, "minecraft_build_offset_invalid", "构建分页偏移无效。");
  if (entry.name === "Paper") {
    const rows = await paperBuilds(version);
    return { builds: rows.slice(offset, offset + 25).map(row => ({ id: String(row.id), updatedAt: row.time, digest: row.downloads?.["server:default"]?.checksums?.sha256 ?? "" })), count: rows.length };
  }
  if (entry.name === "Youer") {
    const rows = await json<YouerBuild[]>(`${mohistBase}/project/youer/${encodeURIComponent(version)}/builds`);
    if (!Array.isArray(rows)) throw new ApiError(502, "minecraft_build_response_invalid", "Youer 构建格式无效。");
    return { builds: rows.slice(offset, offset + 25).map(r => ({ id: String(r.id), updatedAt: r.build_date, digest: r.file_sha256 })), count: rows.length };
  }
  const data = await mirror<{ builds: Array<{ core_version: string; update_time: string; sha1: string }>; count: number }>(`/${entry.name}/${encodeURIComponent(version)}?offset=${offset}&limit=25`);
  if (!Array.isArray(data.builds) || !Number.isInteger(data.count)) throw new ApiError(502, "minecraft_build_response_invalid", "FastMirror 构建格式无效。");
  return { builds: data.builds.map(r => ({ id: r.core_version, updatedAt: r.update_time, digest: r.sha1 })), count: data.count };
}
/** 运行时要求首先读取 Mojang 对实际游戏版本的元数据；代理和基岩 Java 核心使用各自运行协议。 */
async function javaForCore(core: MinecraftCoreName, version: string): Promise<number> {
  if (core === "PocketMine") return 8; // 数据库历史 Java 列保留；PHP 执行器不消费它。
  if (core === "Nukkit") return 17;
  if (core === "BungeeCord") return 17;
  if (core === "Velocity") return Number(version.split(".")[0]) >= 4 ? 25 : Number(version.split(".")[1]) >= 3 ? 21 : 17;
  const gameVersion = version.replace(/-(?:forge|neoforge|fabric)$/u, "");
  const manifest = await json<{ versions: Array<{ id: string; url: string }> }>("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json");
  const game = manifest.versions.find(v => v.id === gameVersion);
  if (!game) throw new ApiError(409, "minecraft_java_requirement_unknown", "无法从 Mojang 确认此游戏版本的 Java 要求，暂不自动开服。");
  const detail = await json<{ javaVersion?: { majorVersion?: number } }>(game.url);
  const major = detail.javaVersion?.majorVersion;
  if (typeof major !== "number" || !Number.isInteger(major) || major < 8 || major > 40) throw new ApiError(409, "minecraft_java_requirement_unknown", "Mojang 未返回可验证的 Java 主版本，暂不自动开服。");
  return pluginJavaMajor(core, gameVersion, major);
}
/** Paper 官方运行建议与构建最低版本共同约束；所有下载分支共用，避免把最低字节码版本当作推荐运行时。 */
function pluginJavaMajor(core: MinecraftCoreName, gameVersion: string, major: number): number {
  // https://docs.papermc.io/paper/getting-started/#requirements
  if (["Paper", "Purpur", "Folia", "Leaves"].includes(core)) {
    const match = /^1\.(\d+)(?:\.(\d+))?$/u.exec(gameVersion);
    if (match) {
      const minor = Number(match[1]), patch = Number(match[2] ?? 0);
      if (minor >= 20) return Math.max(major, 21);
      if (minor >= 17) return Math.max(major, 17);
      if (minor === 16 && patch >= 5) return Math.max(major, 16);
      if (minor >= 12) return Math.max(major, 11);
    }
  }
  return major;
}
async function resolveLoaderArtifact(core: MinecraftCoreName, version: string, build: string): Promise<CoreArtifact["loaderArtifact"]> {
  if (core !== "SpongeForge" && core !== "SpongeNeo") return undefined;
  const loader = core === "SpongeForge" ? build.match(/^([0-9.]+)-/u)?.[1] : build.match(/^(.+)-\d+\.\d+\.\d+(?:-(?:RC\d+|SNAPSHOT))?$/u)?.[1];
  if (!loader || !/^[0-9A-Za-z.-]+$/u.test(loader)) throw new ApiError(409, "minecraft_sponge_loader_unknown", "无法确认 Sponge 对应的加载器版本。");
  const coordinate = core === "SpongeForge" ? `${version}-${loader}` : loader;
  const url = core === "SpongeForge"
    ? `https://maven.minecraftforge.net/net/minecraftforge/forge/${coordinate}/forge-${coordinate}-installer.jar`
    : `https://maven.neoforged.net/releases/net/neoforged/neoforge/${coordinate}/neoforge-${coordinate}-installer.jar`;
  const response = await sourceRequest(`${url}.sha1`, { redirect: "error" });
  const digest = response.ok ? (await response.text()).trim().split(/\s/u)[0]!.toLowerCase() : "";
  if (!/^[a-f0-9]{40}$/u.test(digest)) throw new ApiError(502, "minecraft_loader_digest_missing", "加载器官方摘要不可用，拒绝执行安装器。");
  return { url, algorithm: "sha1", digest };
}
async function resolvePocketMinePhp(): Promise<CoreArtifact["phpArtifact"]> {
  // 公共 GitHub API 可能限流；官网 Release HTML 同样提供官方 SHA-256，不跳过校验。
  const release = await sourceRequest("https://github.com/pmmp/PHP-Binaries/releases/latest");
  const parsed = new URL(release.url);
  if (!release.ok || parsed.hostname !== "github.com" || !parsed.pathname.startsWith("/pmmp/PHP-Binaries/releases/tag/")) throw new ApiError(502, "minecraft_php_release_unavailable", "PocketMine 官方 PHP 发布页不可用。");
  const tag = parsed.pathname.slice("/pmmp/PHP-Binaries/releases/tag/".length);
  const response = await sourceRequest(`https://github.com/pmmp/PHP-Binaries/releases/expanded_assets/${tag}`, { redirect: "error" });
  const html = response.ok ? await response.text() : "";
  const rows = html.match(/<li\b[\s\S]*?<\/li>/gu) ?? [];
  const row = rows.find(text => /PHP-[0-9.]+-Windows-x64-PM5\.zip/u.test(text) && !text.includes("debugging-symbols"));
  const path = row?.match(/href="(\/pmmp\/PHP-Binaries\/releases\/download\/[^"<>]+\.zip)"/u)?.[1];
  const digest = row?.match(/sha256:([a-f0-9]{64})/u)?.[1];
  if (!path || !digest) throw new ApiError(502, "minecraft_php_digest_missing", "无法确认 PocketMine Windows PHP 工件和官方摘要。");
  return { url: `https://github.com${path}`, algorithm: "sha256", digest };
}
export async function resolveMinecraftCoreArtifact(core: string, version: string, build?: string): Promise<CoreArtifact> {
  const entry = await requireCoreVersion(core, version);
  if (build === undefined) {
    if (entry.name === "Paper") {
      const stable = (await paperBuilds(version)).find(row => row.channel === "STABLE");
      if (!stable) throw new ApiError(409, "minecraft_stable_build_missing", "该版本没有稳定 Paper 构建，请选择其他版本或明确指定构建；不会静默更换版本。");
      build = String(stable.id);
    } else build = (await listMinecraftCoreBuilds(core, version)).builds[0]?.id;
    if (!build) throw new ApiError(404, "minecraft_build_unknown", "该核心版本没有可部署构建。");
  }
  validateCoreCoordinate(build);
  if (entry.name === "Paper") {
    const [row, detail] = await Promise.all([
      json<PaperBuild>(`${paperBase}/versions/${encodeURIComponent(version)}/builds/${encodeURIComponent(build)}`),
      json<{ version: { id: string; java: { version: { minimum: number } } } }>(`${paperBase}/versions/${encodeURIComponent(version)}`)
    ]);
    const file = row.downloads?.["server:default"], javaMajor = detail.version?.java?.version?.minimum;
    if (String(row.id) !== build || detail.version?.id !== version || !file || !Number.isInteger(javaMajor) || javaMajor < 8 || javaMajor > 40) throw new ApiError(502, "minecraft_paper_artifact_invalid", "PaperMC 构建或 Java 要求与目标版本不符。");
    const url = new URL(file.url);
    if (url.protocol !== "https:" || url.hostname !== "fill-data.papermc.io" || url.username || url.password || url.port && url.port !== "443" || !/^[a-f0-9]{64}$/iu.test(file.checksums?.sha256 ?? "") || !/^[\w.-]+\.jar$/u.test(file.name)) throw new ApiError(502, "minecraft_paper_artifact_invalid", "PaperMC 工件来源、文件名或 SHA-256 无效。");
    return { core: "Paper", version, build, category: entry.category, launchKind: "jar", url: file.url, filename: file.name, algorithm: "sha256", digest: file.checksums.sha256.toLowerCase(), javaMajor: pluginJavaMajor("Paper", version, javaMajor), source: "papermc" };
  }
  let url: string, digest: string, filename: string, algorithm: "sha1" | "sha256";
  if (entry.name === "Youer") {
    const rows = await json<YouerBuild[]>(`${mohistBase}/project/youer/${encodeURIComponent(version)}/builds`);
    const row = rows.find(r => String(r.id) === build);
    if (!row) throw new ApiError(404, "minecraft_build_unknown", "Youer 构建不存在。");
    url = row.download_url; digest = row.file_sha256; algorithm = "sha256"; filename = new URL(url).pathname.split("/").pop()!;
  } else {
    const row = await mirror<{ name: string; mc_version: string; core_version: string; sha1: string; filename: string; download_url: string }>(`/${entry.name}/${encodeURIComponent(version)}/${encodeURIComponent(build)}`);
    if (row.name !== entry.name || row.mc_version !== version || row.core_version !== build) throw new ApiError(502, "minecraft_artifact_identity_invalid", "下载元数据与选定核心不符。");
    url = row.download_url; digest = row.sha1; algorithm = "sha1"; filename = row.filename;
  }
  const parsed = new URL(url);
  const hosts = entry.name === "Youer" ? ["mohistmc-build.cn-sy1.rains3.com"] : ["download.fastmirror.net"];
  if (parsed.protocol !== "https:" || parsed.port && parsed.port !== "443" || parsed.username || parsed.password || !hosts.includes(parsed.hostname) || !new RegExp(`^[a-f0-9]{${algorithm === "sha1" ? 40 : 64}}$`, "iu").test(digest)) throw new ApiError(502, "minecraft_artifact_invalid", "核心下载来源或摘要未通过校验。");
  if (entry.name === "PocketMine" && /^v?[1-4]\./u.test(build)) throw new ApiError(409, "minecraft_php_legacy_runtime_unsupported", "此旧构建需要不同 PHP 协议。当前自动部署支持 PocketMine 5，请选择 5.x 构建。");
  const [javaMajor, loaderArtifact, phpArtifact] = await Promise.all([javaForCore(entry.name, version), resolveLoaderArtifact(entry.name, version, build), entry.name === "PocketMine" ? resolvePocketMinePhp() : undefined]);
  return { core: entry.name, category: entry.category, launchKind: entry.launchKind, version, build, url, algorithm, digest: digest.toLowerCase(), filename, javaMajor, source: entry.source, loaderArtifact, phpArtifact };
}
