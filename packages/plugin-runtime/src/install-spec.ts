/**
 * 文件：install-spec.ts
 * 作用：在包管理器写入前解析并限制插件安装来源。
 * 负责：registry / 绝对本地路径 / Git / tarball 四种 spec；拒绝空值、选项注入、相对路径和普通 HTTP 文件。
 * 不负责：联网、pnpm、读取 package.json、安装执行。
 */

export type ParsedPluginInstallSpec =
  | { readonly kind: "registry"; readonly spec: string; readonly name: string; readonly range?: string }
  | { readonly kind: "path"; readonly spec: string; readonly path: string }
  | { readonly kind: "git"; readonly spec: string }
  | { readonly kind: "tarball"; readonly spec: string; readonly path?: string };

const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;
const GIT_SHORTHAND = /^(?:github|gitlab|bitbucket|gist):/i;
const GIT_URL = /^git(?:\+[a-z]+)?:\/\/|^git@[^:]+:/i;
const HOSTED_GIT_URL = /^https?:\/\/[^/]+\/[^/]+\/[^/#]+(?:\.git)?(?:#.*)?$/i;
const TARBALL = /\.(?:tgz|tar\.gz)(?:[?#].*)?$/i;
const WINDOWS_ABSOLUTE = /^(?:[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)/;

function isAbsolutePath(value: string): boolean {
  return value.startsWith("/") || WINDOWS_ABSOLUTE.test(value);
}

export class InvalidPluginInstallSpecError extends Error {
  constructor(readonly spec: string, readonly reason: string) {
    super(reason);
    this.name = "InvalidPluginInstallSpecError";
  }
}

export function parsePluginInstallSpec(raw: string): ParsedPluginInstallSpec {
  const spec = raw.trim();
  if (!spec) throw new InvalidPluginInstallSpecError(spec, "插件来源不能为空。");
  if (spec.startsWith("-")) throw new InvalidPluginInstallSpecError(spec, "插件来源不能以命令行选项开头。");

  const pathValue = spec.replace(/^(?:file|link):/i, "");
  const hadPathProtocol = pathValue !== spec;
  if (hadPathProtocol || isAbsolutePath(pathValue)) {
    if (!isAbsolutePath(pathValue)) throw new InvalidPluginInstallSpecError(spec, "本地插件路径必须是绝对路径。");
    return TARBALL.test(pathValue)
      ? { kind: "tarball", spec, path: pathValue }
      : { kind: "path", spec, path: pathValue };
  }
  if (/^\.{1,2}(?:[\\/]|$)/.test(spec)) throw new InvalidPluginInstallSpecError(spec, "浏览器/Agent 安装不接受相对路径，请使用绝对路径。");

  // 安装来源会进入审计/诊断，禁止把 token/password 偷塞进 URL；认证必须走独立 Credential/registry 配置。
  if (/^https?:\/\//i.test(spec)) {
    try {
      const url = new URL(spec);
      if (url.username || url.password || url.search) throw new InvalidPluginInstallSpecError(spec, "插件 URL 不能携带用户名、密码或 query Secret；请使用 Credential/registry 配置。");
    } catch (error) {
      if (error instanceof InvalidPluginInstallSpecError) throw error;
      throw new InvalidPluginInstallSpecError(spec, "插件 URL 无效。");
    }
  }

  if ((GIT_SHORTHAND.test(spec) || GIT_URL.test(spec) || HOSTED_GIT_URL.test(spec)) && !TARBALL.test(spec)) {
    return { kind: "git", spec };
  }
  if (/^https?:\/\//i.test(spec)) {
    if (TARBALL.test(spec)) return { kind: "tarball", spec };
    throw new InvalidPluginInstallSpecError(spec, "HTTP URL 必须指向 Git 仓库或 .tgz/.tar.gz 包。");
  }

  const at = spec.indexOf("@", 1);
  const name = at === -1 ? spec : spec.slice(0, at);
  const range = at === -1 ? undefined : spec.slice(at + 1);
  if (name.length > 214 || !PACKAGE_NAME.test(name)) throw new InvalidPluginInstallSpecError(spec, "不是可接受的包名。");
  if (range === "") throw new InvalidPluginInstallSpecError(spec, "@ 后面的版本范围不能为空。");
  return range === undefined ? { kind: "registry", spec, name } : { kind: "registry", spec, name, range };
}
