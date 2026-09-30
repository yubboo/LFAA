/**
 * 功能：读取 Mojang 官方 Minecraft Java 版本清单与 Vanilla 服务端工件信息。
 * 作用：将客户端可选版本解析为受信任的版本元数据，供 Minecraft 实例创建任务使用。
 * 关联文件：packages/games/minecraft/src/service.ts、packages/api/gateway/src/index.ts。
 */
import { ApiError } from "lfaa-util-values/src/http-error.js";

const manifestUrl = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const manifestHost = "piston-meta.mojang.com";
const metadataHost = "piston-meta.mojang.com";
const artifactHost = "piston-data.mojang.com";

interface VersionManifestEntry {
  id: string;
  type: string;
  url: string;
  releaseTime: string;
}

interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: VersionManifestEntry[];
}

interface VersionDetail {
  id: string;
  javaVersion?: { majorVersion?: number };
  downloads?: { server?: { url?: string; sha1?: string; size?: number } };
}

export interface MinecraftReleaseSummary {
  id: string;
  type: "release";
  releaseTime: string;
}

export interface MinecraftReleaseArtifact extends MinecraftReleaseSummary {
  javaMajor: number;
  serverUrl: string;
  serverSha1: string;
  serverSize: number;
}

let manifestCache: { expiresAt: number; value: VersionManifest } | null = null;
const artifactCache = new Map<string, { expiresAt: number; value: MinecraftReleaseArtifact }>();

async function fetchOfficialJson<T>(url: string, expectedHost: string): Promise<T> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== expectedHost) {
    throw new ApiError(502, "minecraft_official_source_invalid", "Minecraft 官方版本来源地址未通过校验。");
  }

  const response = await fetch(parsed, { signal: AbortSignal.timeout(20_000), redirect: "error" });
  if (!response.ok) throw new ApiError(502, "minecraft_official_source_unavailable", "暂时无法读取 Minecraft 官方版本信息。");
  return await response.json() as T;
}

async function getManifest(): Promise<VersionManifest> {
  if (manifestCache && manifestCache.expiresAt > Date.now()) return manifestCache.value;
  const value = await fetchOfficialJson<VersionManifest>(manifestUrl, manifestHost);
  if (!Array.isArray(value.versions) || typeof value.latest?.release !== "string") {
    throw new ApiError(502, "minecraft_manifest_invalid", "Minecraft 官方版本清单格式无法识别。");
  }
  manifestCache = { value, expiresAt: Date.now() + 15 * 60 * 1000 };
  return value;
}

export async function listMinecraftReleases(): Promise<{ latestRelease: string; releases: MinecraftReleaseSummary[] }> {
  const manifest = await getManifest();
  const releases = manifest.versions
    .filter((version) => version.type === "release" && /^[0-9A-Za-z.-]{1,64}$/u.test(version.id))
    .map((version) => ({ id: version.id, type: "release" as const, releaseTime: version.releaseTime }));
  return { latestRelease: manifest.latest.release, releases };
}

export async function getMinecraftReleaseArtifact(releaseId: string): Promise<MinecraftReleaseArtifact> {
  if (!/^[0-9A-Za-z.-]{1,64}$/u.test(releaseId)) {
    throw new ApiError(400, "invalid_minecraft_release", "Minecraft 版本号格式不正确。");
  }
  const cached = artifactCache.get(releaseId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const manifest = await getManifest();
  const entry = manifest.versions.find((version) => version.id === releaseId && version.type === "release");
  if (!entry) throw new ApiError(404, "minecraft_release_not_found", "官方版本清单中没有这个正式版。");

  const detail = await fetchOfficialJson<VersionDetail>(entry.url, metadataHost);
  const artifact = detail.downloads?.server;
  const serverUrl = artifact?.url;
  const serverSha1 = artifact?.sha1?.toLocaleLowerCase();
  const javaMajor = detail.javaVersion?.majorVersion;
  const serverSize = artifact?.size;
  if (detail.id !== releaseId || !serverUrl || !serverSha1 || !Number.isSafeInteger(javaMajor) || !Number.isSafeInteger(serverSize)) {
    throw new ApiError(502, "minecraft_release_metadata_invalid", "官方版本信息缺少服务端工件或 Java 版本要求。");
  }
  const parsedArtifactUrl = new URL(serverUrl);
  if (parsedArtifactUrl.protocol !== "https:" || parsedArtifactUrl.hostname !== artifactHost
    || !/^[a-f0-9]{40}$/u.test(serverSha1) || serverSize! < 1 || serverSize! > 512 * 1024 * 1024
    || javaMajor! < 8 || javaMajor! > 40) {
    throw new ApiError(502, "minecraft_server_artifact_invalid", "官方服务端工件未通过地址、摘要或大小校验。");
  }

  const value: MinecraftReleaseArtifact = {
    id: releaseId,
    type: "release",
    releaseTime: entry.releaseTime,
    javaMajor: javaMajor!,
    serverUrl: parsedArtifactUrl.toString(),
    serverSha1,
    serverSize: serverSize!
  };
  artifactCache.set(releaseId, { value, expiresAt: Date.now() + 60 * 60 * 1000 });
  return value;
}
