// 展示本地用户菜单，并复用现有外观设置入口与主题插件提供的头部快捷操作。
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { WorkbenchAccountActionContribution } from "../../contract/index";
import type { LocaleMessages } from "../locales";
import { NavigationIcon } from "./NavigationIcon";
import styles from "./UserMenu.module.css";

type UserAction = "companion" | "invite" | "profile" | "help" | "signOut";

/** 在账号菜单挂载主题快捷切换和设置入口，复用独立外观插件的贡献。 */
export function UserMenu({
  locale,
  active = false,
  accountActions = [],
  onOpenAppearance,
}: {
  locale: LocaleMessages;
  active?: boolean;
  accountActions?: WorkbenchAccountActionContribution<ReactNode>[];
  onOpenAppearance: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [panelPos, setPanelPos] = useState<{ left: number; bottom: number; width: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const computePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      const compact = window.matchMedia("(max-width: 767px)").matches;
      if (!rect || compact) {
        setPanelPos(null);
        return;
      }
      const gap = 8;
      setPanelPos({
        left: rect.right + gap,
        bottom: Math.max(8, window.innerHeight - rect.bottom),
        width: Math.min(344, window.innerWidth - rect.right - gap * 2),
      });
    };
    computePosition();
    window.addEventListener("resize", computePosition);
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-theme-quick-menu]")) return;
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
      window.removeEventListener("resize", computePosition);
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

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
      if (event.key !== "Escape") return;
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
            <button className={styles.action} type="button" onClick={() => { setOpen(false); onOpenAppearance(); }}>
              <NavigationIcon name="settings" /><span>{locale.settings}</span>
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
        onClick={() => { setNotice(""); setOpen((value) => !value); }}
      >
        <span className={styles.avatar} aria-hidden="true">LF</span>
      </button>
    </div>
  );
}
