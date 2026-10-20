export function createDefaultWorkspaceDirectory(resolveDocuments?: () => string): Promise<string>;
export function resolveWindowsDocumentsDirectory(value: string, environment?: NodeJS.ProcessEnv): string;
export function executeProjectFile(input: Record<string, unknown>): Promise<Record<string, unknown>>;
