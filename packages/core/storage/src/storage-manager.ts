// 管理 LFAA 资料库与资产库本地根路径配置、旧数据接管、统计及无损跨目录迁移（Copy-Verify-Switch）。
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import type {
  StorageConfigState,
  StorageLocationMode,
  StorageMigrationResult,
  StorageStats,
} from "./types";
import {
  LEGACY_VAULT_FILES,
  upgradeVaultLayoutInRoot,
  VAULT_DIRS,
  VAULT_FILES,
} from "./vault-layout";

export { VAULT_DIRS, VAULT_FILES };

// 动态解析当前登录系统用户的个人主目录，避免静态写死特定用户名路径。
export function getCurrentUserHomeDir(): string {
  const detected = homedir() || process.env.USERPROFILE || process.env.HOME || "";
  if (!detected.trim()) {
    throw new Error("无法自动检测当前操作系统用户目录。");
  }
  return resolve(detected);
}

/** 解析本机用户目录下的 LFAA 根路径，供存储初始化复用。 */
export function getDefaultLfaaHome(): string {
  return join(getCurrentUserHomeDir(), ".lfaa");
}

/** 返回资料与其他可迁移数据的默认子目录。 */
export function getDefaultDataRoot(): string {
  return join(getDefaultLfaaHome(), "data");
}

/** 返回独立于资料迁移目标的固定会话目录。 */
export function getFixedSessionsDir(): string {
  return join(getDefaultLfaaHome(), "sessions");
}

export const DEFAULT_LFAA_HOME = getDefaultLfaaHome();
export const DEFAULT_DATA_ROOT = getDefaultDataRoot();

const MANAGED_ITEMS = [
  VAULT_FILES.longTermMemory,
  VAULT_FILES.vaultIndex,
  VAULT_DIRS.artifacts,
  VAULT_DIRS.assets,
] as const;

function normalizeCompare(targetPath: string): string {
  const resolved = resolve(targetPath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isNestedOrSame(a: string, b: string): boolean {
  const rel = relative(normalizeCompare(a), normalizeCompare(b));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

// 规范化用户输入的存储路径：非 data 结尾时自动在其下生成 data 目录。
export function normalizeCustomDataPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    throw new Error("目标存储路径不能为空。");
  }
  const abs = resolve(trimmed);
  if (basename(abs).toLowerCase() === "data") return abs;
  return join(abs, "data");
}

async function listManagedFiles(rootDir: string): Promise<Array<{ relPath: string; size: number }>> {
  const results: Array<{ relPath: string; size: number }> = [];

  const walk = async (absPath: string, relBase: string): Promise<void> => {
    if (!existsSync(absPath)) return;
    const info = await stat(absPath);
    if (info.isFile()) {
      results.push({ relPath: relBase, size: info.size });
      return;
    }
    if (info.isDirectory()) {
      const entries = await readdir(absPath, { withFileTypes: true });
      for (const entry of entries) {
        await walk(join(absPath, entry.name), join(relBase, entry.name));
      }
    }
  };

  for (const name of MANAGED_ITEMS) {
    await walk(join(rootDir, name), name);
  }
  return results;
}

/** 协调数据目录选择、初始化、统计和迁移，固定会话根路径单独管理。 */
export class StorageManager {
  private readonly configFilePath: string;
  private readonly defaultDataRoot: string;
  private readonly recommendedProjectDataRoot: string;
  private readonly legacyHomeDir: string;
  private readonly sessionsRoot: string;
  private state: StorageConfigState | null = null;

  constructor(options: {
    configFilePath?: string | undefined;
    defaultDataRoot?: string | undefined;
    recommendedProjectDataRoot?: string | undefined;
    legacyHomeDir?: string | undefined;
    sessionsRoot?: string | undefined;
  } = {}) {
    this.defaultDataRoot = resolve(options.defaultDataRoot ?? getDefaultDataRoot());
    this.configFilePath = resolve(options.configFilePath ?? join(getDefaultLfaaHome(), "storage-config.json"));
    this.recommendedProjectDataRoot = normalizeCustomDataPath(
      options.recommendedProjectDataRoot ?? join(process.cwd(), "data"),
    );
    this.legacyHomeDir = resolve(options.legacyHomeDir ?? getDefaultLfaaHome());
    this.sessionsRoot = resolve(options.sessionsRoot ?? getFixedSessionsDir());
  }

  getSessionsRoot(): string {
    return this.sessionsRoot;
  }

  resolveRecommendedDataRoot(projectRoot?: string): string {
    if (projectRoot?.trim()) {
      return normalizeCustomDataPath(projectRoot);
    }
    return this.recommendedProjectDataRoot;
  }

  // 建立资料目录与固定会话目录，初始化时保留已有的存储配置。
  async ensureInitialized(): Promise<StorageConfigState> {
    if (this.state) return this.state;

    let loaded: Partial<StorageConfigState> | null = null;
    try {
      const raw = await readFile(this.configFilePath, "utf8");
      loaded = JSON.parse(raw) as Partial<StorageConfigState>;
    } catch {
      loaded = null;
    }

    const mode: StorageLocationMode = loaded?.mode === "project" || loaded?.mode === "custom" ? loaded.mode : "default";
    // default 模式下始终绑定当前系统用户的 .lfaa/data；project 模式下跟随当前检测到的项目目录。
    const dataRoot =
      mode === "default"
        ? this.defaultDataRoot
        : mode === "project" && !loaded?.dataRoot
          ? this.recommendedProjectDataRoot
          : loaded?.dataRoot
            ? resolve(loaded.dataRoot)
            : this.defaultDataRoot;
    this.state = {
      dataRoot,
      defaultDataRoot: this.defaultDataRoot,
      recommendedProjectDataRoot: this.recommendedProjectDataRoot,
      appDataRoot: getDefaultLfaaHome(),
      sessionsRoot: this.sessionsRoot,
      mode,
      updatedAt: typeof loaded?.updatedAt === "number" ? loaded.updatedAt : Date.now(),
    };

    await mkdir(this.sessionsRoot, { recursive: true });
    await upgradeVaultLayoutInRoot(dataRoot, this.sessionsRoot);
    await this.ensureSubdirs(dataRoot);
    if (!loaded) {
      await this.adoptLegacyDataIfEmpty(dataRoot);
      await this.saveConfig(this.state);
    }
    return this.state;
  }

  private async ensureSubdirs(rootDir: string): Promise<void> {
    await mkdir(rootDir, { recursive: true });
    await mkdir(join(rootDir, VAULT_DIRS.artifacts), { recursive: true });
    await mkdir(join(rootDir, VAULT_DIRS.assets), { recursive: true });
  }

  private async saveConfig(next: StorageConfigState): Promise<void> {
    await mkdir(dirname(this.configFilePath), { recursive: true });
    await writeFile(this.configFilePath, JSON.stringify(next, null, 2), "utf8");
  }

  // 首次升级到 dataRoot 结构时，仅接管原 ~/.lfaa/memory.json；会话文件固定保留在 ~/.lfaa/sessions。
  // 只在目标尚未包含受管理数据时迁入旧资料，避免覆盖已有内容。
  private async adoptLegacyDataIfEmpty(targetRoot: string): Promise<void> {
    if (normalizeCompare(this.legacyHomeDir) === normalizeCompare(targetRoot)) return;
    const legacyMemory = join(this.legacyHomeDir, LEGACY_VAULT_FILES.longTermMemory);
    const targetMemory = join(targetRoot, VAULT_FILES.longTermMemory);
    if (existsSync(legacyMemory) && !existsSync(targetMemory)) {
      await copyFile(legacyMemory, targetMemory);
    }
  }

  async getState(projectRoot?: string): Promise<StorageConfigState> {
    const base = await this.ensureInitialized();
    const recommendedProjectDataRoot = this.resolveRecommendedDataRoot(projectRoot);
    return {
      ...base,
      defaultDataRoot: this.defaultDataRoot,
      recommendedProjectDataRoot,
      appDataRoot: getDefaultLfaaHome(),
      sessionsRoot: this.sessionsRoot,
    };
  }

  async getStats(): Promise<StorageStats> {
    const current = await this.ensureInitialized();
    const files = await listManagedFiles(current.dataRoot);
    let totalBytes = 0;
    for (const file of files) {
      totalBytes += file.size;
    }

    let sessionCount = 0;
    try {
      const sessEntries = await readdir(this.sessionsRoot, { withFileTypes: true });
      sessionCount = sessEntries.filter((e) => e.isFile() && e.name.endsWith(".json")).length;
    } catch {
      sessionCount = 0;
    }

    let memoryCount = 0;
    try {
      const rawMem = await readFile(join(current.dataRoot, VAULT_FILES.longTermMemory), "utf8");
      const parsed: unknown = JSON.parse(rawMem);
      if (Array.isArray(parsed)) memoryCount = parsed.length;
    } catch {
      memoryCount = 0;
    }

    let artifactCount = 0;
    let assetCount = 0;
    try {
      const rawLib = await readFile(join(current.dataRoot, VAULT_FILES.vaultIndex), "utf8");
      const parsed: unknown = JSON.parse(rawLib);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object" && (item as { category?: string }).category === "artifact") {
            artifactCount += 1;
          } else {
            assetCount += 1;
          }
        }
      }
    } catch {
      artifactCount = 0;
      assetCount = 0;
    }

    return {
      dataRoot: current.dataRoot,
      memoryCount,
      sessionCount,
      artifactCount,
      assetCount,
      totalBytes,
    };
  }

  // Copy-Verify-Switch 无损迁移：全量复制并逐文件校验字节大小一致后才切换配置并清理源副本。
  async migrate(options: {
    targetPath: string;
    mode: StorageLocationMode;
    projectRoot?: string | undefined;
    removeOldCopies?: boolean | undefined;
  }): Promise<StorageMigrationResult> {
    const current = await this.ensureInitialized();
    const fromRoot = current.dataRoot;
    const toRoot = normalizeCustomDataPath(options.targetPath);

    if (normalizeCompare(fromRoot) === normalizeCompare(toRoot)) {
      await this.ensureSubdirs(toRoot);
      const nextSame: StorageConfigState = {
        ...current,
        dataRoot: toRoot,
        defaultDataRoot: this.defaultDataRoot,
        mode: options.mode,
        recommendedProjectDataRoot: this.resolveRecommendedDataRoot(options.projectRoot),
        updatedAt: Date.now(),
      };
      this.state = nextSame;
      await this.saveConfig(nextSame);
      return {
        fromRoot,
        toRoot,
        copiedFiles: 0,
        copiedBytes: 0,
        verified: true,
        state: nextSame,
        stats: await this.getStats(),
      };
    }

    if (isNestedOrSame(fromRoot, toRoot) || isNestedOrSame(toRoot, fromRoot)) {
      throw new Error("目标目录不能与当前存储目录互相包含，请选择独立位置。");
    }

    const sourceFiles = await listManagedFiles(fromRoot);
    await this.ensureSubdirs(toRoot);

    let copiedBytes = 0;
    for (const file of sourceFiles) {
      const src = join(fromRoot, file.relPath);
      const dst = join(toRoot, file.relPath);
      await mkdir(dirname(dst), { recursive: true });
      await copyFile(src, dst);
      const verifyStat = await stat(dst);
      if (verifyStat.size !== file.size) {
        throw new Error(`无损校验失败：${file.relPath} 大小不一致，已中止切换以保护原数据。`);
      }
      copiedBytes += verifyStat.size;
    }

    const nextState: StorageConfigState = {
      dataRoot: toRoot,
      defaultDataRoot: this.defaultDataRoot,
      recommendedProjectDataRoot: this.resolveRecommendedDataRoot(options.projectRoot),
      sessionsRoot: this.sessionsRoot,
      mode: options.mode,
      updatedAt: Date.now(),
    };
    this.state = nextState;
    await this.saveConfig(nextState);

    if (options.removeOldCopies !== false) {
      for (const name of MANAGED_ITEMS) {
        await rm(join(fromRoot, name), { recursive: true, force: true }).catch(() => {});
      }
      const leftover = await readdir(fromRoot).catch(() => ["keep"]);
      if (leftover.length === 0) {
        await rm(fromRoot, { recursive: true, force: true }).catch(() => {});
      }
    }

    return {
      fromRoot,
      toRoot,
      copiedFiles: sourceFiles.length,
      copiedBytes,
      verified: true,
      state: nextState,
      stats: await this.getStats(),
    };
  }
}
