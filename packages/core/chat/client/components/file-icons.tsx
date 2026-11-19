// 为工作区文件树、面包屑与标签栏提供统一的 VS Code 风格文件/目录类型角标与语义着色（适配深/浅双主题）。
import { IconBrandReact, IconFile, IconFolder, IconFolderOpen } from "@tabler/icons-react";
import styles from "./RightFileTreePane.module.css";

export function FileTypeIcon({
  name,
  kind,
  expanded = false,
}: {
  name: string;
  kind: "directory" | "file";
  expanded?: boolean;
}) {
  const lower = name.toLowerCase();

  if (kind === "directory") {
    let dirTone: "git" | "src" | "ui" | "pkg" | "docs" | "dim" | "default" = "default";
    if (lower === ".git" || lower === ".agent") dirTone = "git";
    else if (lower === "src") dirTone = "src";
    else if (lower === "components" || lower === "client" || lower === "ui") dirTone = "ui";
    else if (lower === "packages" || lower === "apps" || lower === "utils") dirTone = "pkg";
    else if (lower === "docs" || lower === "文档") dirTone = "docs";
    else if (lower === "node_modules") dirTone = "dim";
    const Icon = expanded ? IconFolderOpen : IconFolder;
    return <Icon size={14} className={styles.dirIcon} data-dir-tone={dirTone} aria-hidden="true" />;
  }

  if (lower.endsWith(".tsx") || lower.endsWith(".jsx")) {
    return <IconBrandReact size={14} className={styles.fileBadgeIcon} data-file-tone="react" aria-hidden="true" />;
  }
  if (lower.endsWith(".ts") || lower.endsWith(".mts")) {
    return <span className={styles.fileTypeText} data-file-tone="ts" aria-hidden="true">TS</span>;
  }
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) {
    return <span className={styles.fileTypeText} data-file-tone="js" aria-hidden="true">JS</span>;
  }
  if (lower.endsWith(".css") || lower.endsWith(".scss")) {
    return <span className={styles.fileTypeText} data-file-tone="css" aria-hidden="true">{"{}"}</span>;
  }
  if (lower.endsWith(".json") || lower.endsWith(".yaml") || lower.endsWith(".yml")) {
    return <span className={styles.fileTypeText} data-file-tone="json" aria-hidden="true">{"{}"}</span>;
  }
  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    return <span className={styles.fileTypeText} data-file-tone="html" aria-hidden="true">{"<>"}</span>;
  }
  if (lower.endsWith(".md")) {
    return <span className={styles.fileTypeText} data-file-tone="md" aria-hidden="true">M↓</span>;
  }
  if (lower.endsWith(".bat") || lower.endsWith(".sh") || lower.endsWith(".cmd")) {
    return <span className={styles.fileTypeText} data-file-tone="shell" aria-hidden="true">&gt;_</span>;
  }
  if (lower === ".gitignore") {
    return <span className={styles.fileTypeText} data-file-tone="git" aria-hidden="true">◆</span>;
  }
  return <IconFile size={13} className={styles.fileBadgeIcon} data-file-tone="plain" aria-hidden="true" />;
}
