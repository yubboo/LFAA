// 渲染输入框左下角 + 按钮、图一「添加文件等内容 @」提示条及图二「添加上下文」菜单。
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  IconAt,
  IconBrandChrome,
  IconCloud,
  IconEdit,
  IconFolder,
  IconPaperclip,
  IconPlus,
} from "@tabler/icons-react";
import type { ComposerAttachment } from "./composer-context";
import { filesToAttachments } from "./composer-attachments";
import type { ChatLocaleMessages } from "../locales";
import styles from "./ComposerAddMenu.module.css";

/** 从输入栏打开附件和上下文菜单，将选中的操作交给父级编辑器执行。 */
export function ComposerAddMenu({
  locale,
  sessionId,
  fileInputRef,
  onAttachItems,
  onTriggerMention,
  onTriggerSlash,
  onOpenBrowser,
  onPickProject,
}: {
  locale: ChatLocaleMessages;
  /** 当前会话 id；为空（草稿）时附件只做前端预览，不上传。 */
  sessionId: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onAttachItems: (items: ComposerAttachment[]) => void;
  onTriggerMention: (initialQuery?: string) => void;
  onTriggerSlash: () => void;
  onOpenBrowser?: (() => void) | undefined;
  /** 仅当界面当前无可见项目入口（如未绑定项目的聊天模式）时传入，提供选择项目入口。 */
  onPickProject?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const items = await filesToAttachments(files, sessionId);
    onAttachItems(items);
    event.target.value = "";
    setOpen(false);
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
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={`${styles.plusBtn} ${open ? styles.plusBtnOpen : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={locale.addContextTooltip}
        onClick={() => {
          setNotice("");
          setOpen((prev) => !prev);
        }}
      >
        <IconPlus size={16} aria-hidden="true" />
      </button>

      <span className={styles.tooltip} role="tooltip">
        <span>{locale.addContextTooltip}</span>
        <span className={styles.keycap}>@</span>
      </span>

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

      {open && (
        <div className={styles.popover} role="dialog" aria-label={locale.addContextMenuTitle}>
          <div className={styles.menuHeader}>{locale.addContextMenuTitle}</div>

          {/* 仅在界面没有可见项目入口时提供「选择项目」，避免与上方挂载条或独立项目胶囊重复。 */}
          {onPickProject && (
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => {
                setOpen(false);
                onPickProject();
              }}
            >
              <span className={styles.menuItemMain}>
                <IconFolder size={15} aria-hidden="true" />
                <span>{locale.selectProject}</span>
              </span>
            </button>
          )}

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              setOpen(false);
              fileInputRef.current?.click();
            }}
          >
            <span className={styles.menuItemMain}>
              <IconPaperclip size={15} aria-hidden="true" />
              <span>{locale.ctxFile}</span>
            </span>
          </button>

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              setOpen(false);
              folderInputRef.current?.click();
            }}
          >
            <span className={styles.menuItemMain}>
              <IconFolder size={15} aria-hidden="true" />
              <span>{locale.ctxFolder}</span>
            </span>
          </button>

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              setOpen(false);
              onTriggerMention("");
            }}
          >
            <span className={styles.menuItemMain}>
              <IconAt size={15} aria-hidden="true" />
              <span>{locale.ctxMention}</span>
            </span>
          </button>

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              setOpen(false);
              onTriggerSlash();
            }}
          >
            <span className={styles.menuItemMain}>
              <IconEdit size={15} aria-hidden="true" />
              <span>{locale.ctxActions}</span>
            </span>
          </button>

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              if (onOpenBrowser) {
                setOpen(false);
                onOpenBrowser();
              } else {
                setNotice(locale.ctxServiceUnavailable);
              }
            }}
          >
            <span className={styles.menuItemMain}>
              <IconBrandChrome size={15} aria-hidden="true" />
              <span>{locale.ctxBrowser}</span>
            </span>
          </button>

          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              if (onOpenBrowser) {
                setOpen(false);
                onOpenBrowser();
              } else {
                setNotice(locale.ctxServiceUnavailable);
              }
            }}
          >
            <span className={styles.menuItemMain}>
              <IconCloud size={15} aria-hidden="true" />
              <span>{locale.ctxCloudDrive}</span>
            </span>
            <span className={styles.setupTag}>{locale.ctxSetUp}</span>
          </button>

          {notice && (
            <p className={styles.noticeText} role="status">{notice}</p>
          )}
        </div>
      )}
    </div>
  );
}
