/**
 * 项目内容/数据目录设置的 Connection DTO 与认证迁移端点。
 */
import { request, requestBinary } from "./http-client.js";



export interface DataDirectorySettings {
  defaultDirectory: string;
  recommendedDirectory: string;
  selection: "default" | "recommended" | "custom";
  configured: boolean;
  currentDirectory: string;
  pendingDirectory: string | null;
  pendingMode: "copy" | "adopt" | "archive" | null;
  pendingArchivePath: string | null;
  pendingError: string | null;
  editable: boolean;
  unavailableReason: string | null;
}


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


export interface ProjectContentComparison {
  sourceDirectory: string;
  targetDirectory: string;
  sourceEntryCount: number;
  targetEntryCount: number;
  sourceFileCount: number;
  targetFileCount: number;
  sourceBytes: number;
  targetBytes: number;
  matching: boolean;
  differenceCount: number;
  differences: Array<{ path: string; kind: "missing" | "extra" | "type" | "size" | "hash" }>;
}


export interface ProjectContentMigrationResult {
  sourceDirectory: string;
  targetDirectory: string;
  copiedFiles: number;
  copiedBytes: number;
  backupDirectory: string | null;
  comparison: ProjectContentComparison;
  settings: { settings: ProjectStorageLocations; configured: boolean };
}


export function loadDataDirectorySettings(): Promise<{ settings: DataDirectorySettings }> {
  return request("/data-directory");
}

export function confirmDataDirectoryLocation(): Promise<{ settings: DataDirectorySettings }> {
  return request("/data-directory/confirm", { method: "POST" });
}

export function recommendDataDirectoryLocation(): Promise<{ settings: DataDirectorySettings }> {
  return request("/data-directory/recommended", { method: "POST" });
}


export function saveDataDirectorySettings(directory: string, mode: "copy" | "adopt" | "archive" = "copy", archivePath = ""): Promise<{ settings: DataDirectorySettings }> {
  return request("/data-directory", { method: "PUT", body: JSON.stringify({ directory, mode, archivePath }) });
}


export function cancelDataDirectorySettingsChange(): Promise<{ settings: DataDirectorySettings }> {
  return request("/data-directory", { method: "DELETE" });
}


export function loadProjectStorageLocations(): Promise<{ settings: ProjectStorageLocations; configured: boolean }> {
  return request("/project-storage-locations");
}


export function saveProjectContentDirectory(contentDirectory: string): Promise<{ settings: ProjectStorageLocations; configured: boolean }> {
  return request("/project-storage-locations", { method: "PUT", body: JSON.stringify({ contentDirectory }) });
}


export function compareProjectContentDirectories(targetDirectory: string): Promise<ProjectContentComparison> {
  return request("/project-storage-locations/compare", { method: "POST", body: JSON.stringify({ targetDirectory }) });
}


export function copyProjectContentToDirectory(targetDirectory: string): Promise<ProjectContentMigrationResult> {
  return request("/project-storage-locations/copy", { method: "POST", body: JSON.stringify({ targetDirectory }) });
}


export function adoptProjectContentDirectory(targetDirectory: string): Promise<ProjectContentMigrationResult> {
  return request("/project-storage-locations/adopt", { method: "POST", body: JSON.stringify({ targetDirectory }) });
}


export function importProjectContentArchive(archivePath: string, targetDirectory: string): Promise<ProjectContentMigrationResult> {
  return request("/project-storage-locations/archive/import", { method: "POST", body: JSON.stringify({ archivePath, targetDirectory }) });
}


export function downloadProjectContentArchive(): Promise<Blob> {
  return requestBinary("/project-storage-locations/archive/export", { method: "POST" });
}


export function confirmProjectContentDirectory(): Promise<{ settings: ProjectStorageLocations; configured: boolean }> {
  return request("/project-storage-locations/confirm", { method: "POST" });
}