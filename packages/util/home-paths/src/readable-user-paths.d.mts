export interface ReadableUserDataPaths {
  readonly root: string;
  readonly projects: string;
}

export function sanitizeReadableDirectoryName(value: unknown, fallback?: string): string;
export function ensureReadableUserDataPaths(dataDirectory: string, userId: string, username: string): ReadableUserDataPaths;
export function resolveExistingReadableUserDataPaths(dataDirectory: string, userId: string, username: string): ReadableUserDataPaths;
