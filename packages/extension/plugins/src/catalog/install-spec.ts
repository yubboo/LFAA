// 插件安装来源解析：把用户输入的包名 / GitHub 地址 / 本地路径 / tarball 归类，供 profile 安装使用。
import { isAbsolute, resolve } from "node:path";
import { findUnsafeSpecCharacter } from "../manager/pnpm-spawn";

/** 安装来源形态。 */
export type InstallSpecKind = "registry" | "git" | "path" | "tarball";

/** 解析结果：保留原始输入与归类所需的字段。 */
export interface ParsedInstallSpec {
  kind: InstallSpecKind;
  /** 原始输入（已 trim）。 */
  spec: string;
  /** registry：包名；其余为空。 */
  name?: string;
  /** registry：版本范围；path：绝对路径；tarball：绝对路径或 URL；git：仓库地址。 */
  target?: string;
  /** git / tarball：来源主机，便于提示。 */
  host?: string;
}

/** 输入无法被 pnpm 接受时抛出；`reason` 直接展示给用户。 */
export class InvalidInstallSpecError extends Error {
  constructor(
    readonly spec: string,
    readonly reason: string,
  ) {
    super(`无法识别的插件来源：${reason}（输入：${spec}）`);
    this.name = "InvalidInstallSpecError";
  }
}

const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/u;
const GIT_SHORTHAND = /^(?:github|gitlab|bitbucket|gist):/iu;
const GIT_URL = /^git(?:\+[a-z]+)?:\/\//iu;
const GIT_SCP = /^git@[^:]+:/iu;
const HOSTED_REPO = /^https?:\/\/[^/]+\/[^/]+\/[^/#]+(?:\.git)?(?:#.*)?$/iu;
const TARBALL = /\.(?:tgz|tar\.gz)(?:#.*)?$/iu;

/**
 * 解析安装来源：
 * - `npm 包名[@版本]` → registry；
 * - `github:owner/repo`、`git+https://…`、`git@host:…`、`https://host/owner/repo` → git；
 * - 绝对路径或 `file:` / `link:` 前缀 → path；
 * - `.tgz` / `.tar.gz` 的绝对路径或 URL → tarball。
 * 相对路径一律拒绝：浏览器里输入的相对路径没有可信基准。
 */
export function parseInstallSpec(raw: string): ParsedInstallSpec {
  const spec = raw.trim();
  if (spec.length === 0) throw new InvalidInstallSpecError(spec, "输入为空");

  // 来源最终会作为 pnpm 参数交给子进程；含 shell 元字符的输入一律拒绝，不做转义猜测。
  const unsafe = findUnsafeSpecCharacter(spec);
  if (unsafe) throw new InvalidInstallSpecError(spec, `包含不允许的字符「${unsafe}」`);

  const withoutProtocol = spec.replace(/^(?:file|link):/u, "");
  const looksPath = withoutProtocol !== spec || isAbsolute(withoutProtocol) || /^[A-Za-z]:[\\/]/u.test(withoutProtocol);
  if (looksPath) {
    const target = isAbsolute(withoutProtocol) ? withoutProtocol : resolve(withoutProtocol);
    if (!isAbsolute(target)) throw new InvalidInstallSpecError(spec, "本地路径必须是绝对路径");
    return TARBALL.test(target)
      ? { kind: "tarball", spec, target }
      : { kind: "path", spec, target };
  }
  if (/^\.{1,2}(?:[\\/]|$)/u.test(spec)) {
    throw new InvalidInstallSpecError(spec, "本地路径必须是绝对路径");
  }

  if (GIT_SHORTHAND.test(spec) || GIT_URL.test(spec) || GIT_SCP.test(spec) || HOSTED_REPO.test(spec)) {
    return { kind: "git", spec, target: spec, host: gitHost(spec) };
  }
  if (/^https?:\/\//iu.test(spec)) {
    if (TARBALL.test(spec)) return { kind: "tarball", spec, target: spec, host: new URL(spec).host };
    throw new InvalidInstallSpecError(spec, "URL 必须指向 git 仓库或 tarball");
  }

  const at = spec.indexOf("@", 1);
  const name = at === -1 ? spec : spec.slice(0, at);
  const range = at === -1 ? undefined : spec.slice(at + 1);
  if (!PACKAGE_NAME.test(name)) throw new InvalidInstallSpecError(spec, "不是合法的 npm 包名");
  if (range === "") throw new InvalidInstallSpecError(spec, "@ 之后不能为空");
  return { kind: "registry", spec, name, ...(range === undefined ? {} : { target: range }) };
}

/** 取 git 来源的主机名，仅用于提示与日志。 */
function gitHost(spec: string): string {
  if (GIT_SHORTHAND.test(spec)) return spec.slice(0, spec.indexOf(":")).toLowerCase() + ".com";
  const scp = /^git@([^:]+):/u.exec(spec);
  if (scp?.[1]) return scp[1].toLowerCase();
  try {
    return new URL(spec.replace(/^git\+/iu, "")).host;
  } catch {
    return "unknown";
  }
}

/** 三种入口的中文标签，供界面提示与日志复用。 */
export const INSTALL_SOURCE_LABELS: Record<InstallSpecKind, string> = {
  registry: "npm 包名",
  git: "GitHub / Git 仓库",
  path: "本地目录",
  tarball: "压缩包",
};
