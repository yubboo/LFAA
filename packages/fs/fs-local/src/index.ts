/**
 * 功能：本机文件系统后端插件入口。
 * 作用：把 read/write/list/replace 等本机能力以 Cordis 服务 lfaaLocalFs 暴露，供 tool-fs 族与 API 层复用。
 * 关联文件：src/local-fs.ts（读写实现）、src/paths.ts（路径边界）、packages/fs/tool-fs/src/index.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import * as fsCore from "./local-fs.js";
import { resolveLocalPath, displayPath, type ResolveOptions } from "./paths.js";

/** 本机文件系统服务形状：纯函数集合，路径边界由调用方传入的 root/cwd 决定。 */
export interface LocalFsService {
  readonly readText: typeof fsCore.readLocalText;
  readonly readByteRange: typeof fsCore.readLocalByteRange;
  readonly listDir: typeof fsCore.listLocalDir;
  readonly writeText: typeof fsCore.writeLocalText;
  readonly replaceInFile: typeof fsCore.replaceInLocalFile;
  readonly resolvePath: (inputPath: string, opts?: ResolveOptions) => string;
  readonly displayPath: (root: string | undefined, target: string) => string;
  readonly constants: {
    readonly DEFAULT_READ_BYTES: number;
    readonly HARD_READ_BYTES: number;
    readonly MAX_WRITE_BYTES: number;
  };
}

const service: LocalFsService = {
  readText: fsCore.readLocalText,
  readByteRange: fsCore.readLocalByteRange,
  listDir: fsCore.listLocalDir,
  writeText: fsCore.writeLocalText,
  replaceInFile: fsCore.replaceInLocalFile,
  resolvePath: resolveLocalPath,
  displayPath,
  constants: {
    DEFAULT_READ_BYTES: fsCore.LOCAL_FS_DEFAULT_READ_BYTES,
    HARD_READ_BYTES: fsCore.LOCAL_FS_HARD_READ_BYTES,
    MAX_WRITE_BYTES: fsCore.LOCAL_FS_MAX_WRITE_BYTES
  }
};

declare module "@deepseek-ai/cordis" {
  interface Context {
    lfaaLocalFs: LocalFsService;
  }
}

export const name = "lfaaLocalFs";
export const inject: readonly string[] = [];

/** 提供本机文件系统服务；无外部依赖，可独立加载。 */
export function apply(ctx: Context): void {
  ctx.provide(name, service);
}
