/**
 * 功能：把模型/插件传入的路径解析为本机绝对路径，并在给定根目录时强制边界。
 * 作用：所有文件工具先经过这里归一化路径，阻止 `../` 路径穿越越出允许的工作区根。
 * 安全边界：当调用方提供 root（工作区项目目录）时，解析结果必须落在 root 内或就是 root；
 *           越界请求直接抛错，绝不读取或改写 root 之外的文件。root 缺省时退化为以 cwd 为基准。
 * 关联文件：packages/fs/tool-fs/src/index.ts、packages/fs/tool-fs-search/src/index.ts。
 */
import { isAbsolute, relative, resolve, sep } from "node:path";

/** 路径越界错误：调用方据此区分“找不到文件”与“被沙箱拒绝”。 */
export class FsLocalError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "FsLocalError";
    this.code = code;
  }
}

export interface ResolveOptions {
  /** 相对路径的基准目录；缺省取 process.cwd()。 */
  readonly cwd?: string | undefined;
  /** 允许的根目录；提供后解析结果必须落在其内。 */
  readonly root?: string | undefined;
}

/** Windows 路径大小写不敏感，比较前归一化；其他平台保持原样。 */
function normalizeForCompare(p: string): string {
  return process.platform === "win32" ? p.toLowerCase() : p;
}

/** 判断 target 是否位于 root 之内或就是 root 本身（canonical 边界判定，不做字符串前缀猜测）。 */
export function isWithinRoot(root: string, target: string): boolean {
  const rootNorm = normalizeForCompare(resolve(root));
  const targetNorm = normalizeForCompare(resolve(target));
  const rel = relative(rootNorm, targetNorm);
  // rel 为空串表示同一目录；不以 .. 开头且非绝对路径即位于 root 内。
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/**
 * 解析模型传入路径为绝对路径并执行边界检查。
 * 绝对路径直接采用（仍受 root 约束）；相对路径拼到 cwd 后解析。
 */
export function resolveLocalPath(inputPath: string, opts: ResolveOptions = {}): string {
  if (typeof inputPath !== "string" || inputPath.length === 0 || inputPath.length > 4096) {
    throw new FsLocalError("文件路径必须是 1–4096 字符的非空字符串。", "FS_INVALID_PATH");
  }
  if (inputPath.includes("\0")) {
    throw new FsLocalError("文件路径不能包含空字符。", "FS_INVALID_PATH");
  }
  const base = opts.cwd ? resolve(opts.cwd) : process.cwd();
  const resolved = isAbsolute(inputPath) ? resolve(inputPath) : resolve(base, inputPath);

  if (opts.root) {
    if (!isWithinRoot(opts.root, resolved)) {
      // 安全边界：拒绝读写工作区根之外的任何路径，避免模型误操作或提示注入诱导越权。
      throw new FsLocalError(
        `路径越界：${inputPath} 不在允许的根目录 ${opts.root} 内。为避免越权读写，已拒绝该操作。`,
        "FS_SANDBOX_DENIED"
      );
    }
  }
  return resolved;
}

/** 计算 target 相对 root 的展示路径；越界时回退为绝对路径，便于向模型说明。 */
export function displayPath(root: string | undefined, target: string): string {
  if (!root) return target;
  const rel = relative(resolve(root), target);
  if (rel.startsWith("..") || isAbsolute(rel)) return target;
  return rel === "" ? "." : rel.split(sep).join("/");
}
