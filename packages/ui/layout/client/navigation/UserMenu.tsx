// 展示本地用户菜单，并复用现有外观设置入口与主题插件提供的头部快捷操作。
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { WorkbenchAccountActionContribution } from "../../contract/index";
import type { LocaleMessages } from "../locales";
import { NavigationIcon } from "./NavigationIcon";
import { resolveUserMenuGeometry, type UserMenuGeometry } from "./user-menu-geometry";
import { formatShortcutKeys, readShortcutKeysFor } from "../shortcuts";
import { defaultShortcutKeys } from "../shortcut-defaults";
import styles from "./UserMenu.module.css";

type UserAction = "companion" | "invite" | "profile" | "help" | "signOut";

/** 在账号菜单挂载主题快捷切换和设置入口，复用独立外观插件的贡献。 */
export function UserMenu({
  locale,
  active = false,
  accountActions = [],
  onOpenAppearance,
  onOpenSettings,
}: {
  locale: LocaleMessages;
  active?: boolean;
  accountActions?: WorkbenchAccountActionContribution<ReactNode>[];
  /** 「个性化」入口：直接打开外观设置。 */
  onOpenAppearance: () => void;
  /** 「设置」入口：打开设置中心首屏（常规）。 */
  onOpenSettings: () => void;
}) {
  const settingsHint = formatShortcutKeys(readShortcutKeysFor("navigation.settings", defaultShortcutKeys("navigation.settings")));
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [panelPos, setPanelPos] = useState<UserMenuGeometry | null>(null);

  /**
   * 量取菜单卡片位置：卡片跟着左二会话栏走，宽度取该栏内宽，
   * 不再以固定 344px 盖住会话区；窄屏（≤767px）交给 CSS 底部抽屉布局。
   */
  const measurePanel = useCallback(() => {
    const trigger = triggerRef.current?.getBoundingClientRect();
    const compact = window.matchMedia("(max-width: 767px)").matches;
    if (!trigger || compact) {
      setPanelPos(null);
      return;
    }
    // 左二栏是壳层公开区域，收起时该节点不存在，退回贴着图标栏的独立浮层。
    const column = document.querySelector<HTMLElement>('[data-region="section-navigation"]')?.getBoundingClientRect();
    setPanelPos(resolveUserMenuGeometry({
      trigger,
      column: column && column.width > 0 ? column : null,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }));
  }, []);

  useEffect(() => {
    if (!open) return;
    measurePanel();
    window.addEventListener("resize", measurePanel);
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", measurePanel);
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [measurePanel, open]);

  const showNotice = (action: UserAction) => {
    const messages: Record<UserAction, string> = {
      companion: locale.companionUnavailable,
      invite: locale.inviteUnavailable,
      profile: locale.profileUnavailable,
      help: locale.helpMessage,
      signOut: locale.signOutMessage,
    };
    setNotice(messages[action]);
  };

  return (
    <div className={styles.root} ref={rootRef} onKeyDown={(event) => {
      if (!open || event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }}>
      {open && createPortal(
        <>
          <div className={styles.scrim} aria-hidden="true" onClick={() => setOpen(false)} />
          <section
            className={styles.panel}
            id="lfaa-user-menu"
            aria-label={locale.accountMenu}
            ref={panelRef}
            style={panelPos ? { left: `${panelPos.left}px`, bottom: `${panelPos.bottom}px`, width: `${panelPos.width}px` } : undefined}
          >
          <header className={styles.account}>
            <span className={styles.avatar} aria-hidden="true">LF</span>
            <span className={styles.accountMeta}><strong>{locale.localUser}</strong><small>{locale.localMode}</small></span>
            {accountActions.length > 0 && (
              <div className={styles.accountActions}>
                {accountActions.map((entry) => (
                  <Fragment key={entry.id}>{entry.render()}</Fragment>
                ))}
              </div>
            )}
          </header>
          <div className={styles.separator} />
          <div className={styles.group}>
            <button className={styles.action} type="button" onClick={() => showNotice("companion")}>
              <NavigationIcon name="companion" /><span>{locale.showCompanion}</span><small>{locale.unavailable}</small>
            </button>
            <button className={styles.action} type="button" onClick={() => showNotice("invite")}>
              <NavigationIcon name="invite" /><span>{locale.inviteFriends}</span><small>{locale.unavailable}</small>
            </button>
            <button className={styles.action} type="button" onClick={() => { setOpen(false); onOpenAppearance(); }}>
              <NavigationIcon name="settings" /><span>{locale.personalization}</span>
            </button>
            <button className={styles.action} type="button" onClick={() => showNotice("profile")}>
              <NavigationIcon name="profile" /><span>{locale.personalProfile}</span><small>{locale.unavailable}</small>
            </button>
            <button className={styles.action} type="button" onClick={() => { setOpen(false); onOpenSettings(); }}>
              <NavigationIcon name="settings" /><span>{locale.settings}</span>
              {settingsHint && <kbd className={styles.kbd}>{settingsHint}</kbd>}
            </button>
          </div>
          <div className={styles.separator} />
          <div className={styles.group}>
            <button className={styles.action} type="button" onClick={() => showNotice("help")}>
              <NavigationIcon name="help" /><span>{locale.help}</span><NavigationIcon name="chevronRight" className={styles.chevron} />
            </button>
            <button className={styles.action} type="button" onClick={() => showNotice("signOut")}>
              <NavigationIcon name="signOut" /><span>{locale.signOut}</span>
            </button>
          </div>
          {notice && <p className={styles.notice} role="status">{notice}</p>}
          </section>
        </>,
        document.body,
      )}
      <button
        className={`${styles.trigger} ${open || active ? styles.triggerActive : ""}`}
        ref={triggerRef}
        type="button"
        aria-label={locale.accountMenu}
        aria-expanded={open}
        aria-controls="lfaa-user-menu"
        data-tooltip={locale.accountMenu}
        onClick={() => {
          setNotice("");
          if (open) {
            setOpen(false);
            return;
          }
          // 打开前先量尺寸：首帧就是贴着左二栏的宽度，避免先按固定宽度闪一下再跳。
          measurePanel();
          setOpen(true);
        }}
      >
        <span className={styles.avatar} aria-hidden="true">LF</span>
      </button>
    </div>
  );
}

