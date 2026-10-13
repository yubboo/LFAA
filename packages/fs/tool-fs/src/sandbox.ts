/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-tool-fs/src/sandbox.ts。
 * 功能：文件工具的路径沙箱策略——统一路径校验与越界拒绝映射。
 * 与 DSH 差异（重要）：DSH 用一整套 sandbox 升级审批机（sandbox_permissions/justification/approveEscalation），
 *   依赖 dsh-sandbox / dsh-sandbox-policy / ctx.approval；LFAA 无对应服务，故本模块收敛为
 *   “工作区根 containment”：所有路径经 lfaa-fs-local 的 resolveLocalPath 校验，越界即 FS_SANDBOX_DENIED。
 *   写/读权限分级仍由 LFAA 的 risk/approval 合同控制，不在此重复。
 * 关联文件：lfaa-fs-local/src/paths.ts、session-cwd.ts、write.ts。
 */
import { resolveLocalPath, FsLocalError, type ResolveOptions } from "lfaa-fs-local/src/paths.js";
import { FsToolError } from "./error.js";

/** 解析并校验一个用于写/编辑的路径；越界抛 FS_SANDBOX_DENIED。 */
export function resolveMutationPath(inputPath: string, opts: ResolveOptions): string {
  try {
    return resolveLocalPath(inputPath, opts);
  } catch (error) {
    if (error instanceof FsLocalError && error.code === "FS_SANDBOX_DENIED") {
      throw new FsToolError(error.message, "FS_SANDBOX_DENIED");
    }
    throw error;
  }
}

/** 把后端抛出的错误映射为模型可读的沙箱拒绝提示；非沙箱错误原样返回。 */
export function mapSandboxError(error: unknown): unknown {
  if (error instanceof FsToolError && error.code === "FS_SANDBOX_DENIED") return error;
  if (error instanceof FsLocalError && error.code === "FS_SANDBOX_DENIED") {
    return new FsToolError(`${error.message}（当前为工作区沙箱，未授权越出项目根）。`, "FS_SANDBOX_DENIED");
  }
  return error;
}
