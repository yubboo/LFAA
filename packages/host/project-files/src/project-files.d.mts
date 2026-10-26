export function createDefaultWorkspaceDirectory(resolveDocuments?: () => string): Promise<string>;
export function resolveWindowsDocumentsDirectory(value: string, environment?: NodeJS.ProcessEnv): string;
export function executeProjectFile(input: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<Record<string, unknown>>;
export function createProjectPreviewServer(rootDirectory: string, entryPath: string): Promise<{ url: string; close: () => Promise<void> }>;
