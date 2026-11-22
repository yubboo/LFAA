// 展示更多应用。桌面支持固定入口，手机汇总从底栏移入的功能。
import { useState, type CSSProperties } from "react";
import type { LocaleMessages } from "../locales";
import type { NavigationView } from "./navigation";
import type { NavigationIconName } from "./NavigationIcon";
import { NavigationIcon } from "./NavigationIcon";
import styles from "./AppMenu.module.css";

interface AppMenuAction {
  view: NavigationView;
  label: string;
  icon: NavigationIconName;
}

/** 将桌面固定入口和窄屏收纳入口集中到同一菜单，选中应用通过工作台路由打开。 */
export function AppMenu({
  actions,
  top,
  locale,
  isMobile,
  activeView,
  pinnedApps,
  onSelect,
  onTogglePinned,
}: {
  actions: AppMenuAction[];
  top: number;
  locale: LocaleMessages;
  isMobile: boolean;
  activeView: NavigationView;
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
      {actions.map((action, index) => {
        const pinned = pinnedApps.includes(action.view);
        return (
          <div key={action.view} className={styles.entry}>
            <button
              className={styles.entryAction}
              type="button"
              autoFocus={isMobile && index === 0}
              aria-current={isMobile && activeView === action.view ? "page" : undefined}
              onClick={() => onSelect(action.view)}
            >
              <NavigationIcon name={action.icon} /><span>{action.label}</span>
            </button>
            {!isMobile && <button
              className={`${styles.pinButton} ${pinned ? styles.pinButtonActive : ""}`}
              type="button"
              aria-label={`${pinned ? locale.unpinApp : locale.pinApp}: ${action.label}`}
              aria-pressed={pinned}
              onClick={() => setNotice(onTogglePinned(action.view) ? "" : locale.pinStorageError)}
            ><NavigationIcon name="pin" /></button>}
          </div>
        );
      })}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
    </section>
  );
}
