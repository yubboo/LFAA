/**
 * 移植自 DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84），包名 dsh-tool-fs/src/read-target.ts。
 * 功能：读取目标解析——把模型传入路径解析为绝对路径并校验是普通文件。
 * 作用：read / read-image 共用，集中处理“找不到/不是文件/越界”三类拒绝。
 * 关联文件：session-cwd.ts、error.ts、read-render.ts。
 */
import { stat } from "node:fs/promises";
import { resolveLocalPath, displayPath } from "lfaa-fs-local/src/paths.js";
import { FsToolError } from "./error.js";
import type { ResolveBasis } from "./session-cwd.js";

/** 已解析并校验的读取目标。 */
export interface ReadTarget {
  readonly abs: string;
  readonly display: string;
  readonly size: number;
}

/** 解析路径并要求它是存在的普通文件；否则抛结构化错误。 */
export async function resolveReadTarget(inputPath: string, basis: ResolveBasis): Promise<ReadTarget> {
  const abs = resolveLocalPath(inputPath, { root: basis.root, cwd: basis.cwd });
  let info;
  try {
    info = await stat(abs);
  } catch {
    throw new FsToolError(`找不到文件：${inputPath}`, "FS_NOT_FOUND");
  }
  if (info.isDirectory()) throw new FsToolError(`这是目录而非文件：${inputPath}`, "FS_NOT_REGULAR_FILE");
  if (!info.isFile()) throw new FsToolError(`不是普通文件（设备/管道/符号链接目标）：${inputPath}`, "FS_NOT_REGULAR_FILE");
  return { abs, display: displayPath(basis.root, abs), size: info.size };
}
