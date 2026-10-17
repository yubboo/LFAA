/**
 * 功能：管理当前 LFAA Profile 的第三方插件来源、安装快照和运行状态。
 * 作用：固定 GitHub/NPM/本机内容版本，安全展开源码、原子写入清单，并向 AI Tools 提供通用管理能力。
 * 关联文件：source-resolution.ts、github-source.ts、zip-archive.ts、core/tools、api/plugin-controller；不在控制端主进程加载任意外部代码。
 */
import { randomUUID } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, fsyncSync } from "node:fs";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import { config } from "lfaa-launch-environment/src/config.js";
import { atomicWrite } from "lfaa-storage-json/src/index.js";
import type { CapabilityApplicationId, CapabilityInstallRegistry } from "lfaa-capability-installs/src/index.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { WindowsAppContainerPluginRuntime } from "./windows-appcontainer-runtime.js";
import { DshWallpaperEngineRuntime } from "./dsh-wallpaper-engine-runtime.js";
import { searchGithubRepositories } from "./github-source.js";
import { resolvePluginSource, type PluginSourceSnapshot, type PluginSourceType } from "./source-resolution.js";
import type { PluginArchiveFile } from "./zip-archive.js";

const INVENTORY_VERSION = 4;
const MAX_INSTALLED_PLUGINS = 128;
const MAX_ACTIVE_PLUGIN_COUNT = 4;
const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,119}$/u;
const WALLPAPER_ENGINE_REPOSITORY = "https://github.com/elysia395/dsh-wallpaper-engine";
const WALLPAPER_ENGINE_RECORD_ID = "elysia395-dsh-wallpaper-engine";
const WALLPAPER_ENGINE_PACKAGE_ID = "dsh-plugin-wallpaper-engine";

export type PluginCompatibility = "lfaa-v1" | "dsh-v1" | "unsupported";
export interface PluginRecord {
  id: string;
  name: string;
  version: string;
  description: string;
  source: { kind: PluginSourceType; repository: string; requestedRef: string; commit: string; archiveSha256: string; license: string | null };
  compatibility: PluginCompatibility;
  runtimeEntry: string | null;
  capabilities: string[];
  applicationIds: CapabilityApplicationId[];
  state: "installed" | "enabled" | "incompatible";
  reason: string | null;
  installedAt: string;
  installedBy: string;
}
interface InventoryDocument { version: number; profile: string; plugins: PluginRecord[] }
interface PackageManifest { name?: unknown; version?: unknown; description?: unknown; license?: unknown; lfaa?: unknown; dsh?: unknown; peerDependencies?: unknown; dependencies?: unknown; engines?: unknown; main?: unknown; exports?: unknown; scripts?: unknown }
export interface PluginRequirements {
  dshVersion: string | null;
  hostEntry: string | null;
  bundlePatch: string | null;
  clientEntry: string | null;
  clientPlatform: string | null;
  clientInject: string[];
  peerDependencies: Record<string, string>;
  packageDependencies: string[];
  declaredScripts: string[];
}
export interface PluginRuntimeAdapter {
  supports(record: PluginRecord): boolean;
  /** 检查已完成归档校验但尚未写入磁盘的源码快照；同一结果用于预览、安装与更新。 */
  inspectSnapshot?(record: PluginRecord, files: readonly PluginArchiveFile[]): { supported: boolean; reason: string | null };
  /** 只接受此适配器明确声明的源码合同；通用 LFAA 插件须由隔离 Host 执行，固定 DSH 壁纸插件走其专用 Cordis Loader。 */
  enable(record: PluginRecord, installedDirectory: string): Promise<void>;
  /** 必须等待对应 Runtime 停止并撤销其资源后返回，供清单更新和后续移除使用。 */
  disable(record: PluginRecord, installedDirectory: string): Promise<void>;
  /** 停止后删除此 Runtime 独占的运行副本与私有数据；失败时保留安装记录以便重试。 */
  remove?(record: PluginRecord): Promise<void>;
  /** 进程意外退出后，清单查询必须以实际 Host 状态为准。 */
  isActive?(record: PluginRecord): boolean;
}

export interface PluginCapabilityInstallResult {
  plugin: PluginRecord;
  /** 新安装可运行但启用失败时，模型必须把它报告为未就绪。 */
  activationRequired: boolean;
  activationError?: string;
}

export type PluginInstallProgressStage = "resolving" | "source-verified" | "compatibility-checked" | "writing-files" | "committing-inventory" | "already-installed" | "installed";
export interface PluginInstallProgress {
  stage: PluginInstallProgressStage;
  message: string;
  pluginId?: string;
  name?: string;
  version?: string;
  sourceType?: PluginSourceType;
  resolvedRef?: string;
  archiveSha256?: string;
  fileCount?: number;
  totalBytes?: number;
  state?: PluginRecord["state"];
}
export interface PluginInstallOptions {
  npmRegistry?: string;
  expectedResolvedRef?: string;
  expectedSource?: { kind: PluginSourceType; location: string };
  onProgress?: (progress: PluginInstallProgress) => void | Promise<void>;
}

export class PluginManagerError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "PluginManagerError"; }
}

export class PluginManager {
  private readonly root: string;
  private readonly inventoryPath: string;
  private readonly adapters: PluginRuntimeAdapter[] = [];
  private readonly activeIds = new Set<string>();
  private mutationActive = false;

  constructor(readonly profile: string, dataDirectory = config.dataDirectory, runtime?: PluginRuntimeAdapter) {
    if (!/^[a-z][a-z0-9-]{0,63}$/u.test(profile)) throw new Error("当前 Profile 名称无效。");
    this.root = resolve(dataDirectory, "plugins", "profiles", profile);
    this.inventoryPath = resolve(this.root, "inventory.json");
    mkdirSync(this.root, { recursive: true, mode: 0o700 });
    if (runtime) this.registerRuntimeAdapter(runtime);
  }

  registerRuntimeAdapter(adapter: PluginRuntimeAdapter): void {
    if (this.adapters.includes(adapter)) throw new Error("插件运行适配器重复登记。");
    this.adapters.push(adapter);
  }

  list(): PluginRecord[] { return this.readInventory().plugins.map((record) => this.viewRecord(record)); }
  get(id: string): PluginRecord | null { return this.list().find((record) => record.id === id) ?? null; }
  async search(query: string) {
    return searchGithubRepositories(query).then((repositories) => repositories.map((repository) => ({
      ...repository,
      sourceType: "github" as const,
      requiresInspection: true,
      warning: repository.license ? "搜索结果仅是候选来源；安装前仍需检查清单和兼容性。" : "仓库没有可确认的 SPDX 许可证；安装前需检查来源和许可证。"
    })));
  }

  async inspect(source: string, ref?: string, applicationId: CapabilityApplicationId = "workspace", npmRegistry?: string) {
    const snapshot = await resolvePluginSource(source, ref, npmRegistry);
    const detected = inspectSnapshot(snapshot);
    const preview = this.previewRecord(snapshot, detected.record, detected.license, applicationId);
    const adapter = this.adapters.find((item) => item.supports(preview));
    const sourceCheck = adapter?.inspectSnapshot?.(preview, snapshot.files);
    const canEnable = Boolean(adapter && (sourceCheck?.supported ?? true));
    return {
      ...detected.record,
      requirements: inspectRequirements(snapshot),
      repository: snapshot.repository,
      sourceType: snapshot.sourceType,
      sourceLocation: snapshot.sourceLocation,
      registryUrl: snapshot.registryUrl ?? null,
      requestedRef: snapshot.requestedRef,
      resolvedRef: snapshot.commit,
      resolvedCommit: snapshot.commit,
      archiveSha256: snapshot.archiveSha256,
      applicationIds: [applicationId],
      license: detected.license ?? snapshot.repository.license,
      canEnable,
      runtimeReason: detected.reason ?? (canEnable ? null : sourceCheck?.reason ?? runtimeUnavailableReason(preview, this.adapters))
    };
  }

  async install(source: string, ref: string | undefined, userId: string, applicationId: CapabilityApplicationId = "workspace", options: PluginInstallOptions = {}): Promise<PluginRecord> {
    return this.exclusive(() => this.installLocked(source, ref, userId, applicationId, options));
  }

  /** Install and activate a supported plugin as one serialized Profile mutation. */
  async installForCapability(source: string, ref: string | undefined, userId: string, applicationId: CapabilityApplicationId = "workspace", expectedResolvedRef?: string, expectedSource?: { kind: PluginSourceType; location: string }): Promise<PluginCapabilityInstallResult> {
    return this.exclusive(async () => {
      const snapshot = await resolvePluginSource(source, ref);
      if (expectedResolvedRef !== undefined && snapshot.commit !== expectedResolvedRef) throw new PluginManagerError("plugin_source_changed", "插件来源自检查后发生变化，当前检查凭证已失效；请重新检查来源。没有写入插件清单。");
      if (expectedSource && (snapshot.sourceType !== expectedSource.kind || normalizePluginSourceLocation(snapshot.sourceLocation, snapshot.sourceType) !== normalizePluginSourceLocation(expectedSource.location, expectedSource.kind))) throw new PluginManagerError("plugin_source_changed", "插件来源与检查凭证不一致；请重新检查来源。没有写入插件清单。");
      const detected = inspectSnapshot(snapshot);
      const existing = this.readInventory().plugins.find((record) => record.id === detected.record.id);
      const plugin = await this.installSnapshotLocked(snapshot, detected, userId, applicationId);
      const isRevisionUpdate = Boolean(existing && existing.source.commit !== plugin.source.commit);
      if (isRevisionUpdate || plugin.state !== "installed") return { plugin, activationRequired: false };
      try {
        return { plugin: await this.setEnabledLocked(plugin.id, true, applicationId), activationRequired: false };
      } catch (error) {
        const current = this.get(plugin.id) ?? plugin;
        return { plugin: current, activationRequired: true, activationError: activationFailureSummary(error) };
      }
    });
  }

  private async installLocked(source: string, ref: string | undefined, userId: string, applicationId: CapabilityApplicationId, options: PluginInstallOptions): Promise<PluginRecord> {
    const report = options.onProgress;
    await report?.({ stage: "resolving", message: "正在读取来源清单并获取固定版本。" });
    const snapshot = await resolvePluginSource(source, ref, options.npmRegistry);
    if (options.expectedResolvedRef !== undefined && snapshot.commit !== options.expectedResolvedRef) throw new PluginManagerError("plugin_source_changed", "插件来源自检查后发生变化，当前检查凭证已失效；请重新检查来源。没有写入插件清单。");
    if (options.expectedSource && (snapshot.sourceType !== options.expectedSource.kind || normalizePluginSourceLocation(snapshot.sourceLocation, snapshot.sourceType) !== normalizePluginSourceLocation(options.expectedSource.location, options.expectedSource.kind))) throw new PluginManagerError("plugin_source_changed", "插件来源与检查凭证不一致；请重新检查来源。没有写入插件清单。");
    await report?.({
      stage: "source-verified",
      message: `已锁定 ${snapshot.repository.fullName} 的固定内容版本。`,
      name: snapshot.repository.fullName,
      version: snapshot.repository.defaultBranch,
      sourceType: snapshot.sourceType,
      resolvedRef: snapshot.commit,
      archiveSha256: snapshot.archiveSha256,
      fileCount: snapshot.files.length,
      totalBytes: snapshot.files.reduce((total, file) => total + file.contents.length, 0)
    });
    const detected = inspectSnapshot(snapshot);
    const preview = this.previewRecord(snapshot, detected.record, detected.license, applicationId);
    const adapter = this.adapters.find((item) => item.supports(preview));
    const sourceCheck = adapter?.inspectSnapshot?.(preview, snapshot.files);
    const canEnable = Boolean(adapter && (sourceCheck?.supported ?? true));
    await report?.({
      stage: "compatibility-checked",
      message: canEnable ? "来源合同和兼容 Runtime 检查通过。" : detected.reason ?? sourceCheck?.reason ?? runtimeUnavailableReason(preview, this.adapters),
      pluginId: detected.record.id,
      name: detected.record.name,
      version: detected.record.version,
      state: canEnable ? "installed" : "incompatible"
    });
    const plugin = await this.installSnapshotLocked(snapshot, detected, userId, applicationId, report);
    await report?.({ stage: "installed", message: plugin.state === "incompatible" ? "来源快照已安全写入；插件因当前 Runtime 不兼容而保持隔离。" : "插件已写入 Profile 清单，尚未启动。", pluginId: plugin.id, name: plugin.name, version: plugin.version, state: plugin.state });
    return plugin;
  }

  private async installSnapshotLocked(
    snapshot: PluginSourceSnapshot,
    detected: ReturnType<typeof inspectSnapshot>,
    userId: string,
    applicationId: CapabilityApplicationId,
    onProgress?: PluginInstallOptions["onProgress"],
  ): Promise<PluginRecord> {
    if (detected.record.compatibility === "unsupported") throw new PluginManagerError("plugin_contract_unsupported", detected.reason ?? "仓库没有可识别的插件合同；未写入插件目录。" );
    const preview = this.previewRecord(snapshot, detected.record, detected.license, applicationId);
    const adapter = this.adapters.find((item) => item.supports(preview));
    const existing = this.readInventory().plugins.find((record) => record.id === detected.record.id);
    if (existing) {
      const sameRepository = samePluginSource(existing.source, snapshot);
      if (existing.source.commit === snapshot.commit && sameRepository && existing.applicationIds.length === 1 && existing.applicationIds[0] === applicationId) {
        await onProgress?.({ stage: "already-installed", message: "相同来源和固定版本已在此 Profile 中登记。", pluginId: existing.id, name: existing.name, version: existing.version, state: existing.state });
        return this.viewRecord(existing);
      }
      if (existing.source.commit === snapshot.commit && sameRepository) throw new PluginManagerError("plugin_target_conflict", `插件 ${existing.id} 已登记到 ${existing.applicationIds.join("、")}；不会静默扩大或改变 App 范围。`);
      if (isWallpaperEngineUpdate(existing, detected.record, snapshot)) {
        const next = this.previewRecord(snapshot, detected.record, detected.license, applicationId);
        const previousAdapter = this.adapters.find((item) => item.supports(existing));
        const nextAdapter = this.adapters.find((item) => item.supports(next));
        if (!previousAdapter || previousAdapter !== nextAdapter) throw new PluginManagerError("plugin_revision_incompatible", "新 Wallpaper Engine 版本不符合当前 Host/Client 兼容适配；原版本保持不变。" );
        const nextSourceCheck = nextAdapter.inspectSnapshot?.(next, snapshot.files);
        if (nextSourceCheck?.supported === false) throw new PluginManagerError("plugin_revision_incompatible", nextSourceCheck.reason ?? "新 Wallpaper Engine 版本不符合当前 Host/Client 兼容适配；原版本保持不变。" );
        if (existing.applicationIds.length !== 1 || existing.applicationIds[0] !== applicationId) throw new PluginManagerError("plugin_target_conflict", `插件 ${existing.id} 已登记到 ${existing.applicationIds.join("、")}；不会静默扩大或改变 App 范围。`);
        if (existing.state === "enabled" || this.isActive(existing, previousAdapter)) throw new PluginManagerError("plugin_disable_required", "更新 Wallpaper Engine 前须先停用当前版本；没有覆盖已启用运行目录。" );
        await onProgress?.({ stage: "writing-files", message: "正在安全写入已检查的新版本文件。", pluginId: existing.id, name: detected.record.name, version: detected.record.version, fileCount: snapshot.files.length });
        const updated = await this.replaceVerifiedWallpaperRevision(existing, snapshot, detected.record, detected.license, userId);
        await onProgress?.({ stage: "committing-inventory", message: "插件版本清单已原子更新。", pluginId: updated.id, name: updated.name, version: updated.version, state: updated.state });
        return updated;
      }
      throw new PluginManagerError("plugin_id_conflict", `插件 ${existing.id} 已安装；当前操作不会覆盖现有版本。`);
    }
    const sourceCheck = adapter?.inspectSnapshot?.(preview, snapshot.files);
    const previousInventory = this.readInventory();
    if (previousInventory.plugins.length >= MAX_INSTALLED_PLUGINS) throw new PluginManagerError("plugin_inventory_limit", "当前 Profile 已达到插件数量上限。");
    const now = new Date().toISOString();
    const runtimeSupported = Boolean(adapter && (sourceCheck?.supported ?? true));
    const record: PluginRecord = {
      ...detected.record,
      applicationIds: [applicationId],
      source: { kind: snapshot.sourceType, repository: snapshot.sourceLocation, requestedRef: snapshot.requestedRef, commit: snapshot.commit, archiveSha256: snapshot.archiveSha256, license: detected.license ?? snapshot.repository.license },
      state: runtimeSupported ? "installed" : "incompatible",
      reason: detected.reason ?? (runtimeSupported ? null : sourceCheck?.reason ?? runtimeUnavailableReason(detected.record, this.adapters)),
      installedAt: now,
      installedBy: userId
    };
    const destination = this.directory(record.id);
    if (existsSync(destination)) throw new PluginManagerError("plugin_recovery_required", "检测到清单外的同名插件目录；为保留现有文件，本次没有覆盖，请先检查数据目录。");
    const staging = resolve(this.root, `.stage-${randomUUID()}`);
    let moved = false;
    await onProgress?.({ stage: "writing-files", message: "正在将已验证文件写入安全暂存区；不会运行包内安装脚本。", pluginId: record.id, name: record.name, version: record.version, fileCount: snapshot.files.length });
    mkdirSync(staging, { recursive: false, mode: 0o700 });
    try {
      writeArchiveFiles(staging, snapshot.files);
      await onProgress?.({ stage: "committing-inventory", message: "文件校验与暂存完成，正在原子登记 Profile 清单。", pluginId: record.id, name: record.name, version: record.version, state: record.state });
      renameSync(staging, destination);
      moved = true;
      const nextInventory = { ...previousInventory, plugins: [...previousInventory.plugins, record] };
      try { atomicWrite(this.inventoryPath, nextInventory); }
      catch (error) { rmSync(destination, { recursive: true, force: true }); throw error; }
      await onProgress?.({ stage: "committing-inventory", message: "Profile 插件清单已保存。", pluginId: record.id, name: record.name, version: record.version, state: record.state });
      return structuredClone(record);
    } catch (error) {
      rmSync(staging, { recursive: true, force: true });
      // 清单登记失败或移动失败时不保留半安装目录。
      const saved = this.readInventory();
      if (moved && !saved.plugins.some((item) => item.id === record.id)) rmSync(destination, { recursive: true, force: true });
      throw error;
    }
  }

  async setEnabled(id: string, enabled: boolean, applicationId: CapabilityApplicationId = "workspace", expectedSourceCommit?: string): Promise<PluginRecord> {
    return this.exclusive(() => this.setEnabledLocked(id, enabled, applicationId, expectedSourceCommit));
  }

  private async setEnabledLocked(id: string, enabled: boolean, applicationId: CapabilityApplicationId, expectedSourceCommit?: string): Promise<PluginRecord> {
    const inventory = this.readInventory();
    const position = inventory.plugins.findIndex((record) => record.id === id);
    if (position < 0) throw new PluginManagerError("plugin_not_found", "当前 Profile 未安装此插件。");
    const record = inventory.plugins[position]!;
    if (!record.applicationIds.includes(applicationId)) throw new PluginManagerError("plugin_target_mismatch", "该插件没有登记到当前目标 App；没有执行生命周期操作。");
    if (expectedSourceCommit !== undefined && record.source.commit !== expectedSourceCommit) throw new PluginManagerError("plugin_revision_changed", "插件来源版本已变化；请刷新清单后重试生命周期操作。");
    const adapter = this.adapters.find((item) => item.supports(record));
    if (!adapter && enabled) throw new PluginManagerError("plugin_runtime_unsupported", record.reason ?? "没有适用于此插件的受支持 Runtime Adapter；插件仍保持未启用。");
    if (!adapter) throw new PluginManagerError("plugin_runtime_unavailable", "没有适用于此插件的受支持 Runtime Adapter；清单保持不变。");
    const isActive = this.isActive(record, adapter);
    if (enabled && isActive || !enabled && !isActive && record.state !== "enabled") return this.viewRecord(record);
    if (enabled) {
      this.list();
      if (this.activeIds.size >= MAX_ACTIVE_PLUGIN_COUNT) throw new PluginManagerError("plugin_runtime_capacity", `当前 Profile 最多同时运行 ${MAX_ACTIVE_PLUGIN_COUNT} 个第三方插件。`);
      await adapter.enable(record, this.directory(id));
      if (adapter.isActive && !adapter.isActive(record)) throw new PluginManagerError("plugin_start_failed", "插件 Runtime 未保持活动状态；插件仍保持未启用。" );
    }
    else await adapter.disable(record, this.directory(id));
    if (enabled) this.activeIds.add(id);
    else this.activeIds.delete(id);
    const next = { ...record, state: enabled ? "enabled" as const : "installed" as const, reason: null };
    inventory.plugins[position] = next;
    try { atomicWrite(this.inventoryPath, inventory); }
    catch (error) {
      if (enabled) this.activeIds.delete(id);
      else if (record.state === "enabled") this.activeIds.add(id);
      try { await (enabled ? adapter.disable(record, this.directory(id)) : adapter.enable(record, this.directory(id))); } catch { /* 运行适配器失败时以实际活动状态诊断，不覆盖清单错误。 */ }
      throw error;
    }
    return structuredClone(next);
  }

  /** Restore only plugins whose persisted Profile record says they were enabled. */
  async restoreEnabledPlugins(): Promise<Array<{ id: string; reason: string }>> {
    return this.exclusive(async () => {
      const records = this.readInventory().plugins.filter((record) => record.state === "enabled");
      const failures: Array<{ id: string; reason: string }> = [];
      for (const record of records) {
        const applicationId = record.applicationIds[0];
        if (!applicationId) continue;
        try {
          const restored = await this.setEnabledLocked(record.id, true, applicationId);
          if (restored.state !== "enabled") failures.push({ id: record.id, reason: "插件 Runtime 未保持启用状态。" });
        } catch (error) {
          failures.push({ id: record.id, reason: activationFailureSummary(error) });
        }
      }
      return failures;
    });
  }

  async remove(id: string, applicationId: CapabilityApplicationId = "workspace", expectedSourceCommit?: string): Promise<void> {
    return this.exclusive(async () => {
      const inventory = this.readInventory();
      const record = inventory.plugins.find((plugin) => plugin.id === id);
      if (!record) throw new PluginManagerError("plugin_not_found", "当前 Profile 未安装此插件。");
      if (expectedSourceCommit !== undefined && record.source.commit !== expectedSourceCommit) throw new PluginManagerError("plugin_revision_changed", "插件版本已变化，请刷新后重新卸载。");
      if (!record.applicationIds.includes(applicationId)) throw new PluginManagerError("plugin_target_mismatch", "该插件没有登记到当前目标 App；没有移除任何文件。");
      const adapter = this.adapters.find((item) => item.supports(record));
      const isActive = this.isActive(record, adapter);
      if (record.state === "enabled" && !adapter) throw new PluginManagerError("plugin_disable_required", "当前平台没有可用的运行时适配器来确认并清理旧 Host 状态。");
      if (adapter && (isActive || record.state === "enabled")) {
        await adapter.disable(record, this.directory(id));
        this.activeIds.delete(id);
      }
      await adapter?.remove?.(record);
      const directory = this.directory(id);
      const quarantine = resolve(this.root, `.remove-${randomUUID()}`);
      renameSync(directory, quarantine);
      try {
        inventory.plugins = inventory.plugins.filter((plugin) => plugin.id !== id);
        atomicWrite(this.inventoryPath, inventory);
      } catch (error) {
        renameSync(quarantine, directory);
        throw error;
      }
      rmSync(quarantine, { recursive: true, force: false });
    });
  }

  private directory(id: string): string {
    if (!PLUGIN_ID_PATTERN.test(id)) throw new PluginManagerError("plugin_id_invalid", "插件标识无效。");
    const path = resolve(this.root, id);
    if (!path.startsWith(`${this.root}${sep}`)) throw new PluginManagerError("plugin_path_invalid", "插件目录超出当前 Profile 范围。");
    return path;
  }

  private replaceVerifiedWallpaperRevision(
    existing: PluginRecord,
    snapshot: PluginSourceSnapshot,
    detected: Omit<PluginRecord, "source" | "state" | "installedAt" | "installedBy" | "applicationIds">,
    license: string | null,
    userId: string,
  ): PluginRecord {
    const destination = this.directory(existing.id);
    if (!existsSync(destination)) throw new PluginManagerError("plugin_recovery_required", "检测到清单内插件源码目录缺失；为保留现有数据，没有执行更新。" );
    const now = new Date().toISOString();
    const nextRecord: PluginRecord = {
      ...detected,
      applicationIds: [...existing.applicationIds],
      source: { kind: snapshot.sourceType, repository: snapshot.sourceLocation, requestedRef: snapshot.requestedRef, commit: snapshot.commit, archiveSha256: snapshot.archiveSha256, license: license ?? snapshot.repository.license },
      state: "installed",
      reason: null,
      installedAt: now,
      installedBy: userId
    };
    const staging = resolve(this.root, `.stage-${randomUUID()}`);
    const quarantine = resolve(this.root, `.update-${randomUUID()}`);
    mkdirSync(staging, { recursive: false, mode: 0o700 });
    let previousMoved = false;
    let replacementMoved = false;
    try {
      writeArchiveFiles(staging, snapshot.files);
      renameSync(destination, quarantine);
      previousMoved = true;
      renameSync(staging, destination);
      replacementMoved = true;
      const inventory = this.readInventory();
      const position = inventory.plugins.findIndex((record) => record.id === existing.id);
      if (position < 0 || inventory.plugins[position]!.source.commit !== existing.source.commit) throw new PluginManagerError("plugin_inventory_changed", "更新期间插件清单发生变化；已恢复原安装。" );
      inventory.plugins[position] = nextRecord;
      atomicWrite(this.inventoryPath, inventory);
    } catch (error) {
      if (replacementMoved) rmSync(destination, { recursive: true, force: true });
      if (previousMoved && existsSync(quarantine) && !existsSync(destination)) renameSync(quarantine, destination);
      rmSync(staging, { recursive: true, force: true });
      throw error;
    }
    rmSync(quarantine, { recursive: true, force: true });
    return structuredClone(nextRecord);
  }

  private previewRecord(snapshot: PluginSourceSnapshot, record: Omit<PluginRecord, "source" | "state" | "installedAt" | "installedBy" | "applicationIds">, license: string | null, applicationId: CapabilityApplicationId): PluginRecord {
    return {
      ...record,
      applicationIds: [applicationId],
      source: { kind: snapshot.sourceType, repository: snapshot.sourceLocation, requestedRef: snapshot.requestedRef, commit: snapshot.commit, archiveSha256: snapshot.archiveSha256, license: license ?? snapshot.repository.license },
      state: "installed", installedAt: "", installedBy: ""
    };
  }

  private isActive(record: PluginRecord, knownAdapter?: PluginRuntimeAdapter): boolean {
    if (!this.activeIds.has(record.id)) return false;
    const adapter = knownAdapter ?? this.adapters.find((item) => item.supports(record));
    if (adapter?.isActive && !adapter.isActive(record)) {
      this.activeIds.delete(record.id);
      return false;
    }
    return true;
  }

  private viewRecord(record: PluginRecord): PluginRecord {
    const adapter = this.adapters.find((item) => item.supports(record));
    if (record.state === "enabled" && this.isActive(record, adapter)) return structuredClone(record);
    const adapterAvailable = Boolean(adapter);
    return {
      ...structuredClone(record),
      state: adapterAvailable ? "installed" : "incompatible",
      reason: adapterAvailable ? null : record.reason ?? runtimeUnavailableReason(record, this.adapters)
    };
  }

  private readInventory(): InventoryDocument {
    let raw: unknown;
    try {
      if (statSync(this.inventoryPath).size > 1024 * 1024) throw new Error("插件清单超过允许大小。");
      raw = JSON.parse(readFileSync(this.inventoryPath, "utf8")) as unknown;
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: INVENTORY_VERSION, profile: this.profile, plugins: [] };
      throw new PluginManagerError("plugin_inventory_unreadable", "插件清单无法读取或格式损坏；没有覆盖任何现有插件。" );
    }
    if (!isRecord(raw) || ![1, 2, 3, INVENTORY_VERSION].includes(Number(raw.version)) || raw.profile !== this.profile || !Array.isArray(raw.plugins) || raw.plugins.length > MAX_INSTALLED_PLUGINS) {
      throw new PluginManagerError("plugin_inventory_invalid", "插件清单版本不支持或 Profile 不匹配。" );
    }
    const rawVersion = Number(raw.version);
    const plugins = raw.plugins as unknown[];
    if (plugins.some((item) => !isValidRecord(item, rawVersion))) throw new PluginManagerError("plugin_inventory_invalid", "插件清单包含无效记录。" );
    if (new Set(plugins.map((item) => (item as PluginRecord).id)).size !== plugins.length) throw new PluginManagerError("plugin_inventory_invalid", "插件清单包含重复插件 ID。" );
    return {
      version: INVENTORY_VERSION,
      profile: this.profile,
      plugins: plugins.map((item) => {
        const record = item as PluginRecord;
        return {
          ...record,
          source: { ...record.source, kind: record.source.kind ?? "github" },
          applicationIds: Array.isArray(record.applicationIds) ? [...record.applicationIds] : [...APPLICATION_IDS],
          runtimeEntry: typeof record.runtimeEntry === "string" ? record.runtimeEntry : null
        };
      })
    };
  }

  private async exclusive<T>(action: () => Promise<T>): Promise<T> {
    if (this.mutationActive) throw new PluginManagerError("plugin_operation_in_progress", "当前 Profile 正在执行插件生命周期操作，请稍后重试。");
    this.mutationActive = true;
    try { return await action(); } finally { this.mutationActive = false; }
  }
}

function isWallpaperEngineUpdate(
  existing: PluginRecord,
  detected: Omit<PluginRecord, "source" | "state" | "installedAt" | "installedBy" | "applicationIds">,
  snapshot: PluginSourceSnapshot,
): boolean {
  return existing.id === WALLPAPER_ENGINE_RECORD_ID && existing.name === WALLPAPER_ENGINE_PACKAGE_ID && existing.compatibility === "dsh-v1"
    && detected.id === WALLPAPER_ENGINE_RECORD_ID && detected.name === WALLPAPER_ENGINE_PACKAGE_ID && detected.compatibility === "dsh-v1"
    && isOfficialWallpaperSource(existing.source.kind, existing.source.repository)
    && isOfficialWallpaperSource(snapshot.sourceType, snapshot.sourceLocation);
}

function isOfficialWallpaperSource(kind: PluginSourceType, location: string): boolean {
  return kind === "github" ? normalizePluginRepository(location) === WALLPAPER_ENGINE_REPOSITORY
    : kind === "npm" && location === `npm:${WALLPAPER_ENGINE_PACKAGE_ID}`;
}

function samePluginSource(source: PluginRecord["source"], snapshot: PluginSourceSnapshot): boolean {
  if (source.kind !== snapshot.sourceType) return false;
  return normalizePluginSourceLocation(source.repository, source.kind) === normalizePluginSourceLocation(snapshot.sourceLocation, snapshot.sourceType);
}

function normalizePluginSourceLocation(value: string, kind: PluginSourceType): string {
  if (kind === "local") return value;
  return kind === "github" ? normalizePluginRepository(value) : value.toLocaleLowerCase("en-US");
}

function normalizePluginRepository(repository: string): string {
  return repository.replace(/\.git$/iu, "").replace(/\/+$/u, "").toLocaleLowerCase("en-US");
}

function activationFailureSummary(error: unknown): string {
  if (error instanceof PluginManagerError) return error.message.slice(0, 240);
  return "插件已安装，但 Runtime 启动失败；请检查插件状态和控制端日志。";
}

function inspectSnapshot(snapshot: PluginSourceSnapshot): { record: Omit<PluginRecord, "source" | "state" | "installedAt" | "installedBy" | "applicationIds">; license: string | null; reason: string | null } {
  const packageFile = snapshot.files.find((file) => file.path === "package.json");
  if (!packageFile) throw new PluginManagerError("plugin_manifest_missing", "插件来源根目录缺少 package.json，无法识别插件。");
  let manifest: PackageManifest;
  try { manifest = JSON.parse(packageFile.contents.toString("utf8")) as PackageManifest; }
  catch { throw new PluginManagerError("plugin_manifest_invalid", "插件 package.json 不是有效 JSON。"); }
  if (typeof manifest.name !== "string" || typeof manifest.version !== "string" || !/^[0-9A-Za-z][0-9A-Za-z._+-]{0,99}$/u.test(manifest.version)) {
    throw new PluginManagerError("plugin_manifest_invalid", "插件清单缺少有效包名或版本号。");
  }
  const lfaa = isRecord(manifest.lfaa) && isRecord(manifest.lfaa.plugin) ? manifest.lfaa.plugin : null;
  const dsh = isRecord(manifest.dsh) ? manifest.dsh : null;
  const compat: PluginCompatibility = lfaa?.apiVersion === 1 ? "lfaa-v1" : dsh && hasDshBundle(snapshot.files) ? "dsh-v1" : "unsupported";
  const runtimeEntry = resolvePluginEntry(lfaa?.entry, snapshot.files);
  const sourceName = snapshot.sourceType !== "github" && manifest.name === WALLPAPER_ENGINE_PACKAGE_ID
    ? WALLPAPER_ENGINE_RECORD_ID
    : snapshot.sourceType === "github" ? `${snapshot.repository.owner}-${snapshot.repository.name}` : `${snapshot.sourceType}-${manifest.name}`;
  const sourceId = lfaa && typeof lfaa.id === "string" ? lfaa.id
    : sourceName.toLocaleLowerCase("en-US").replace(/[^a-z0-9._-]+/gu, "-").replace(/^[^a-z0-9]+|[^a-z0-9]+$/gu, "");
  if (!PLUGIN_ID_PATTERN.test(sourceId)) throw new PluginManagerError("plugin_manifest_invalid", "插件清单没有有效且稳定的 LFAA 插件 ID。");
  const capabilities = lfaa && Array.isArray(lfaa.capabilities)
    ? lfaa.capabilities.filter((item): item is string => typeof item === "string" && /^[a-z][a-z0-9.-]{0,63}$/u.test(item)).slice(0, 32)
    : dsh ? ["dsh.bundle", ...(isRecord(dsh.client) ? ["dsh.client"] : [])] : [];
  if (lfaa && lfaa.apiVersion === 1 && (!Array.isArray(lfaa.capabilities) || capabilities.length !== lfaa.capabilities.length)) throw new PluginManagerError("plugin_manifest_invalid", "LFAA 插件清单的 capability 列表格式无效。");
  const declaredLicense = typeof manifest.license === "string" ? manifest.license : null;
  const license = declaredLicense && /^[A-Za-z0-9.+-]{1,40}$/u.test(declaredLicense) ? declaredLicense : snapshot.repository.license;
  const reason = compat === "unsupported" ? "来源包没有有效的 LFAA v1 插件合同或可识别的 DSH bundle 清单。" : null;
  return {
    record: {
      id: sourceId,
      name: typeof lfaa?.name === "string" ? lfaa.name.slice(0, 100) : manifest.name,
      version: manifest.version,
      description: typeof lfaa?.description === "string" ? lfaa.description.slice(0, 500) : typeof manifest.description === "string" ? manifest.description.slice(0, 500) : "",
      compatibility: compat,
      runtimeEntry,
      capabilities,
      reason
    },
    license,
    reason
  };
}

/** 从固定源码快照提取可审阅的运行依赖声明；仅读取清单，不导入入口或执行包脚本。 */
function inspectRequirements(snapshot: PluginSourceSnapshot): PluginRequirements {
  const packageFile = snapshot.files.find((file) => file.path === "package.json");
  if (!packageFile) throw new PluginManagerError("plugin_manifest_missing", "插件来源根目录缺少 package.json，无法读取插件依赖声明。");
  let manifest: PackageManifest;
  try { manifest = JSON.parse(packageFile.contents.toString("utf8")) as PackageManifest; }
  catch { throw new PluginManagerError("plugin_manifest_invalid", "插件 package.json 不是有效 JSON，无法读取依赖声明。"); }
  const files = new Set(snapshot.files.map((file) => file.path));
  const dsh = isRecord(manifest.dsh) ? manifest.dsh : null;
  const dshBundle = dsh && isRecord(dsh.bundle) ? dsh.bundle : null;
  const dshClient = dsh && isRecord(dsh.client) ? dsh.client : null;
  const peerDependencies = safeManifestStringMap(manifest.peerDependencies);
  const packageDependencies = safeManifestKeys(manifest.dependencies);
  const declaredScripts = safeManifestKeys(manifest.scripts);
  const dshPatch = safePackagePath(dshBundle?.patch, files);
  const hostEntry = safePackagePath(manifest.main, files);
  const clientExport = isRecord(manifest.exports) ? manifest.exports["./client"] : undefined;
  const clientDefault = isRecord(clientExport) ? clientExport.default : undefined;
  const clientEntry = safePackagePath(clientDefault, files);
  const declaredClientInject = dshClient?.inject;
  const clientInject = Array.isArray(declaredClientInject)
    ? declaredClientInject.filter((item): item is string => typeof item === "string" && /^[A-Za-z0-9@][A-Za-z0-9@._/-]{0,119}$/u.test(item)).slice(0, 24)
    : [];
  const engines = isRecord(manifest.engines) ? manifest.engines : null;
  return {
    dshVersion: typeof engines?.dsh === "string" ? safeManifestText(engines.dsh, 120) : null,
    hostEntry,
    bundlePatch: dshPatch,
    clientEntry,
    clientPlatform: typeof dshClient?.platform === "string" ? safeManifestText(dshClient.platform, 40) : null,
    clientInject,
    peerDependencies,
    packageDependencies,
    declaredScripts
  };
}

function safePackagePath(value: unknown, files: Set<string>): string | null {
  if (typeof value !== "string" || value.length > 512 || value.includes("\\") || value.startsWith("/")) return null;
  const normalized = value.replace(/^\.\//u, "");
  if (!normalized || normalized.split("/").some((part) => !part || part === "." || part === "..") || !files.has(normalized)) return null;
  return normalized;
}

function safeManifestKeys(value: unknown): string[] {
  if (!isRecord(value)) return [];
  return Object.keys(value).filter((key) => /^[A-Za-z0-9@._/-]{1,120}$/u.test(key)).sort().slice(0, 64);
}

function safeManifestStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([key, item]) => /^[A-Za-z0-9@._/-]{1,120}$/u.test(key) && typeof item === "string")
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 64)
    .map(([key, item]) => [key, safeManifestText(item as string, 120)]));
}

function safeManifestText(value: string, limit: number): string {
  return value.replace(/[\r\n\0]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, limit);
}

function hasDshBundle(files: PluginArchiveFile[]): boolean {
  const packageFile = files.find((file) => file.path === "package.json");
  if (!packageFile) return false;
  const manifest = JSON.parse(packageFile.contents.toString("utf8")) as PackageManifest;
  if (!isRecord(manifest.dsh) || !isRecord(manifest.dsh.bundle) || typeof manifest.dsh.bundle.patch !== "string") return false;
  const patchPath = manifest.dsh.bundle.patch.replace(/^\.\//u, "");
  return files.some((file) => file.path === patchPath);
}

function resolvePluginEntry(value: unknown, files: PluginArchiveFile[]): string | null {
  if (value === undefined) return null;
  if (typeof value !== "string" || !isSafePluginEntry(value)) {
    throw new PluginManagerError("plugin_manifest_invalid", "LFAA 插件运行入口必须是包内安全的 .mjs 相对路径。" );
  }
  if (!files.some((file) => file.path === value)) throw new PluginManagerError("plugin_manifest_invalid", "LFAA 插件运行入口不在已校验的源码归档中。" );
  return value;
}

function isSafePluginEntry(value: string): boolean {
  return value.length > 0 && value.length <= 512 && !value.includes("\\") && !value.startsWith("/")
    && value.endsWith(".mjs") && value.split("/").every((segment) => segment.length > 0 && segment.length <= 120
      && segment !== "." && segment !== ".." && /^[A-Za-z0-9._-]+$/u.test(segment));
}

function runtimeUnavailableReason(record: Pick<PluginRecord, "compatibility" | "runtimeEntry" | "capabilities">, adapters: PluginRuntimeAdapter[]): string {
  if (record.compatibility === "dsh-v1") return "此 DSH bundle 没有匹配其固定来源和版本的 LFAA 原生适配器；没有执行上游 Host 或 Client 代码。";
  if (record.runtimeEntry === null) return "LFAA 插件清单没有声明已归档校验的运行入口。";
  if (record.capabilities.length > 0) return "插件声明了当前 Runtime 尚未提供的能力，不能启用。";
  if (adapters.length === 0) return "当前运行平台没有可用的插件 Runtime。";
  return "当前 Profile 没有可运行此插件合同的 Runtime Adapter。";
}

function writeArchiveFiles(staging: string, files: PluginArchiveFile[]): void {
  for (const file of files) {
    const destination = resolve(staging, ...file.path.split("/"));
    if (!destination.startsWith(`${staging}${sep}`)) throw new PluginManagerError("plugin_path_invalid", "插件文件路径超出临时目录。");
    mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
    const descriptor = openSync(destination, "wx", 0o600);
    try { writeFileSync(descriptor, file.contents); fsyncSync(descriptor); } finally { closeSync(descriptor); }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isValidRecord(value: unknown, inventoryVersion: number): value is PluginRecord {
  if (!isRecord(value)) return false;
  const sourceKind = inventoryVersion < 4 ? "github" : isRecord(value.source) ? value.source.kind : undefined;
  const sourceLocation = isRecord(value.source) ? value.source.repository : undefined;
  const resolvedRef = isRecord(value.source) ? value.source.commit : undefined;
  const validSource = sourceKind === "github"
    ? typeof sourceLocation === "string" && /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(sourceLocation) && typeof resolvedRef === "string" && /^[a-f0-9]{40}$/iu.test(resolvedRef)
    : sourceKind === "npm"
      ? typeof sourceLocation === "string" && /^npm:(?:@[a-z0-9][a-z0-9._-]{0,99}\/[a-z0-9][a-z0-9._-]{0,99}|[a-z0-9][a-z0-9._-]{0,99})$/u.test(sourceLocation) && typeof resolvedRef === "string" && /^npm:(?:@[a-z0-9][a-z0-9._-]{0,99}\/[a-z0-9][a-z0-9._-]{0,99}|[a-z0-9][a-z0-9._-]{0,99})@[A-Za-z0-9][A-Za-z0-9.+_-]{0,99}:[a-f0-9]{64}$/u.test(resolvedRef)
      : sourceKind === "local" && typeof sourceLocation === "string" && sourceLocation.length <= 2048 && !/[\r\n\0]/u.test(sourceLocation) && isAbsolute(sourceLocation) && typeof resolvedRef === "string" && /^local:[a-f0-9]{64}$/iu.test(resolvedRef);
  return typeof value.id === "string" && PLUGIN_ID_PATTERN.test(value.id)
    && typeof value.name === "string" && typeof value.version === "string"
    && typeof value.description === "string" && isRecord(value.source)
    && (inventoryVersion < 4 || ["github", "npm", "local"].includes(String(value.source.kind))) && validSource
    && typeof value.source.archiveSha256 === "string" && /^[a-f0-9]{64}$/iu.test(value.source.archiveSha256)
    && ["lfaa-v1", "dsh-v1", "unsupported"].includes(String(value.compatibility))
    && (value.runtimeEntry === undefined || value.runtimeEntry === null || typeof value.runtimeEntry === "string" && isSafePluginEntry(value.runtimeEntry))
    && Array.isArray(value.capabilities) && value.capabilities.every((item) => typeof item === "string")
    && (inventoryVersion < 3 && value.applicationIds === undefined || Array.isArray(value.applicationIds) && value.applicationIds.length > 0 && value.applicationIds.every((item) => APPLICATION_IDS.includes(item as CapabilityApplicationId)) && new Set(value.applicationIds).size === value.applicationIds.length)
    && ["installed", "enabled", "incompatible"].includes(String(value.state))
    && (value.reason === null || typeof value.reason === "string")
    && typeof value.installedAt === "string" && typeof value.installedBy === "string";
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    lfaaPluginManager: PluginManager;
    profileContext: { name: string };
    lfaaCapabilityInstalls: CapabilityInstallRegistry;
  }
}
export const name = "lfaaPluginManager";
export const inject = ["profileContext", "lfaaCapabilityInstalls", "loader", "webServer"];
export async function apply(ctx: Context): Promise<void> {
  const runtime = ctx.get("loader") && ctx.get("webServer")
    ? new DshWallpaperEngineRuntime(ctx, ctx.profileContext.name, config.dataDirectory)
    : undefined;
  const manager = new PluginManager(ctx.profileContext.name, config.dataDirectory, runtime);
  if (WindowsAppContainerPluginRuntime.isAvailable()) manager.registerRuntimeAdapter(new WindowsAppContainerPluginRuntime());
  ctx.provide(name, manager);
  ctx.lfaaCapabilityInstalls.register(ctx, {
    kind: "plugin",
    applicationIds: APPLICATION_IDS,
    targetSchema: { type: "object", properties: {}, additionalProperties: false },
    targetDescription: "Profile 插件不需要额外的实例或项目目标；安装记录限定到 targetApplicationId。",
    authorize: (_operation, context) => { if (!new Set(["admin", "super_admin"]).has(context.userRole)) throw new PluginManagerError("plugin_admin_required", "只有管理员可以管理当前 Profile 的第三方插件。"); },
    validateTarget: target => {
      if (target !== undefined && (!isRecord(target) || Object.keys(target).length > 0)) throw new PluginManagerError("plugin_target_invalid", "Profile 插件不接受额外 target；请只指定目标 App。");
      return {};
    },
    revalidateTarget: target => {
      if (Object.keys(target).length) throw new PluginManagerError("plugin_target_invalid", "Profile 插件检查票据不应包含类型专属目标。");
      return {};
    },
    targetSummary: () => "Profile 插件",
    search: async query => ({ candidates: await manager.search(query) }),
    inspect: async (source, ref, applicationId) => {
      const plugin = await manager.inspect(source, ref, applicationId);
      const runStatus = plugin.canEnable ? "当前 Profile 有匹配的 LFAA Runtime Adapter" : `当前不可运行：${plugin.runtimeReason ?? "缺少兼容 Runtime Adapter"}`;
      return { resolvedRef: plugin.resolvedCommit, summary: `${plugin.name} ${plugin.version} · ${runStatus}`, details: { plugin } };
    },
    install: async (source, resolvedRef, applicationId, userId, target, details) => {
      const inspectedPlugin = isRecord(details) && isRecord(details.plugin) ? details.plugin : null;
      if (Object.keys(target).length || !inspectedPlugin || inspectedPlugin.resolvedCommit !== resolvedRef || typeof inspectedPlugin.requestedRef !== "string" || !["github", "npm", "local"].includes(String(inspectedPlugin.sourceType)) || typeof inspectedPlugin.sourceLocation !== "string" || !Array.isArray(inspectedPlugin.applicationIds) || inspectedPlugin.applicationIds.length !== 1 || inspectedPlugin.applicationIds[0] !== applicationId) {
        throw new PluginManagerError("plugin_inspection_mismatch", "检查凭证与固定提交或目标 App 不一致；没有安装插件。");
      }
      return await manager.installForCapability(source, inspectedPlugin.requestedRef || undefined, userId, applicationId, resolvedRef, { kind: inspectedPlugin.sourceType as PluginSourceType, location: inspectedPlugin.sourceLocation });
    },
    verifyInstalled: async (installation, _source, resolvedRef, applicationId, target, details) => {
      const installedPlugin = isRecord(installation) && isRecord(installation.plugin) ? installation.plugin : null;
      const inspectedPlugin = isRecord(details) && isRecord(details.plugin) ? details.plugin : null;
      const sourceLocation = inspectedPlugin && typeof inspectedPlugin.sourceLocation === "string" ? inspectedPlugin.sourceLocation : null;
      const sourceType = inspectedPlugin && typeof inspectedPlugin.sourceType === "string" ? inspectedPlugin.sourceType : null;
      if (Object.keys(target).length || !installedPlugin || typeof installedPlugin.id !== "string" || !inspectedPlugin || inspectedPlugin.resolvedCommit !== resolvedRef || !sourceLocation || !sourceType) {
        return { status: "unknown", verified: false, summary: "插件安装返回值或检查来源不完整，无法核验 Profile 清单。" };
      }
      const current = manager.get(installedPlugin.id);
      if (!current || current.source.kind !== sourceType || current.source.commit !== resolvedRef || normalizePluginSourceLocation(current.source.repository, current.source.kind) !== normalizePluginSourceLocation(sourceLocation, sourceType as PluginSourceType) || current.applicationIds.length !== 1 || current.applicationIds[0] !== applicationId) {
        return { status: "unknown", verified: false, summary: "Profile 清单没有找到与检查来源、固定提交和目标 App 完全匹配的插件记录。" };
      }
      const activationRequired = isRecord(installation) && installation.activationRequired === true;
      const activationError = isRecord(installation) && typeof installation.activationError === "string" ? installation.activationError : undefined;
      const status = current.state === "enabled" ? "ready" : current.state === "incompatible" ? "incompatible" : "installed";
      const summary = current.state === "enabled"
        ? `${current.name} 已由 Profile 清单确认启用，固定 DSH Host 与 Client Runtime 正在运行。`
        : current.state === "incompatible"
          ? `${current.name} 已写入 Profile 清单，但当前运行适配不兼容：${current.reason ?? "缺少受支持的隔离 Runtime。"}`
          : activationError
            ? `${current.name} 已写入 Profile 清单，但自动启用失败：${activationError}`
            : activationRequired === false
              ? `${current.name} 新 revision 已写入 Profile 清单，并按更新约定保持停用。`
              : `${current.name} 已写入 Profile 清单，当前尚未启用。`;
      return {
        status,
        verified: true,
        summary,
        details: { id: current.id, name: current.name, version: current.version, compatibility: current.compatibility, state: current.state, canEnable: current.state !== "incompatible", activationRequired, ...(activationError ? { activationError } : {}), applicationIds: current.applicationIds, commit: current.source.commit, runtimeReason: current.reason }
      };
    },
    list: applicationId => manager.list()
      .filter(plugin => plugin.applicationIds.includes(applicationId))
      .map(plugin => ({ ...plugin, canEnable: plugin.state !== "incompatible" })),
    setEnabled: async (id, enabled, applicationId) => ({ plugin: await manager.setEnabled(id, enabled, applicationId) }),
    remove: async (id, applicationId) => { await manager.remove(id, applicationId); return { removed: true, id, applicationId, profile: manager.profile }; }
  });
  const restoreFailures = await manager.restoreEnabledPlugins();
  for (const failure of restoreFailures) ctx.logger.warn(new Error(`Profile 插件 ${failure.id} 启动恢复失败：${failure.reason}`));
}
