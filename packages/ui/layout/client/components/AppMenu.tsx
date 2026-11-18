// 展示更多应用，并支持把可用入口固定到一级图标栏。
import { useState, type CSSProperties } from "react";
import type { LocaleMessages } from "../locales";
import type { NavigationView } from "../navigation";
import type { NavigationIconName } from "./NavigationIcon";
import { NavigationIcon } from "./NavigationIcon";
import styles from "./AppMenu.module.css";

interface AppMenuAction {
  view: NavigationView;
  label: string;
  icon: NavigationIconName;
}

export function AppMenu({
  actions,
  top,
  locale,
  pinnedApps,
  onSelect,
  onTogglePinned,
}: {
  actions: AppMenuAction[];
  top: number;
  locale: LocaleMessages;
  pinnedApps: NavigationView[];
  onSelect: (view: NavigationView) => void;
  onTogglePinned: (view: NavigationView) => boolean;
}) {
  const [notice, setNotice] = useState("");

  return (
    <section
      className={styles.menu}
      style={{ "--menu-top": `${top}px` } as CSSProperties}
      role="dialog"
      aria-label={locale.more}
    >
      {actions.map((action) => {
        const pinned = pinnedApps.includes(action.view);
        return (
          <div key={action.view} className={styles.entry}>
            <button className={styles.entryAction} type="button" onClick={() => onSelect(action.view)}>
              <NavigationIcon name={action.icon} /><span>{action.label}</span>
            </button>
            <button
              className={`${styles.pinButton} ${pinned ? styles.pinButtonActive : ""}`}
              type="button"
              aria-label={`${pinned ? locale.unpinApp : locale.pinApp}: ${action.label}`}
              aria-pressed={pinned}
              onClick={() => setNotice(onTogglePinned(action.view) ? "" : locale.pinStorageError)}
            ><NavigationIcon name="pin" /></button>
          </div>
        );
      })}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
    </section>
  );
}
