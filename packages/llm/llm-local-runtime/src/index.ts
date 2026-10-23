/** 功能：提供 LFAA 自己的本地模型管理/加载核心。作用：按已登记适配器识别原生模型目录、下载公开权重并委派实际推理。 */
import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import { ensureDataDirectories, resolveDataPaths } from "lfaa-home-paths/src/data-layout.mjs";
import * as projectStorageModule from "lfaa-settings/src/project-storage.js";
import type {
  LocalImageRequest, LocalImageResult, LocalModelAdapter, LocalModelDownloadSnapshot, LocalModelRuntimeService,
  LocalModelSummary, LocalVideoRequest, LocalVideoResult, LocalWorkspaceAsset
} from "./contracts.js";
import { downloadHubModel, type HubDownloadProgress } from "./hub-download.js";
import { removeWorkspaceAsset as removeWorkspaceAssetFile, saveWorkspaceAsset as saveWorkspaceAssetFile } from "./workspace-assets.js";

declare module "@deepseek-ai/cordis" {
  interface Context { lfaaLocalModelRuntime: LocalModelRuntimeService }
}

const MAX_DOWNLOAD_SNAPSHOTS = 32;
const SNAPSHOT_RETENTION_MS = 60 * 60 * 1_000;
const MODEL_ID = /^[a-z0-9][a-z0-9-]{1,80}$/u;

interface InternalDownload {
  controller: AbortController;
  snapshot: LocalModelDownloadSnapshot;
}

function fail(message: string): never { throw new Error(message); }
function currentDataDirectory(): string {
  // 模型由项目与存储设置的统一 Data 根拥有；不可从 API/Client 收取模型绝对路径。
  const { getProjectStorageLocations } = projectStorageModule;
  return getProjectStorageLocations().settings.contentDirectory;
}

function isInside(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function validateDefinition(adapter: LocalModelAdapter): void {
  const definition = adapter.definition;
  if (!MODEL_ID.test(definition.id)) throw new Error("本地模型适配器 ID 无效。");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(definition.repository)) throw new Error("本地模型仓库必须是固定的 Hugging Face 仓库标识。");
  if (!definition.modelDirectory || definition.modelDirectory.includes("\\") || definition.modelDirectory.includes("\0") || isAbsolute(definition.modelDirectory)) throw new Error("本地模型相对目录无效。");
  const segments = definition.modelDirectory.split("/");
  if (segments.length !== 2 || segments[0] !== definition.modality || segments.some(segment => !segment || segment === "." || segment === ".." || segment.startsWith("."))) {
    throw new Error("本地模型必须放在对应模态的 LFAA models 子目录中。");
  }
}

async function safeModelDirectory(dataDirectory: string, adapter: LocalModelAdapter, create = false): Promise<string> {
  const paths = resolveDataPaths(dataDirectory);
  if (create) ensureDataDirectories(dataDirectory);
  const modelsRoot = resolve(paths.models);
  const target = resolve(modelsRoot, adapter.definition.modelDirectory);
  if (!isInside(modelsRoot, target)) return fail("本地模型目录超出 LFAA Data/models 根。");
  if (create) {
    const parts = relative(modelsRoot, target).split(sep);
    let cursor = modelsRoot;
    for (const part of parts) {
      cursor = join(cursor, part);
      try {
        const info = await lstat(cursor);
        if (info.isSymbolicLink() || !info.isDirectory()) return fail("本地模型目录包含符号链接或非目录对象。");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        await mkdir(cursor);
      }
    }
  }
  return target;
}

async function inspectAdapter(adapter: LocalModelAdapter, directory: string): Promise<LocalModelSummary> {
  const definition = adapter.definition;
  try {
    const info = await lstat(directory);
    if (info.isSymbolicLink() || !info.isDirectory() || resolve(await realpath(directory)) !== resolve(directory)) {
      return { id: definition.id, name: definition.name, family: definition.family, modality: definition.modality, task: definition.task, repository: definition.repository, licenseName: definition.licenseName, licenseUrl: definition.licenseUrl, directory: `models/${definition.modelDirectory}`, estimatedDownloadBytes: definition.estimatedDownloadBytes, installedBytes: 0, installed: false, loaded: adapter.isLoaded?.() ?? false, ready: false, reason: "模型目录必须是 LFAA Data/models 下的普通目录。" };
    }
    const inspection = await definition.inspect(directory);
    const manifest = await readInstalledManifest(directory, definition.id);
    const installedBytes = manifest?.totalBytes ?? await directoryBytes(directory);
    return { id: definition.id, name: definition.name, family: definition.family, modality: definition.modality, task: definition.task, repository: definition.repository, licenseName: definition.licenseName, licenseUrl: definition.licenseUrl, directory: `models/${definition.modelDirectory}`, estimatedDownloadBytes: definition.estimatedDownloadBytes, installedBytes, installed: installedBytes > 0, loaded: adapter.isLoaded?.() ?? false, ready: inspection.ready, reason: inspection.reason };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { id: definition.id, name: definition.name, family: definition.family, modality: definition.modality, task: definition.task, repository: definition.repository, licenseName: definition.licenseName, licenseUrl: definition.licenseUrl, directory: `models/${definition.modelDirectory}`, estimatedDownloadBytes: definition.estimatedDownloadBytes, installedBytes: 0, installed: false, loaded: adapter.isLoaded?.() ?? false, ready: false, reason: null };
    throw error;
  }
}

async function readInstalledManifest(directory: string, modelId: string): Promise<{ totalBytes: number } | null> {
  const path = join(directory, ".lfaa-model.json");
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isFile() || info.size > 16 * 1024) return null;
    const value = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    if (value.format !== "lfaa-local-model-v1" || value.id !== modelId || !Number.isSafeInteger(value.totalBytes) || Number(value.totalBytes) < 0) return null;
    return { totalBytes: Number(value.totalBytes) };
  } catch { return null; }
}

async function directoryBytes(directory: string): Promise<number> {
  let total = 0;
  const pending = [directory];
  let files = 0;
  while (pending.length) {
    const current = pending.pop()!;
    const entries = await readdir(current, { withFileTypes: true });
    if (entries.length > 10_000 || files > 100_000) throw new Error("本地模型目录文件数超过扫描上限。");
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isSymbolicLink()) continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile()) {
        files += 1;
        const info = await stat(path);
        if (info.size <= Number.MAX_SAFE_INTEGER - total) total += info.size;
      }
    }
  }
  return total;
}

function snapshotFor(modelId: string, id = randomUUID()): LocalModelDownloadSnapshot {
  const now = new Date().toISOString();
  return { id, modelId, status: "queued", receivedBytes: 0, totalBytes: null, completedFiles: 0, totalFiles: null, message: null, startedAt: now, updatedAt: now };
}

function mergeProgress(snapshot: LocalModelDownloadSnapshot, progress: HubDownloadProgress): LocalModelDownloadSnapshot {
  return { ...snapshot, status: "downloading", receivedBytes: progress.receivedBytes, totalBytes: progress.totalBytes, completedFiles: progress.completedFiles, totalFiles: progress.totalFiles, message: null, updatedAt: new Date().toISOString() };
}

class LocalModelRuntime implements LocalModelRuntimeService {
  private readonly adapters = new Map<string, LocalModelAdapter>();
  private readonly downloads = new Map<string, InternalDownload>();
  private activeDownloadId: string | null = null;
  private generationActive = false;
  private disposed = false;

  registerAdapter(adapter: LocalModelAdapter): () => void {
    if (this.disposed) throw new Error("LFAA 本地模型 Runtime 已卸载。");
    validateDefinition(adapter);
    if (this.adapters.has(adapter.definition.id)) throw new Error(`本地模型适配器 ID 重复：${adapter.definition.id}`);
    this.adapters.set(adapter.definition.id, adapter);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.adapters.delete(adapter.definition.id);
      void adapter.unload();
    };
  }

  async listModels(): Promise<LocalModelSummary[]> {
    const dataDirectory = currentDataDirectory();
    ensureDataDirectories(dataDirectory);
    return await Promise.all([...this.adapters.values()].map(async adapter => inspectAdapter(adapter, await safeModelDirectory(dataDirectory, adapter))));
  }

  async startDownload(modelId: string): Promise<LocalModelDownloadSnapshot> {
    if (this.disposed) return fail("LFAA 本地模型 Runtime 已卸载。");
    if (this.generationActive) return fail("本机模型正在推理，请完成后再开始下载。");
    if (this.activeDownloadId) {
      const active = this.downloads.get(this.activeDownloadId)?.snapshot;
      if (active && active.modelId === modelId && (active.status === "queued" || active.status === "downloading")) return active;
      return fail("另一个本地模型正在下载，请等待完成或取消后再试。");
    }
    const adapter = this.adapters.get(modelId);
    if (!adapter) return fail("所选模型没有 LFAA 官方适配器。");
    const snapshot = snapshotFor(modelId);
    const controller = new AbortController();
    this.downloads.set(snapshot.id, { controller, snapshot });
    this.activeDownloadId = snapshot.id;
    void this.runDownload(snapshot.id, adapter);
    return snapshot;
  }

  private async runDownload(downloadId: string, adapter: LocalModelAdapter): Promise<void> {
    const download = this.downloads.get(downloadId);
    if (!download) return;
    const { controller } = download;
    try {
      const dataDirectory = currentDataDirectory();
      const modelDirectory = await safeModelDirectory(dataDirectory, adapter, true);
      const result = await downloadHubModel(adapter.definition, modelDirectory, controller.signal, progress => {
        const current = this.downloads.get(downloadId);
        if (current) current.snapshot = mergeProgress(current.snapshot, progress);
      });
      const current = this.downloads.get(downloadId);
      if (current) current.snapshot = { ...current.snapshot, status: "completed", totalBytes: result.totalBytes, receivedBytes: result.totalBytes, totalFiles: result.totalFiles, completedFiles: result.totalFiles, message: `模型文件已校验并写入 ${adapter.definition.modelDirectory}。`, updatedAt: new Date().toISOString() };
    } catch (error) {
      const current = this.downloads.get(downloadId);
      if (current) {
        const cancelled = controller.signal.aborted;
        current.snapshot = { ...current.snapshot, status: cancelled ? "cancelled" : "failed", message: error instanceof Error ? error.message.slice(0, 600) : "本地模型下载失败。", updatedAt: new Date().toISOString() };
      }
    } finally {
      if (this.activeDownloadId === downloadId) this.activeDownloadId = null;
      this.trimSnapshots();
    }
  }

  getDownload(downloadId: string): LocalModelDownloadSnapshot | null {
    this.trimSnapshots();
    return this.downloads.get(downloadId)?.snapshot ?? null;
  }

  getActiveDownload(): LocalModelDownloadSnapshot | null {
    const snapshot = this.activeDownloadId ? this.downloads.get(this.activeDownloadId)?.snapshot : null;
    return snapshot && (snapshot.status === "queued" || snapshot.status === "downloading") ? snapshot : null;
  }

  cancelDownload(downloadId: string): boolean {
    const download = this.downloads.get(downloadId);
    if (!download || (download.snapshot.status !== "queued" && download.snapshot.status !== "downloading")) return false;
    download.controller.abort(new Error("用户取消模型下载。"));
    return true;
  }

  async generateImage(request: LocalImageRequest): Promise<LocalImageResult> {
    const adapter = this.adapters.get(request.modelId);
    if (!adapter?.generateImage) return fail("所选本地模型没有已接入的 LFAA 生图适配器。");
    if (this.generationActive) return fail("LFAA 本机当前正在执行另一项模型推理，请稍后重试。");
    const downloading = this.activeDownloadId ? this.downloads.get(this.activeDownloadId)?.snapshot : null;
    if (downloading?.modelId === request.modelId && (downloading.status === "queued" || downloading.status === "downloading")) return fail("所选模型仍在下载，完成后再运行推理。");
    this.generationActive = true;
    try {
      const directory = await safeModelDirectory(currentDataDirectory(), adapter);
      const summary = await inspectAdapter(adapter, directory);
      if (!summary.installed || !summary.ready) return fail(summary.reason ?? "所选本地生图模型尚未安装或模型目录不完整。");
      await Promise.all([...this.adapters.values()].filter(candidate => candidate !== adapter).map(candidate => candidate.unload()));
      return await adapter.generateImage(directory, request);
    } finally { this.generationActive = false; }
  }

  async generateVideo(request: LocalVideoRequest): Promise<LocalVideoResult> {
    const adapter = this.adapters.get(request.modelId);
    if (!adapter?.generateVideo) return fail("所选本地模型没有已接入的 LFAA 视频生成适配器。");
    if (this.generationActive) return fail("LFAA 本机当前正在执行另一项模型推理，请稍后重试。");
    const downloading = this.activeDownloadId ? this.downloads.get(this.activeDownloadId)?.snapshot : null;
    if (downloading?.modelId === request.modelId && (downloading.status === "queued" || downloading.status === "downloading")) return fail("所选模型仍在下载，完成后再运行推理。");
    this.generationActive = true;
    try {
      const directory = await safeModelDirectory(currentDataDirectory(), adapter);
      const summary = await inspectAdapter(adapter, directory);
      if (!summary.installed || !summary.ready) return fail(summary.reason ?? "所选本地视频模型尚未安装或模型目录不完整。");
      await Promise.all([...this.adapters.values()].filter(candidate => candidate !== adapter).map(candidate => candidate.unload()));
      return await adapter.generateVideo(directory, request);
    } finally { this.generationActive = false; }
  }

  async saveWorkspaceAsset(userId: string, directory: "input" | "output", name: string, mimeType: string, bytes: Buffer) {
    return await saveWorkspaceAssetFile(currentDataDirectory(), userId, directory, name, mimeType, bytes);
  }

  async removeWorkspaceAsset(userId: string, asset: LocalWorkspaceAsset): Promise<void> {
    await removeWorkspaceAssetFile(currentDataDirectory(), userId, asset);
  }

  async unload(modelId?: string): Promise<void> {
    if (this.generationActive) return fail("本机模型正在推理，暂时不能释放模型内存。");
    const adapters = modelId ? [this.adapters.get(modelId)].filter((item): item is LocalModelAdapter => Boolean(item)) : [...this.adapters.values()];
    await Promise.all(adapters.map(adapter => adapter.unload()));
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    for (const download of this.downloads.values()) download.controller.abort(new Error("LFAA 本地模型 Runtime 正在卸载。"));
    await Promise.allSettled([...this.adapters.values()].map(adapter => adapter.unload()));
  }

  private trimSnapshots(): void {
    const now = Date.now();
    for (const [id, download] of this.downloads) {
      const terminal = download.snapshot.status === "completed" || download.snapshot.status === "failed" || download.snapshot.status === "cancelled";
      if (terminal && now - Date.parse(download.snapshot.updatedAt) > SNAPSHOT_RETENTION_MS) this.downloads.delete(id);
    }
    if (this.downloads.size <= MAX_DOWNLOAD_SNAPSHOTS) return;
    const terminal = [...this.downloads.values()].filter(item => item.snapshot.status === "completed" || item.snapshot.status === "failed" || item.snapshot.status === "cancelled").sort((a, b) => Date.parse(a.snapshot.updatedAt) - Date.parse(b.snapshot.updatedAt));
    for (const item of terminal.slice(0, this.downloads.size - MAX_DOWNLOAD_SNAPSHOTS)) this.downloads.delete(item.snapshot.id);
  }
}

export const name = "lfaaLocalModelRuntime";

export function apply(ctx: Context): void {
  const runtime = new LocalModelRuntime();
  ctx.provide(name, runtime);
  ctx.effect(() => () => { void runtime.dispose(); });
}

export type {
  LocalImageRequest, LocalImageResult, LocalModelAdapter, LocalModelDefinition, LocalModelDownloadSnapshot, LocalWorkspaceAsset, LocalWorkspaceDirectory,
  LocalModelDownloadStatus, LocalModelModality, LocalModelRuntimeService, LocalModelSummary, LocalVideoRequest, LocalVideoResult
} from "./contracts.js";
export { ManagedPythonWorker } from "./managed-python-worker.js";
