export function createDefaultWorkspaceDirectory(resolveDocuments?: () => string): Promise<string>;
export function resolveWindowsDocumentsDirectory(value: string, environment?: NodeJS.ProcessEnv): string;
export function executeProjectFile(input: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<Record<string, unknown>>;
export function inspectProjectArtifact(rootDirectory: string, relativePath: string, signal?: AbortSignal): Promise<{ relativePath: string; fileName: string; sizeBytes: number; sha256: string; modifiedAt: string }>;
export function openProjectArtifact(rootDirectory: string, relativePath: string): Promise<{ fileName: string; sizeBytes: number; modifiedAt: string; stream: import("node:stream").Readable }>;
export function createProjectPreviewServer(rootDirectory: string, entryPath: string): Promise<{ url: string; close: () => Promise<void> }>;
