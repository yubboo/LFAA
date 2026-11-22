// 渲染输入框上方的 @ 提及浮层，支持「添加 / LFAA 对话 / 插件」分组与键盘上下选择。
import {
  IconBrandChrome,
  IconBulb,
  IconDeviceDesktop,
  IconFolder,
  IconMessageCircle,
  IconPaperclip,
  IconPuzzle,
  IconTargetArrow,
} from "@tabler/icons-react";
import type { MentionEntry, SlashCommandEntry } from "./composer-context";
import type { ChatLocaleMessages } from "../locales";
import styles from "./MentionPopover.module.css";

function MentionIcon({ icon }: { icon: MentionEntry["icon"] }) {
  switch (icon) {
    case "paperclip":
      return <IconPaperclip size={15} aria-hidden="true" />;
    case "folder":
      return <IconFolder size={15} aria-hidden="true" />;
    case "target":
      return <IconTargetArrow size={15} aria-hidden="true" />;
    case "bulb":
      return <IconBulb size={15} aria-hidden="true" />;
    case "chat":
      return <IconMessageCircle size={15} aria-hidden="true" />;
    case "browser":
      return <IconBrandChrome size={15} aria-hidden="true" />;
    case "desktop":
      return <IconDeviceDesktop size={15} aria-hidden="true" />;
    default:
      return <IconPuzzle size={15} aria-hidden="true" />;
  }
}

/** 展示按来源分组的提及条目，将当前键盘索引对应到可选条目。 */
export function MentionPopover({
  locale,
  entries,
  highlightedIndex,
  onSelect,
}: {
  locale: ChatLocaleMessages;
  entries: MentionEntry[];
  highlightedIndex: number;
  onSelect: (entry: MentionEntry) => void;
}) {
  const groups: Array<{ key: MentionEntry["group"]; label: string }> = [
    { key: "add", label: locale.mentionAddGroup },
    { key: "sessions", label: locale.mentionSessionsGroup },
    { key: "plugins", label: locale.mentionPluginsGroup },
  ];

  let flatCursor = -1;

  return (
    <div className={styles.popover} role="listbox" aria-label={locale.ctxMention}>
      {entries.length === 0 ? (
        <p className={styles.empty}>{locale.mentionEmpty}</p>
      ) : (
        groups.map((grp) => {
          const items = entries.filter((entry) => entry.group === grp.key);
          if (items.length === 0) return null;
          return (
            <div key={grp.key}>
              <div className={styles.groupTitle}>{grp.label}</div>
              {items.map((entry) => {
                flatCursor += 1;
                const isHighlighted = flatCursor === highlightedIndex;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="option"
                    aria-selected={isHighlighted}
                    className={`${styles.item} ${isHighlighted ? styles.itemHighlighted : ""}`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onSelect(entry);
                    }}
                  >
                    <span className={styles.itemMain}>
                      <MentionIcon icon={entry.icon} />
                      <span className={styles.itemTitle}>{entry.title}</span>
                      {entry.description && <span className={styles.itemDesc}>{entry.description}</span>}
                    </span>
                    {entry.rightTag && <span className={styles.rightTag}>{entry.rightTag}</span>}
                  </button>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}

/** 展示输入框匹配到的斜杠命令，将选择交还给聊天输入框。 */
export function SlashCommandPopover({
  isZh,
  entries,
  highlightedIndex,
  onSelect,
}: {
  isZh: boolean;
  entries: SlashCommandEntry[];
  highlightedIndex: number;
  onSelect: (entry: SlashCommandEntry) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div className={styles.popover} role="listbox" aria-label={isZh ? "斜杠操作指令" : "Slash commands"}>
      <div className={styles.group}>
        <div className={styles.groupLabel}>
          {isZh ? "操作指令 (/) · Tab 补全 · Enter 选择" : "Commands (/) · Tab to complete"}
        </div>
        {entries.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={idx === highlightedIndex}
            className={`${styles.item} ${idx === highlightedIndex ? styles.itemHighlighted : ""}`}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(item);
            }}
          >
            <span className={styles.itemMain}>
              <IconBulb size={15} />
              <span className={styles.itemTitle}>{item.command}</span>
              <span className={styles.itemDesc}>{`${item.title} · ${item.desc}`}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
