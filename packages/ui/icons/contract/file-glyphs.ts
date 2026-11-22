// 文件 / 文件夹类型图标的纯映射：扩展名、特殊文件名与目录职责 → 图标 key。
// 不依赖 DOM 或 React，Host 与 Client 共用；具体彩色矢量字形在 client/glyphs.ts。

/** 未知文件的兜底图标 key。 */
export const DEFAULT_FILE_GLYPH = "default-file";

/** 未知目录的兜底图标 key。 */
export const DEFAULT_FOLDER_GLYPH = "default-folder";

/** 工作区根目录图标 key 前缀（展开态追加 `-opened`）。 */
export const ROOT_FOLDER_GLYPH = "default-root-folder";

/** 带展开态（`-opened`）变体的目录图标；其余目录复用闭合图标。 */
const FOLDER_OPENED_GLYPHS: ReadonlySet<string> = new Set([
  "default-folder",
  "default-root-folder",
  "folder-type-src",
  "folder-type-component",
  "folder-type-docs",
  "folder-type-test",
  "folder-type-config",
  "folder-type-package",
]);

/** 扩展名分组：同一图标支持的多个扩展名写在一起，便于整体维护。 */
const EXT_GROUPS: ReadonlyArray<{ glyph: string; exts: readonly string[] }> = [
  { glyph: "file-type-typescript", exts: ["ts", "mts", "cts"] },
  { glyph: "file-type-reactts", exts: ["tsx"] },
  { glyph: "file-type-js", exts: ["js", "mjs", "cjs"] },
  { glyph: "file-type-reactjs", exts: ["jsx"] },
  { glyph: "file-type-vue", exts: ["vue"] },
  { glyph: "file-type-svelte", exts: ["svelte"] },
  { glyph: "file-type-python", exts: ["py", "pyw", "pyi"] },
  { glyph: "file-type-go", exts: ["go"] },
  { glyph: "file-type-rust", exts: ["rs"] },
  { glyph: "file-type-java", exts: ["java"] },
  { glyph: "file-type-kotlin", exts: ["kt", "kts"] },
  { glyph: "file-type-php", exts: ["php"] },
  { glyph: "file-type-c", exts: ["c", "h"] },
  { glyph: "file-type-cpp", exts: ["cc", "cpp", "cxx", "hpp"] },
  { glyph: "file-type-csharp", exts: ["cs"] },
  { glyph: "file-type-swift", exts: ["swift", "m", "mm"] },
  { glyph: "file-type-html", exts: ["html", "htm"] },
  { glyph: "file-type-css", exts: ["css"] },
  { glyph: "file-type-scss", exts: ["scss", "sass", "less", "styl"] },
  { glyph: "file-type-json", exts: ["json", "jsonc", "json5"] },
  { glyph: "file-type-yaml", exts: ["yaml", "yml"] },
  { glyph: "file-type-toml", exts: ["toml"] },
  { glyph: "file-type-xml", exts: ["xml", "xsd", "plist", "svgz"] },
  { glyph: "file-type-markdown", exts: ["md", "mdx"] },
  { glyph: "file-type-text", exts: ["txt", "text"] },
  { glyph: "file-type-log", exts: ["log", "out", "err", "trace"] },
  { glyph: "file-type-pdf2", exts: ["pdf"] },
  { glyph: "file-type-word", exts: ["doc", "docx", "rtf", "odt"] },
  { glyph: "file-type-excel", exts: ["xls", "xlsx", "ods", "csv", "tsv"] },
  { glyph: "file-type-powerpoint", exts: ["ppt", "pptx", "key", "odp"] },
  {
    glyph: "file-type-image",
    exts: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "avif", "tiff", "psd"],
  },
  { glyph: "file-type-svg", exts: ["svg"] },
  { glyph: "file-type-audio", exts: ["mp3", "wav", "flac", "ogg", "m4a", "aac"] },
  { glyph: "file-type-video", exts: ["mp4", "mov", "webm", "mkv", "avi", "m4v"] },
  {
    glyph: "file-type-zip",
    exts: ["zip", "tar", "gz", "tgz", "7z", "rar", "bz2", "xz", "jar", "war", "ear"],
  },
  { glyph: "file-type-shell", exts: ["sh", "bash", "zsh", "fish", "bat", "cmd"] },
  { glyph: "file-type-powershell", exts: ["ps1", "psm1", "psd1"] },
  { glyph: "file-type-sql", exts: ["sql"] },
  { glyph: "file-type-sqlite", exts: ["db", "sqlite", "sqlite3", "mdb"] },
  { glyph: "file-type-binary", exts: ["lock", "lockb", "sum", "bin"] },
  { glyph: "file-type-config", exts: ["ini", "conf", "cfg", "properties", "editorconfig"] },
];

/** 特殊文件名：包管理、构建配置、版本库与许可证文件优先于扩展名规则。 */
const NAME_GLYPHS: Readonly<Record<string, string>> = {
  "package.json": "file-type-npm",
  "pnpm-workspace.yaml": "file-type-pnpm",
  "pnpm-lock.yaml": "file-type-pnpm",
  "tsconfig.json": "file-type-tsconfig",
  "pom.xml": "file-type-maven",
  "build.gradle": "file-type-gradle",
  "build.gradle.kts": "file-type-gradle",
  "settings.gradle": "file-type-gradle",
  "cargo.toml": "file-type-cargo",
  "cargo.lock": "file-type-cargo",
  "go.mod": "file-type-go",
  "go.sum": "file-type-binary",
  "makefile": "file-type-config",
  ".gitignore": "file-type-git",
  ".gitattributes": "file-type-git",
  ".gitmodules": "file-type-git",
  ".editorconfig": "file-type-editorconfig",
  "license": "file-type-license",
  "licence": "file-type-license",
  "copying": "file-type-license",
};

/** 目录职责分组：默认使用普通文件夹，命中名称后换成对应的彩色文件夹图标。 */
const FOLDER_GROUPS: ReadonlyArray<{ glyph: string; names: readonly string[] }> = [
  { glyph: "folder-type-git", names: [".git", ".github", ".gitlab", ".husky"] },
  { glyph: "folder-type-src", names: ["src", "source"] },
  {
    glyph: "folder-type-component",
    names: ["components", "client", "ui", "views", "pages", "hooks", "styles", "layouts", "widgets", "features"],
  },
  { glyph: "folder-type-docs", names: ["docs", "doc", "documentation", "guide", "guides"] },
  { glyph: "folder-type-test", names: ["test", "tests", "__tests__", "spec", "specs", "e2e", "fixtures", "mocks"] },
  { glyph: "folder-type-asset", names: ["assets", "static", "resources", "fonts", "icons", "media"] },
  { glyph: "folder-type-images", names: ["images", "img"] },
  { glyph: "folder-type-public", names: ["public"] },
  { glyph: "folder-type-script", names: ["scripts", "tasks"] },
  { glyph: "folder-type-tools", names: ["tools", "bin", "cli"] },
  {
    glyph: "folder-type-config",
    names: ["config", "configs", "conf", "settings", ".vscode", ".idea", ".agent", ".devcontainer"],
  },
  { glyph: "folder-type-package", names: ["packages", "apps"] },
  { glyph: "folder-type-library", names: ["lib", "libs", "modules", "vendor"] },
  { glyph: "folder-type-services", names: ["services", "server"] },
  { glyph: "folder-type-api", names: ["api"] },
  { glyph: "folder-type-dist", names: ["dist", "build", "out", "target", "coverage"] },
  { glyph: "folder-type-node", names: ["node_modules"] },
];

const EXT_MAP = new Map<string, string>();
for (const group of EXT_GROUPS) {
  for (const ext of group.exts) EXT_MAP.set(ext, group.glyph);
}

const FOLDER_MAP = new Map<string, string>();
for (const group of FOLDER_GROUPS) {
  for (const name of group.names) FOLDER_MAP.set(name, group.glyph);
}

/** 解析文件图标 key：特殊文件名 → `.env`/Dockerfile 前缀 → 扩展名 → 兜底。入参可为完整路径。 */
export function resolveFileGlyph(name: string): string {
  const base = name.replace(/^.*[\\/]/u, "");
  const lower = base.toLowerCase();
  const byName = NAME_GLYPHS[lower];
  if (byName) return byName;
  if (lower.startsWith(".env")) return "file-type-dotenv";
  if (lower.startsWith("dockerfile") || lower.startsWith("compose.")) return "file-type-docker";
  const dot = lower.lastIndexOf(".");
  const ext = dot > 0 ? lower.slice(dot + 1) : "";
  return (ext ? EXT_MAP.get(ext) : undefined) ?? DEFAULT_FILE_GLYPH;
}

/** 解析目录图标 key：根目录专用图标 → 精确名 → 去点前缀 → 末段词 → 兜底。 */
export function resolveFolderGlyph(name: string, options: { expanded?: boolean; root?: boolean } = {}): string {
  const expanded = options.expanded === true;
  if (options.root === true) return expanded ? `${ROOT_FOLDER_GLYPH}-opened` : ROOT_FOLDER_GLYPH;
  const lower = name.toLowerCase();
  let key = FOLDER_MAP.get(lower);
  if (!key) {
    const undotted = lower.replace(/^\.+/u, "");
    key = FOLDER_MAP.get(undotted);
    if (!key) {
      const lastToken = undotted.split(/[-_.]/u).pop() ?? "";
      key = lastToken ? FOLDER_MAP.get(lastToken) : undefined;
    }
  }
  const base = key ?? DEFAULT_FOLDER_GLYPH;
  return expanded && FOLDER_OPENED_GLYPHS.has(base) ? `${base}-opened` : base;
}