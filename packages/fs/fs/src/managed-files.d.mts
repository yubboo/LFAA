/** 功能：声明共享受管文件执行器的类型。作用：让 Files API 与节点复用一致的调用合同。关联文件：managed-files.mjs。 */
import type { Stats, ReadStream } from "node:fs";
export function assertSafeTextPreview(path: string, content: string): void;
export interface ManagedFileService {
  operate(operation: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  openDownload(path: string): Promise<{ name: string; size: number; stream: ReadStream }>;
  resolvePath(path: unknown, allowRoot?: boolean): string;
  ensureDirectory(path: string): Promise<string>;
  assertPath(path: string, allowMissing?: boolean): Promise<Stats | null>;
}
export function createManagedFileService(options: { root: string; mutationRoot?: string; signal?: AbortSignal | undefined; protectedDirectories?: readonly string[]; assertCanRead?: (path: string) => void; assertCanMutate?: (path: string) => void | Promise<void>; recycleNamespace?: string }): ManagedFileService;
