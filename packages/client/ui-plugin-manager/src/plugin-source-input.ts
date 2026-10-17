/**
 * 功能：识别插件安装框中的来源字符串。
 * 作用：让 npm 包名、GitHub HTTPS 地址和 Host 绝对路径共用一个输入，不依赖手动选择来源。
 * 关联文件：PluginManagerPage.tsx、plugin-manager-ui.test.mjs。
 */
export type PluginSourceInputKind = "github" | "npm" | "local";

const npmSpecPattern = /^(?:npm:)?(?:@[a-z0-9][a-z0-9._-]{0,99}\/[a-z0-9][a-z0-9._-]{0,99}|[a-z0-9][a-z0-9._-]{0,99})(?:@[^\r\n\0]{1,200})?$/iu;

export function detectPluginSourceInput(value: string): PluginSourceInputKind | null {
  const source = value.trim();
  if (!source) return null;
  if (/^(?:local|file|link):/iu.test(source) || /^[a-z]:[\\/]/iu.test(source) || /^\\\\[^\\]/u.test(source) || source.startsWith("/")) return "local";
  if (/^https:\/\//iu.test(source)) {
    try { return new URL(source).hostname.toLocaleLowerCase("en-US") === "github.com" ? "github" : null; }
    catch { return null; }
  }
  if (/^https?:\/\//iu.test(source)) return null;
  return npmSpecPattern.test(source) ? "npm" : null;
}

export function pluginSourceInputHint(kind: PluginSourceInputKind | null): string {
  if (kind === "github") return "https://github.com/owner/repository";
  if (kind === "local") return "Host 本机绝对目录或 .tgz/.tar.gz 路径";
  return "输入 npm 包名（如 dsh-plugin-whale-pet）、GitHub HTTPS 地址或 Host 本机路径";
}
