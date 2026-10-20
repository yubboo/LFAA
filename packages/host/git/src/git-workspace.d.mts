export function resolveGitProjectDirectory(directory: string): Promise<string>;
export function resolveGitWorkspaceDirectory(directory: string): Promise<string>;
export function executeGitWorkspace(input: Record<string, unknown>): Promise<Record<string, unknown>>;
export function readGitRemoteUrl(projectDirectory: string, remote: string): Promise<string>;
