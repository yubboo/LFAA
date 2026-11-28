// 呈现工作台一级图标栏，负责直接导航、更多菜单及本地工作区状态。
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from "react";
import type { WorkbenchAccountActionContribution } from "../../contract/index";
import type { LocaleMessages } from "../locales";
import type { NavigationView } from "./navigation";
import type { WorkbenchDomainId } from "./workbench-domains";
import { NavigationIcon, type NavigationIconName } from "./NavigationIcon";
import { AppMenu } from "./AppMenu";
import { UserMenu } from "./UserMenu";
import styles from "./NavigationRail.module.css";

type RailAction = { view: NavigationView; label: string; icon: NavigationIconName };
type RailMenu = "more" | "status" | null;

/** 展示桌面图标栏或窄屏底部导航，所有入口共用当前工作台路由。 */
export function NavigationRail({
  locale,
  isMobile,
  activeView,
  activeDomain,
  pinnedApps,
  accountActions,
  onNavigate,
  onTogglePinned,
  onOpenAppearance,
  onOpenSettings,
}: {
  locale: LocaleMessages;
  isMobile: boolean;
  activeView: NavigationView;
  activeDomain: WorkbenchDomainId;
  pinnedApps: NavigationView[];
  accountActions: WorkbenchAccountActionContribution<ReactNode>[];
  onNavigate: (view: NavigationView) => void;
  onTogglePinned: (view: NavigationView) => boolean;
  onOpenAppearance: () => void;
  onOpenSettings: () => void;
}) {
  const [openMenu, setOpenMenu] = useState<RailMenu>(null);
  const rootRef = useRef<HTMLElement>(null);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeMoreMenu = useCallback(() => setOpenMenu((menu) => (menu === "more" ? null : menu)), []);

  // 进入手机布局时关闭已经失去入口的竖栏弹层。
  useEffect(() => {
    if (isMobile) setOpenMenu((menu) => menu === "more" ? menu : null);
  }, [isMobile]);

  useEffect(() => {
    if (openMenu !== "status") return;
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpenMenu(null);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [openMenu]);

  const primaryActions: RailAction[] = [
    { view: "scheduled", label: locale.scheduled, icon: "scheduled" },
    { view: "library", label: locale.library, icon: "library" },
    { view: "plugins", label: locale.plugins, icon: "plugins" },
  ];
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
    setOpenMenu((current) => current === menu ? null : menu);
  };
  // 主入口直接切换工作台路由，同时收起当前图标栏菜单。
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
        {/* 首页=单聊，其后是群聊与 Agents：两个高频入口在前，配置入口紧随其后。 */}
        <RailButton label={locale.group} icon="group" active={activeView === "group"} onClick={() => select("group")} />
        <RailButton label={locale.agents} icon="agents" active={activeView === "agents"} onClick={() => select("agents")} />
        {!isMobile && primaryActions.map(({ view, label, icon }) => (
          <RailButton
            key={view}
            label={label}
            icon={icon}
            active={activeView === view}
            onClick={() => select(view)}
          />
        ))}
        <RailButton
          buttonRef={moreTriggerRef}
          label={locale.more}
          icon="more"
          active={openMenu === "more" || (isMobile && activeView !== "workspace" && activeDomain !== "settings")}
          expanded={openMenu === "more"}
          controls="lfaa-app-menu"
          onClick={(event) => toggleMenu("more", event)}
        />
        {!isMobile && <div className={styles.divider} />}
        {!isMobile && pinnedApps.map((view) => {
          const action = moreActions.find((item) => item.view === view);
          return action
            ? <RailButton key={view} label={action.label} icon={action.icon} active={activeView === view} onClick={() => select(view)} />
            : null;
        })}
      </div>

      <div className={styles.bottomGroup} onClickCapture={isMobile ? () => setOpenMenu(null) : undefined}>
        {!isMobile && <div className={styles.statusRoot}>
          {openMenu === "status" && (
            <div className={styles.statusPanel} role="status">{locale.localStatus}</div>
          )}
          <RailButton label={locale.localMode} icon="companion" active={openMenu === "status"} expanded={openMenu === "status"} onClick={(event) => toggleMenu("status", event)} />
        </div>}
        <UserMenu locale={locale} active={activeDomain === "settings"} accountActions={accountActions} onOpenAppearance={onOpenAppearance} onOpenSettings={onOpenSettings} />
      </div>

      <AppMenu
        open={openMenu === "more"}
        anchorRef={moreTriggerRef}
        actions={isMobile ? [...primaryActions, ...moreActions] : moreActions}
        locale={locale}
        isMobile={isMobile}
        activeView={activeView}
        pinnedApps={pinnedApps}
        onClose={closeMoreMenu}
        onSelect={(view) => {
          select(view);
          if (isMobile) moreTriggerRef.current?.focus();
        }}
        onTogglePinned={onTogglePinned}
      />
    </nav>
  );
}

function RailButton({
  buttonRef,
  label,
  icon,
  active,
  expanded,
  controls,
  onClick,
}: {
  buttonRef?: RefObject<HTMLButtonElement | null>;
  label: string;
  icon: NavigationIconName;
  active: boolean;
  expanded?: boolean | undefined;
  controls?: string | undefined;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      ref={buttonRef}
      className={`${styles.railButton} ${active ? styles.railButtonActive : ""}`}
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      data-tooltip={label}
      onClick={onClick}
    >
      <NavigationIcon name={icon} className={styles.railIcon} />
    </button>
  );
}
