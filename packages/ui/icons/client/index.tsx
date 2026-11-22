// 文件类型图标组件：按扩展名或目录职责取彩色字形，渲染为内联 SVG；文件树、标签栏、面包屑与变更列表共用。
import { DEFAULT_FILE_GLYPH, resolveFileGlyph, resolveFolderGlyph } from "../contract/index";
import styles from "./FileTypeIcon.module.css";
import { GLYPHS, type GlyphData } from "./glyphs";

const FALLBACK_GLYPH: GlyphData = GLYPHS[DEFAULT_FILE_GLYPH] ?? { w: 32, h: 32, body: "" };

export interface FileTypeIconProps {
  /** 文件名、目录名或完整路径；完整路径会先取最后一段。 */
  name: string;
  kind: "directory" | "file";
  /** 目录展开态，用于切换 `-opened` 文件夹图标。 */
  expanded?: boolean;
  /** 工作区根目录，使用专用根文件夹图标。 */
  root?: boolean;
  /** 图标边长（px），默认 16。 */
  size?: number;
  className?: string;
}

/** 彩色文件/文件夹类型图标；字形数据见 ./glyphs.ts（MIT，vscode-icons）。 */
export function FileTypeIcon({
  name,
  kind,
  expanded = false,
  root = false,
  size = 16,
  className,
}: FileTypeIconProps) {
  const key = kind === "directory" ? resolveFolderGlyph(name, { expanded, root }) : resolveFileGlyph(name);
  const glyph = GLYPHS[key] ?? FALLBACK_GLYPH;
  const mergedClass = className ? `${styles.fileTypeIcon} ${className}` : styles.fileTypeIcon;
  return (
    <svg
      className={mergedClass}
      data-glyph={key}
      width={size}
      height={size}
      viewBox={`0 0 ${glyph.w} ${glyph.h}`}
      style={{ flex: "0 0 auto" }}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: glyph.body }}
    />
  );
}

export { resolveFileGlyph, resolveFolderGlyph } from "../contract/index";