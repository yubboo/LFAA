/**
 * 功能：编码与解析可移植的外观预设文件。
 * 作用：使用有界版本化清单和原始背景字节搬运单个预设，不包含账户密钥或其他设置。
 * 关联文件：AppearancePresetsPanel.tsx、SettingsPage.tsx、client/connection/src/api.ts。
 */
import type { AppearancePreset, AppearancePresetSnapshot } from "lfaa-util-values/src/settings-contract.js";

export const APPEARANCE_PRESET_FILE_MIME_TYPE = "application/vnd.lfaa.appearance-preset";
export const APPEARANCE_PRESET_FILE_EXTENSION = ".lfaa-preset";
export const APPEARANCE_PRESET_BACKGROUND_MAX_BYTES = 3 * 1024 * 1024;
export const APPEARANCE_PRESET_BACKGROUND_MAX_ASSETS = 6;
export const APPEARANCE_PRESET_MANIFEST_MAX_BYTES = 256 * 1024;
export const APPEARANCE_PRESET_FILE_MAX_BYTES = APPEARANCE_PRESET_MANIFEST_MAX_BYTES
  + APPEARANCE_PRESET_BACKGROUND_MAX_BYTES * APPEARANCE_PRESET_BACKGROUND_MAX_ASSETS
  + 12;

const MAGIC = "LFAAAP01";
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ASSET_NAME_MAX_LENGTH = 80;
const USER_BACKGROUND_ID = /^user-[0-9a-f-]{36}$/iu;

export interface AppearancePresetAssetSource {
  name: string;
  mimeType: string;
  blob: Blob;
}

export interface ParsedAppearancePresetFile {
  name: string;
  description: string;
  snapshot: AppearancePresetSnapshot;
  assets: Array<AppearancePresetAssetSource & { sourceId: string }>;
}

export interface AppearancePresetImportDependencies<TAsset extends { id: string }, TValue> {
  upload: (asset: AppearancePresetAssetSource & { sourceId: string }) => Promise<TAsset>;
  remove: (id: string) => Promise<void>;
  commit: (snapshot: AppearancePresetSnapshot) => Promise<TValue>;
}

export class AppearancePresetCommitUncertainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppearancePresetCommitUncertainError";
  }
}

interface ManifestAsset {
  sourceId: string;
  name: string;
  mimeType: string;
  byteLength: number;
}

interface Manifest {
  format: "lfaa-appearance-preset";
  version: 1;
  preset: { name: string; description: string; snapshot: AppearancePresetSnapshot };
  assets: ManifestAsset[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function safeAssetName(value: string): string {
  const normalized = value.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/gu, "_").slice(0, ASSET_NAME_MAX_LENGTH);
  return normalized || "自定义背景";
}

function userBackgroundIds(snapshot: AppearancePresetSnapshot): string[] {
  const rawSnapshot: unknown = snapshot;
  if (!isRecord(rawSnapshot) || !hasExactKeys(rawSnapshot, ["appearance", "general"]) || !isRecord(rawSnapshot.appearance)
    || !isRecord(rawSnapshot.appearance.backgrounds)
    || !hasExactKeys(rawSnapshot.appearance.backgrounds, ["login", "appCenter", "steamcmd", "minecraft", "writing", "settings"])) {
    throw new Error("外观预设快照结构无效。");
  }
  const backgrounds = rawSnapshot.appearance.backgrounds;
  const backgroundIds = Object.values(backgrounds);
  if (backgroundIds.some((id) => typeof id !== "string")) throw new Error("预设背景引用无效。");
  const loginBackground = backgrounds.login as string;
  if (loginBackground.startsWith("user-")) {
    throw new Error("登录页只能使用内置背景，不能导入包含自定义登录背景的预设。");
  }
  const ids = [...new Set((backgroundIds as string[]).filter((id) => id.startsWith("user-")))];
  if (ids.length > APPEARANCE_PRESET_BACKGROUND_MAX_ASSETS || ids.some((id) => !USER_BACKGROUND_ID.test(id))) {
    throw new Error("预设引用的自定义背景数量或 ID 无效。");
  }
  return ids;
}

function validateAssetSizeAndType(name: string, mimeType: string, byteLength: number): void {
  if (!name.trim() || name.length > ASSET_NAME_MAX_LENGTH) throw new Error("预设背景文件名无效。");
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) throw new Error("预设背景只支持 PNG、JPEG 或 WebP 格式。");
  if (!Number.isSafeInteger(byteLength) || byteLength < 1 || byteLength > APPEARANCE_PRESET_BACKGROUND_MAX_BYTES) {
    throw new Error("单张预设背景不能超过 3 MiB。");
  }
}

export async function createAppearancePresetFile(
  preset: AppearancePreset,
  loadBackground: (id: string) => Promise<AppearancePresetAssetSource>
): Promise<Blob> {
  const ids = userBackgroundIds(preset.snapshot);
  const assets: Array<AppearancePresetAssetSource & { sourceId: string }> = [];
  for (const sourceId of ids) {
    const source = await loadBackground(sourceId);
    validateAssetSizeAndType(source.name, source.mimeType, source.blob.size);
    if (source.blob.type && source.blob.type.toLowerCase() !== source.mimeType.toLowerCase()) {
      throw new Error("背景素材的服务端类型与文件内容不一致。");
    }
    assets.push({ sourceId, name: safeAssetName(source.name), mimeType: source.mimeType.toLowerCase(), blob: source.blob });
  }

  const manifest: Manifest = {
    format: "lfaa-appearance-preset",
    version: 1,
    preset: { name: preset.name, description: preset.description, snapshot: preset.snapshot },
    assets: assets.map(({ sourceId, name, mimeType, blob }) => ({ sourceId, name, mimeType, byteLength: blob.size }))
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  if (manifestBytes.byteLength > APPEARANCE_PRESET_MANIFEST_MAX_BYTES) throw new Error("预设文件清单超过大小限制。");

  const header = new Uint8Array(12);
  for (let index = 0; index < MAGIC.length; index += 1) header[index] = MAGIC.charCodeAt(index);
  new DataView(header.buffer).setUint32(8, manifestBytes.byteLength, false);
  const fileSize = header.byteLength + manifestBytes.byteLength + assets.reduce((total, asset) => total + asset.blob.size, 0);
  if (fileSize > APPEARANCE_PRESET_FILE_MAX_BYTES) throw new Error("预设文件超过可导出大小限制。");
  return new Blob([header, manifestBytes, ...assets.map((asset) => asset.blob)], { type: APPEARANCE_PRESET_FILE_MIME_TYPE });
}

export async function parseAppearancePresetFile(file: Blob): Promise<ParsedAppearancePresetFile> {
  if (file.size < 12 || file.size > APPEARANCE_PRESET_FILE_MAX_BYTES) throw new Error("预设文件大小无效或超过限制。");
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const magic = String.fromCharCode(...header.slice(0, 8));
  if (magic !== MAGIC) throw new Error("文件格式无效；请选择 LFAA 外观预设文件。");
  const manifestLength = new DataView(header.buffer, header.byteOffset, header.byteLength).getUint32(8, false);
  if (manifestLength < 2 || manifestLength > APPEARANCE_PRESET_MANIFEST_MAX_BYTES || 12 + manifestLength > file.size) {
    throw new Error("预设文件清单长度无效。");
  }

  let value: unknown;
  try {
    const bytes = await file.slice(12, 12 + manifestLength).arrayBuffer();
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new Error("预设文件清单无法读取。");
  }
  if (!isRecord(value) || !hasExactKeys(value, ["format", "version", "preset", "assets"]) || value.format !== "lfaa-appearance-preset" || value.version !== 1) {
    throw new Error("预设文件版本或清单字段不受支持。");
  }
  if (!isRecord(value.preset) || !hasExactKeys(value.preset, ["name", "description", "snapshot"])) {
    throw new Error("预设文件缺少有效的预设信息。");
  }
  const name = typeof value.preset.name === "string" ? value.preset.name.trim() : "";
  const description = value.preset.description;
  if (!name || name.length > 40 || typeof description !== "string" || description.length > 160 || !isRecord(value.preset.snapshot)) {
    throw new Error("预设名称、说明或快照无效。");
  }
  const snapshot = value.preset.snapshot as unknown as AppearancePresetSnapshot;
  const expectedIds = userBackgroundIds(snapshot);
  if (!Array.isArray(value.assets) || value.assets.length !== expectedIds.length || value.assets.length > APPEARANCE_PRESET_BACKGROUND_MAX_ASSETS) {
    throw new Error("预设文件的背景素材与快照引用不一致。");
  }

  const assetIds = new Set<string>();
  const manifestAssets: ManifestAsset[] = [];
  for (const candidate of value.assets) {
    if (!isRecord(candidate) || !hasExactKeys(candidate, ["sourceId", "name", "mimeType", "byteLength"])) {
      throw new Error("预设文件中的背景素材信息无效。");
    }
    if (typeof candidate.sourceId !== "string" || !USER_BACKGROUND_ID.test(candidate.sourceId) || assetIds.has(candidate.sourceId)
      || typeof candidate.name !== "string" || typeof candidate.mimeType !== "string" || typeof candidate.byteLength !== "number") {
      throw new Error("预设文件中的背景素材信息无效。");
    }
    validateAssetSizeAndType(candidate.name, candidate.mimeType, candidate.byteLength);
    assetIds.add(candidate.sourceId);
    manifestAssets.push({ sourceId: candidate.sourceId, name: candidate.name, mimeType: candidate.mimeType.toLowerCase(), byteLength: candidate.byteLength });
  }
  if (expectedIds.some((id) => !assetIds.has(id))) throw new Error("预设文件缺少快照引用的背景素材。");

  const totalSize = 12 + manifestLength + manifestAssets.reduce((total, asset) => total + asset.byteLength, 0);
  if (totalSize !== file.size) throw new Error("预设文件背景字节长度不匹配或文件包含多余内容。");
  let offset = 12 + manifestLength;
  const assets = manifestAssets.map((asset) => {
    const blob = file.slice(offset, offset + asset.byteLength, asset.mimeType);
    offset += asset.byteLength;
    return { sourceId: asset.sourceId, name: safeAssetName(asset.name), mimeType: asset.mimeType, blob };
  });
  return { name, description, snapshot, assets };
}

/** Upload each private image once, remap its ID, and remove newly-created images if saving fails. */
export async function importAppearancePresetWithAssets<TAsset extends { id: string }, TValue>(
  imported: ParsedAppearancePresetFile,
  dependencies: AppearancePresetImportDependencies<TAsset, TValue>
): Promise<{ assets: TAsset[]; value: TValue }> {
  const uploaded: TAsset[] = [];
  try {
    const backgroundIdMap = new Map<string, string>();
    for (const asset of imported.assets) {
      const saved = await dependencies.upload(asset);
      uploaded.push(saved);
      backgroundIdMap.set(asset.sourceId, saved.id);
    }

    const snapshot = structuredClone(imported.snapshot);
    for (const target of Object.keys(snapshot.appearance.backgrounds) as Array<keyof AppearancePresetSnapshot["appearance"]["backgrounds"]>) {
      const sourceId = snapshot.appearance.backgrounds[target];
      if (!sourceId.startsWith("user-")) continue;
      const nextId = backgroundIdMap.get(sourceId);
      if (!nextId) throw new Error("预设文件缺少引用的背景素材，未保存预设。");
      snapshot.appearance.backgrounds[target] = nextId;
    }

    const value = await dependencies.commit(snapshot);
    return { assets: uploaded, value };
  } catch (error) {
    if (error instanceof AppearancePresetCommitUncertainError) throw error;
    const cleanupFailures: string[] = [];
    for (const asset of [...uploaded].reverse()) {
      try { await dependencies.remove(asset.id); }
      catch { cleanupFailures.push(asset.id); }
    }
    if (cleanupFailures.length) {
      const message = error instanceof Error ? error.message : "预设导入失败。";
      throw new Error(`${message} 清理未引用背景素材失败：${cleanupFailures.join("、")}。`);
    }
    throw error;
  }
}

export function appearancePresetDownloadName(name: string): string {
  const safeName = name.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/gu, "_").replace(/\s+/gu, "-").slice(0, 80) || "appearance-preset";
  return `LFAA-${safeName}${APPEARANCE_PRESET_FILE_EXTENSION}`;
}
