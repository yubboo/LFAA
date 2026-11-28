// 输入栏左下角「+」按钮与隐藏文件/文件夹选择器：点击直接展开输入框一体化上下文面板，避免悬浮卡片遮挡正文。
// 关联：packages/client/ui-chat/client/composer/ChatComposer.tsx；运行环境：浏览器。
import type { ChangeEvent, RefObject } from "react";
import { IconPlus } from "@tabler/icons-react";
import { HoverTip } from "@lfaa/ui-primitives/client";
import type { ComposerAttachment } from "./composer-context";
import { filesToAttachments } from "./composer-attachments";
import type { ChatLocaleMessages } from "../locales";
import styles from "./ComposerAddMenu.module.css";

/** 渲染左下角「+」按钮（带统一视口防越界 HoverTip）及原生文件/文件夹选择框。 */
export function ComposerAddMenu({
  locale,
  sessionId,
  active,
  fileInputRef,
  folderInputRef,
  onAttachItems,
  onToggleOpen,
}: {
  locale: ChatLocaleMessages;
  sessionId: string;
  active: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  folderInputRef: RefObject<HTMLInputElement | null>;
  onAttachItems: (items: ComposerAttachment[]) => void;
  onToggleOpen: () => void;
}) {
  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const items = await filesToAttachments(files, sessionId);
    onAttachItems(items);
    event.target.value = "";
  };

  const handleFolderSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const firstRel = (list[0] as File & { webkitRelativePath?: string }).webkitRelativePath || "";
    const folderName = firstRel.split("/")[0] || list[0]?.name || "folder";
    const previewLines = list
      .slice(0, 60)
      .map((f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
    onAttachItems([
      {
        id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: "folder",
        label: folderName,
        detail: `${list.length} files`,
        contentPreview: previewLines.join("\n"),
      },
    ]);
    event.target.value = "";
  };

  return (
    <div className={styles.root}>
      <HoverTip label={locale.addContextMenuTitle}>
        <button
          type="button"
          className={`${styles.plusBtn} ${active ? styles.plusBtnOpen : ""}`}
          aria-expanded={active}
          aria-label={locale.addContextMenuTitle}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onToggleOpen}
        >
          <IconPlus size={16} aria-hidden="true" />
        </button>
      </HoverTip>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className={styles.hiddenInput}
        onChange={(e) => void handleFilesSelected(e)}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory 为标准浏览器目录选择非标属性。
        webkitdirectory=""
        className={styles.hiddenInput}
        onChange={handleFolderSelected}
      />
    </div>
  );
}
