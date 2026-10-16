/** 功能：保护已登记游戏实例文件。作用：复用受管执行器，限制实例根/元数据和未确认进程状态；关联文件：workspace-files、Daemon 的真实实例索引。 */
import { createManagedFileService } from './managed-files.mjs';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';

const ownerMarkers = new Set(['lfaa-instance.json', 'lfaa-provision.json', 'daemon-installing.json', 'daemon-process.json']);
export function assertGameMetadataMutable(path) {
  if (ownerMarkers.has(basename(path).toLowerCase())) throw new Error('游戏实例元数据和进程标记由领域 Owner 管理，普通文件操作不能创建或替换。');
}
const readOperations = new Set(['list', 'search', 'directory-size', 'preview', 'read', 'download', 'trash-list']);
function contains(parent, path) {
  const rel = relative(parent, path);
  return rel === '' || rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
export async function assertInstanceFileMutation(path, root, isStopped = true) {
  const directory = resolve(root), target = resolve(path);
  if (!contains(directory, target) && !contains(target, directory)) return;
  if (contains(target, directory)) throw new Error('游戏实例根目录由领域生命周期管理，不能直接重命名、移动或删除。');
  if (!isStopped) throw new Error('游戏实例正在运行或状态未确认，请先停止并核对状态。');
  assertGameMetadataMutable(target);
  const service = createManagedFileService({ root: directory });
  // 保留标记时不能认定停机；只有 Daemon 自己核对进程并清除标记后才能放行。
  for (const marker of ['daemon-process.json', 'daemon-installing.json']) {
    try {
      const info = await service.assertPath(resolve(directory, marker), true);
      if (info) throw new Error('游戏实例存在进程或安装标记，状态未确认，不能修改文件。');
    } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }
}
export function createInstanceFileService({ root, mutationRoot, isStopped, recycleNamespace = '', signal, assertCanRead, assertCanMutate = () => {} }) {
  const service = createManagedFileService({ root, mutationRoot, signal, recycleNamespace, assertCanRead,
    assertCanMutate: async path => { await assertInstanceFileMutation(path, root, isStopped()); await assertCanMutate(path); } });
  return { async operate(operation, input) {
    if (!readOperations.has(operation) && input.path === '' && !['upload', 'trash-restore', 'trash-purge'].includes(operation)) throw new Error('请选择实例内的具体文件或目录。');
    return service.operate(operation, input);
  } };
}
