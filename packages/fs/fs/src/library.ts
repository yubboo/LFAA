/** 功能：提供页面与 AI 共用的文件服务。作用：实时核验权限，管理 data、业务 Owner 和本机磁盘来源。关联文件：managed-files、workspace-files API、Settings/Identity Owner。 */
import { randomUUID, createHash } from "node:crypto";
import { appendFile, lstat, readFile, readdir, rename } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { config } from "lfaa-launch-environment/src/config.js";
import { protectedDataDirectories } from "lfaa-home-paths/src/reserved-data-paths.mjs";
import { resolveUserDataPaths } from "lfaa-home-paths/src/data-layout.mjs";
import { getUserSettings } from "lfaa-settings/src/service.js";
import { resolveUserRole } from "lfaa-identity-auth/src/service.js";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import type { FileManagerOperation, ManagedFileEntry } from "lfaa-util-values/src/file-manager-contract.js";
import { createManagedFileService } from "./managed-files.mjs";
export interface FileActor { userId: string; role: string; signal?: AbortSignal }
export interface FileMount { id: string; name: string; operate(actor: FileActor, operation: FileManagerOperation, input: Record<string, unknown>): Promise<Record<string, unknown>> }
const libraryDirectory = ".lfaa-library";
const localDriveShortcut = "local-drives";
const protectedWindowsRootDirectories = new Set(["$recycle.bin", "system volume information", "windows", "windows.old", "recovery", "program files", "program files (x86)", "programdata"]);
let localVolumeCache: { expiresAt: number; volumes: Array<{ id: string; name: string; root: string }> } | null = null;
let localVolumePending: Promise<Array<{ id: string; name: string; root: string }>> | null = null;

async function listLocalVolumes(): Promise<Array<{ id: string; name: string; root: string }>> {
  if (localVolumeCache && localVolumeCache.expiresAt > Date.now()) return localVolumeCache.volumes;
  if (localVolumePending) return localVolumePending;
  const pending = scanLocalVolumes();
  localVolumePending = pending;
  try {
    const volumes = await pending;
    localVolumeCache = { expiresAt: Date.now() + 20_000, volumes };
    return volumes;
  } finally { if (localVolumePending === pending) localVolumePending = null; }
}
async function scanLocalVolumes(): Promise<Array<{ id: string; name: string; root: string }>> {
  const volumes: Array<{ id: string; name: string; root: string }> = [];
  if (process.platform === "win32") {
    const candidates = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index));
    const results = await Promise.all(candidates.map(async letter => {
      const root = `${letter}:\\`;
      try { const info = await lstat(root); return info.isDirectory() && !info.isSymbolicLink() ? { id: letter, name: `本机磁盘 (${letter}:)`, root } : null; }
      catch { return null; }
    }));
    volumes.push(...results.filter((volume): volume is { id: string; name: string; root: string } => volume !== null));
  } else if (process.platform === "darwin") {
    volumes.push({ id: "root", name: "系统磁盘 (/)" , root: "/" });
    const entries = await readdir("/Volumes", { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const id = `volume-${Buffer.from(entry.name).toString("base64url")}`;
      volumes.push({ id, name: entry.name, root: resolve("/Volumes", entry.name) });
    }
  } else {
    volumes.push({ id: "root", name: "本机文件系统 (/)" , root: "/" });
  }
  return volumes;
}

function containsPath(parent: string, target: string): boolean {
  const path = relative(resolve(parent), resolve(target));
  return path === "" || path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

export function assertSystemFileAccess(userId: string): void {
  if (resolveUserRole(userId) !== "super_admin") throw new ApiError(403, "file_super_admin_required", "文件管理仅允许超级管理员使用。");
  if (getUserSettings(userId).permissions.mode !== "full_access") throw new ApiError(403, "file_full_access_required", "文件管理需要在设置中心启用完全访问权限。");
}
function prefixResult(result: Record<string, unknown>, prefix: string): Record<string, unknown> {
  const prefixPath = (path: string) => [prefix, path].filter(Boolean).join("/");
  return { ...result, ...(typeof result.path === "string" ? { path: prefixPath(result.path) } : {}), ...(Array.isArray(result.entries) ? { entries: result.entries.map((entry: ManagedFileEntry) => ({ ...entry, path: prefixPath(entry.path), ...(entry.trashId ? { trashId: prefixPath(entry.trashId) } : {}) })) } : {}) };
}
export class SystemFileLibrary {
  private mounts = new Map<string, FileMount>();
  private mutationGuards = new Set<(path: string) => void>();
  private auditTails = new Map<string, Promise<void>>();
  private auditDirectories: ReturnType<typeof createManagedFileService>;
  constructor(private dataRoot: string) { this.dataRoot = resolve(dataRoot); this.auditDirectories = createManagedFileService({ root: this.dataRoot }); }
  register(mount: FileMount): () => void {
    if (!/^[a-z][a-z0-9-]{0,63}$/u.test(mount.id) || this.mounts.has(mount.id)) throw new Error("文件 Owner 标识无效或重复。");
    this.mounts.set(mount.id, mount); return () => { if (this.mounts.get(mount.id) === mount) this.mounts.delete(mount.id); };
  }
  registerMutationGuard(guard: (path: string) => void): () => void { this.mutationGuards.add(guard); return () => { this.mutationGuards.delete(guard); }; }
  private checkActor(actor: FileActor) {
    assertSystemFileAccess(actor.userId); actor.signal?.throwIfAborted();
    const repositoryFromData = relative(this.dataRoot, config.repositoryRoot);
    const dataFromRepository = relative(config.repositoryRoot, this.dataRoot);
    const containsRepository = !repositoryFromData || repositoryFromData !== ".." && !repositoryFromData.startsWith(`..${sep}`) && !isAbsolute(repositoryFromData);
    const insideRepository = dataFromRepository && dataFromRepository !== ".." && !dataFromRepository.startsWith(`..${sep}`) && !isAbsolute(dataFromRepository);
    if (containsRepository || insideRepository && dataFromRepository.split(sep)[0].toLocaleLowerCase() !== "data") throw new ApiError(403, "file_data_root_unsafe", "当前数据根覆盖了项目源码，请先在存储设置中改为独立 data 目录。");
  }
  private split(path: unknown): string[] {
    if (typeof path !== "string" || path.length > 1024 || path.includes("\\") || path.startsWith("/") || path.includes("\0") || /^[a-z]:/iu.test(path)) throw new ApiError(400, "invalid_file_path", "文件路径必须使用文件服务登记的目录来源。");
    const parts = path ? path.split("/") : [];
    if (parts.some(p => !p || p === "." || p === "..")) throw new ApiError(400, "invalid_file_path", "文件路径不能包含空段或父目录跳转。");
    return parts;
  }
  private local(actor: FileActor) {
    return createManagedFileService({ root: this.dataRoot, protectedDirectories: [...protectedDataDirectories, libraryDirectory], recycleNamespace: createHash("sha256").update(actor.userId).digest("hex"), assertCanMutate: path => {
      const rel = relative(this.dataRoot, path);
      if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new ApiError(403, "file_outside_data", "不能操作 data 之外的文件。");
      if ([...protectedDataDirectories, libraryDirectory].includes(rel.split(sep)[0].toLocaleLowerCase())) throw new ApiError(403, "file_private_path", "不能写入系统或账户私有目录。");
      if (rel.split(sep)[0] === "games" && !this.mutationGuards.size) throw new ApiError(409, "game_file_owner_unavailable", "游戏文件保护服务尚未就绪，请稍后重试。");
      for (const guard of this.mutationGuards) guard(path);
    } });
  }
  async operate(actor: FileActor, operation: FileManagerOperation, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.checkActor(actor); const parts = this.split(input.path);
    try {
      const result = await this.execute(actor, operation, input, parts);
      if (!["list", "search", "directory-size", "trash-list"].includes(operation)) await this.audit(actor, operation, input, true);
      return result;
    } catch (error) { if (!["list", "search", "directory-size", "trash-list"].includes(operation)) await this.audit(actor, operation, input, false); throw error; }
  }
  private async execute(actor: FileActor, operation: FileManagerOperation, input: Record<string, unknown>, parts: string[]): Promise<Record<string, unknown>> {
    if (parts[0] === localDriveShortcut) return await this.operateLocalDrives(actor, operation, input, parts);
    if (parts[0] === libraryDirectory) {
      if (parts.length === 1 && operation === "list") return { path: libraryDirectory, operations: ["list"], entries: [...this.mounts.values()].map(m => ({ name: m.name, path: `${libraryDirectory}/${m.id}`, kind: "directory", size: 0, fileType: "folder", modifiedAt: "", operations: ["list"] })), truncated: false };
      const mount = this.mounts.get(parts[1]);
      if (!mount) throw new ApiError(404, "file_owner_missing", "文件 Owner 未登记。");
      const payload: Record<string, unknown> = { ...input, path: parts.slice(2).join("/") };
      if (operation === "move") {
        const target = this.split(input.destinationPath);
        if (target[0] !== libraryDirectory || target[1] !== mount.id) throw new ApiError(400, "cross_owner_move", "不同文件 Owner 之间请使用导出和导入。");
        payload.destinationPath = target.slice(2).join("/");
      }
      return prefixResult(await mount.operate(actor, operation, payload), `${libraryDirectory}/${mount.id}`);
    }
    if (!parts.length && ["trash-restore", "trash-purge"].includes(operation) && String(input.name).startsWith(libraryDirectory + "/")) {
      const trash = this.split(input.name); const mount = this.mounts.get(trash[1]);
      if (!mount || trash.length < 4) throw new ApiError(400, "invalid_trash_id", "回收站来源无效。");
      return prefixResult(await mount.operate(actor, operation, { path: trash[2], name: trash.slice(3).join("/") }), `${libraryDirectory}/${mount.id}`);
    }
    if (!parts.length && ["trash-restore", "trash-purge"].includes(operation) && String(input.name).startsWith(localDriveShortcut + "/")) {
      const trash = this.split(input.name);
      if (trash.length < 4) throw new ApiError(400, "invalid_trash_id", "回收站来源无效。");
      return await this.operateLocalDrives(actor, operation, { ...input, path: trash.slice(0, 2).join("/"), name: trash.slice(2).join("/") }, trash.slice(0, 2));
    }
    if (operation === "move") { const target = this.split(input.destinationPath); if (target[0] === libraryDirectory) throw new ApiError(400, "cross_owner_move", "不能直接移入业务 Owner 目录。"); }
    const result = await this.local(actor).operate(operation, input);
    if (!parts.length && operation === "list") {
      const volumes = await listLocalVolumes();
      return { ...result, rootDirectory: this.dataRoot, entries: [...result.entries as ManagedFileEntry[], { name: "本机磁盘", path: localDriveShortcut, kind: "directory", size: 0, fileType: "folder", modifiedAt: "", operations: ["list"] }, ...volumes.map(volume => ({ name: volume.name, path: `${localDriveShortcut}/${volume.id}`, kind: "directory", size: 0, fileType: "folder", modifiedAt: "", operations: ["list"] })), ...(this.mounts.size ? [{ name: "应用资源", path: libraryDirectory, kind: "directory", size: 0, fileType: "folder", modifiedAt: "", operations: ["list"] }] : [])] };
    }
    return result;
  }
  private async operateLocalDrives(actor: FileActor, operation: FileManagerOperation, input: Record<string, unknown>, parts: string[]): Promise<Record<string, unknown>> {
    if (parts.length === 1 && operation === "list") {
      const volumes = await listLocalVolumes();
      return { path: localDriveShortcut, entries: volumes.map(volume => ({ name: volume.name, path: `${localDriveShortcut}/${volume.id}`, kind: "directory", size: 0, fileType: "folder", modifiedAt: "", operations: ["list"] })), truncated: false };
    }
    const volumeId = parts[1];
    const volume = (await listLocalVolumes()).find(item => item.id === volumeId);
    if (!volume) throw new ApiError(404, "local_volume_missing", "本机磁盘不存在或当前不可用；刷新后重试。");
    if (parts.length < 2) throw new ApiError(400, "invalid_local_volume_path", "请先选择一个本机磁盘。");
    const servicePath = parts.slice(2).join("/");
    const payload: Record<string, unknown> = { ...input, path: servicePath };
    if (operation === "move") {
      const target = this.split(input.destinationPath);
      if (target[0] !== localDriveShortcut || target[1] !== volumeId) throw new ApiError(400, "cross_volume_move", "不同磁盘之间不能直接移动；请下载后上传到目标磁盘。");
      payload.destinationPath = target.slice(2).join("/");
    }
    const service = this.localVolumeService(actor, volume);
    const result = await service.operate(operation, payload);
    return prefixResult(result, `${localDriveShortcut}/${volumeId}`);
  }
  private localVolumeService(actor: FileActor, volume: { id: string; name: string; root: string }) {
    return createManagedFileService({
      root: volume.root,
      protectedDirectories: ["$recycle.bin", "system volume information"],
      recycleNamespace: createHash("sha256").update(actor.userId).digest("hex"),
      assertCanRead: path => {
        const dataRelative = relative(this.dataRoot, path);
        const insideData = dataRelative === "" || dataRelative !== ".." && !dataRelative.startsWith(`..${sep}`) && !isAbsolute(dataRelative);
        if (!insideData) return;
        const segments = dataRelative.split(sep).filter(Boolean).map(segment => segment.toLocaleLowerCase());
        if (protectedDataDirectories.includes(segments[0] ?? "") || segments[0] === "users" && segments[2] === "settings") throw new ApiError(403, "file_private_path", "该账户配置和会话文件不开放给通用文件操作。");
      },
      assertCanMutate: path => {
        const insideData = containsPath(config.dataDirectory, path);
        const intersectsRepository = containsPath(config.repositoryRoot, path) && !insideData || containsPath(path, config.repositoryRoot);
        if (intersectsRepository) throw new ApiError(403, "file_source_protected", "LFAA 项目源码和安装目录受保护，不能通过文件管理器改动。");
        const rootRelative = relative(volume.root, path);
        const topLevel = rootRelative.split(sep)[0]?.toLocaleLowerCase() ?? "";
        if (protectedWindowsRootDirectories.has(topLevel)) throw new ApiError(403, "file_system_path_protected", "Windows 系统目录和程序安装目录受保护。");
        for (const guard of this.mutationGuards) guard(path);
      }
    });
  }
  async openDownload(actor: FileActor, path: string) {
    this.checkActor(actor);
    const parts = this.split(path);
    if (parts[0] === localDriveShortcut) {
      const volume = (await listLocalVolumes()).find(item => item.id === parts[1]);
      if (!volume || parts.length < 3) throw new ApiError(404, "local_file_missing", "本机磁盘文件不存在或当前不可用。");
      return this.localVolumeService(actor, volume).openDownload(parts.slice(2).join("/"));
    }
    return this.local(actor).openDownload(path);
  }
  async recordDownload(actor: FileActor, path: string, succeeded: boolean) { this.checkActor(actor); await this.audit(actor, "download", { path }, succeeded); }
  private audit(actor: FileActor, operation: string, input: Record<string, unknown>, succeeded: boolean): Promise<void> {
    const directory = resolveUserDataPaths(this.dataRoot, actor.userId).root;
    const previous = this.auditTails.get(directory) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(async () => {
      // dataRoot 的私有 ACL 由启动 Owner 建立；账户子目录继承，不执行同步 ACL 子进程。
      await this.auditDirectories.ensureDirectory(directory);
      const info = await lstat(directory);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("文件审计目录状态无效。");
      const path = resolve(directory, "file-audit.jsonl");
      const auditInfo = await lstat(path).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; return null; });
      if (auditInfo?.isSymbolicLink() || auditInfo && (!auditInfo.isFile() || auditInfo.nlink > 1)) throw new Error("文件审计索引状态无效。");
      if (auditInfo && auditInfo.size >= 2 * 1024 * 1024) await rename(path, resolve(directory, "file-audit.previous.jsonl"));
      await appendFile(path, JSON.stringify({ id: randomUUID(), userId: actor.userId, operation, path: input.path, targetPath: input.destinationPath ?? "", fileName: input.name ?? "", succeeded, finishedAt: new Date().toISOString() }) + "\n", { mode: 0o600 });
    });
    this.auditTails.set(directory, next);
    void next.finally(() => { if (this.auditTails.get(directory) === next) this.auditTails.delete(directory); }).catch(() => undefined);
    return next;
  }
  async listAudit(actor: FileActor, query: string) {
    this.checkActor(actor);
    const directory = resolveUserDataPaths(this.dataRoot, actor.userId).root;
    await this.auditTails.get(directory);
    const path = resolve(directory, "file-audit.jsonl");
    const text = await (async () => { try { const info = await this.auditDirectories.assertPath(path); if (!info?.isFile() || info.size > 3 * 1024 * 1024) throw new Error("审计文件超出安全容量。"); return await readFile(path, "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return ""; throw error; } })();
    return text.trim().split("\n").filter(Boolean).map(line => JSON.parse(line)).filter(row => !query || `${row.path} ${row.operation} ${row.fileName}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(-200).reverse();
  }
}
export const systemFiles = new SystemFileLibrary(config.dataDirectory);
