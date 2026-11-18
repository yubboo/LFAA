// 呈现截图中的一级图标栏、更多/插件菜单及本地工作区状态。
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import type { WorkbenchAccountActionContribution } from "../../src/index";
import type { LocaleMessages } from "../locales";
import type { NavigationView } from "../navigation";
import type { WorkbenchDomainId } from "../workbench-domains";
import { NavigationIcon, type NavigationIconName } from "./NavigationIcon";
import { AppMenu } from "./AppMenu";
import { UserMenu } from "./UserMenu";
import styles from "./NavigationRail.module.css";

type RailAction = { view: NavigationView; label: string; icon: NavigationIconName };
type RailMenu = "more" | "plugins" | "status" | null;

export function NavigationRail({
  locale,
  activeView,
  activeDomain,
  pinnedApps,
  accountActions,
  onNavigate,
  onTogglePinned,
  onOpenAppearance,
}: {
  locale: LocaleMessages;
  activeView: NavigationView;
  activeDomain: WorkbenchDomainId;
  pinnedApps: NavigationView[];
  accountActions: WorkbenchAccountActionContribution<ReactNode>[];
  onNavigate: (view: NavigationView) => void;
  onTogglePinned: (view: NavigationView) => boolean;
  onOpenAppearance: () => void;
}) {
  const [openMenu, setOpenMenu] = useState<RailMenu>(null);
  const [menuTop, setMenuTop] = useState(72);
  const rootRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpenMenu(null);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [openMenu]);

  const moreActions: RailAction[] = [
    { view: "projects", label: locale.projects, icon: "project" },
    { view: "sites", label: locale.sites, icon: "sites" },
    { view: "maps", label: locale.maps, icon: "map" },
    { view: "gpt", label: locale.gpt, icon: "gpt" },
    { view: "codeReview", label: locale.codeReview, icon: "codeReview" },
    { view: "openAiDevelopers", label: locale.openAiDevelopers, icon: "openai" },
    { view: "canva", label: locale.canva, icon: "canva" },
    { view: "data", label: locale.data, icon: "data" },
  ];

  const toggleMenu = (menu: Exclude<RailMenu, null>, event: MouseEvent<HTMLButtonElement>) => {
    triggerRef.current = event.currentTarget;
    const roomForMenu = menu === "more" ? 380 : 200;
    setMenuTop(Math.max(8, Math.min(event.currentTarget.getBoundingClientRect().top - 4, window.innerHeight - roomForMenu)));
    setOpenMenu((current) => current === menu ? null : menu);
  };
  const select = (view: NavigationView) => { setOpenMenu(null); onNavigate(view); };

  return (
    <nav
      className={styles.rail}
      ref={rootRef}
      aria-label={locale.primaryNavigation}
      data-region="primary-navigation"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !openMenu) return;
        event.stopPropagation();
        setOpenMenu(null);
        triggerRef.current?.focus();
      }}
    >
      <div className={styles.topGroup}>
        <RailButton label={locale.home} icon="home" active={activeView === "workspace"} onClick={() => select("workspace")} />
        <RailButton label={locale.images} icon="images" active={activeView === "images"} onClick={() => select("images")} />
        <RailButton label={locale.scheduled} icon="scheduled" active={activeView === "scheduled"} onClick={() => select("scheduled")} />
        <RailButton label={locale.library} icon="library" active={activeView === "library"} onClick={() => select("library")} />
        <RailButton label={locale.plugins} icon="plugins" active={activeView === "plugins"} expanded={openMenu === "plugins"} onClick={(event) => toggleMenu("plugins", event)} />
        <RailButton label={locale.more} icon="more" active={openMenu === "more"} expanded={openMenu === "more"} onClick={(event) => toggleMenu("more", event)} />
        <div className={styles.divider} />
        {pinnedApps.map((view) => {
          const action = moreActions.find((item) => item.view === view);
          return action
            ? <RailButton key={view} label={action.label} icon={action.icon} active={activeView === view} onClick={() => select(view)} />
            : null;
        })}
      </div>

      <div className={styles.bottomGroup}>
        <div className={styles.statusRoot}>
          {openMenu === "status" && (
            <div className={styles.statusPanel} role="status">{locale.localStatus}</div>
          )}
          <RailButton label={locale.localMode} icon="companion" active={openMenu === "status"} expanded={openMenu === "status"} onClick={(event) => toggleMenu("status", event)} />
        </div>
        <UserMenu locale={locale} active={activeDomain === "settings"} accountActions={accountActions} onOpenAppearance={onOpenAppearance} />
      </div>

      {openMenu === "more" && (
        <AppMenu actions={moreActions} top={menuTop} locale={locale} pinnedApps={pinnedApps} onSelect={select} onTogglePinned={onTogglePinned} />
      )}
      {openMenu === "plugins" && (
        <section
          className={styles.popover}
          style={{ "--menu-top": `${menuTop}px` } as CSSProperties}
          role="dialog"
          aria-label={locale.plugins}
        >
          <p className={styles.popoverHeading}>{locale.installedPlugins}</p>
          <p className={styles.emptyHint}>{locale.noPlugins}</p>
          <button className={styles.popoverItem} type="button" onClick={() => select("plugins")}>
            <NavigationIcon name="plugins" /><span>{locale.openPluginCenter}</span><NavigationIcon name="chevronRight" className={styles.chevron} />
          </button>
        </section>
      )}
    </nav>
  );
}

function RailButton({
  label,
  icon,
  active,
  expanded,
  onClick,
}: {
  label: string;
  icon: NavigationIconName;
  active: boolean;
  expanded?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      className={`${styles.railButton} ${active ? styles.railButtonActive : ""}`}
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      data-tooltip={label}
      onClick={onClick}
    >
      <NavigationIcon name={icon} className={styles.railIcon} />
    </button>
  );
}
