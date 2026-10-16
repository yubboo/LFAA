/** 功能：声明实例文件保护合同。作用：Files 与节点共用实例根/元数据保护；关联文件：instance-files.mjs。 */
import type { ManagedFileService } from './managed-files.mjs';
export function assertInstanceFileMutation(path: string, root: string, isStopped?: boolean): Promise<void>;
export function assertGameMetadataMutable(path: string): void;
export function createInstanceFileService(options: { root: string; mutationRoot?: string; isStopped: () => boolean; recycleNamespace?: string; signal?: AbortSignal; assertCanRead?: (path: string) => void; assertCanMutate?: (path: string) => void | Promise<void> }): Pick<ManagedFileService, 'operate'>;
