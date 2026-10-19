/** 功能：提供可在设置和业务工作区复用的二级菜单。作用：只渲染调用方给定的分组与当前项，不持有业务导航状态。 */
import type { KeyboardEvent, ReactNode, Ref, UIEventHandler } from "react";
import { WorkbenchIcon, type WorkbenchIconName } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import "./SecondaryNavigation.css";

export interface SecondaryNavigationItem {
  id: string;
  domId?: string;
  label: string;
  description?: string;
  icon?: WorkbenchIconName;
  trailingIcon?: WorkbenchIconName;
  active?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface SecondaryNavigationGroup {
  id: string;
  label: string;
  items: SecondaryNavigationItem[];
  expanded?: boolean;
  collapsible?: boolean;
  onToggle?: () => void;
}

export interface SecondaryNavigationProps {
  ariaLabel: string;
  groups: SecondaryNavigationGroup[];
  emptyState?: ReactNode;
  className?: string;
  activateOnArrow?: boolean;
  scrollRef?: Ref<HTMLElement>;
  onScroll?: UIEventHandler<HTMLElement>;
}

export function SecondaryNavigation({ ariaLabel, groups, emptyState, className, activateOnArrow = false, scrollRef, onScroll }: SecondaryNavigationProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(".secondary-navigation__item:not(:disabled)"))
      .filter((item) => item.tabIndex >= 0);
    if (!items.length) return;
    event.preventDefault();
    const currentIndex = items.indexOf(event.target as HTMLButtonElement);
    const nextIndex = event.key === "Home" ? 0
      : event.key === "End" ? items.length - 1
        : event.key === "ArrowDown" ? (currentIndex + 1 + items.length) % items.length
          : (currentIndex - 1 + items.length) % items.length;
    const next = items[nextIndex];
    next?.focus();
    if (activateOnArrow) next?.click();
  }

  return (
    <nav ref={scrollRef} onScroll={onScroll} onKeyDown={handleKeyDown} className={`secondary-navigation${className ? ` ${className}` : ""}`} aria-label={ariaLabel}>
      {groups.map((group) => {
        const expanded = group.expanded ?? true;
        const collapsible = group.collapsible ?? true;
        return (
          <section key={group.id} className={`secondary-navigation__section${expanded ? " is-expanded" : ""}`}>
            {collapsible
              ? <button type="button" className="secondary-navigation__group-trigger" aria-expanded={expanded} aria-controls={group.id} onClick={group.onToggle}><span>{group.label}</span></button>
              : <div className="secondary-navigation__group-label"><span>{group.label}</span></div>}
            <div id={group.id} className="secondary-navigation__items" aria-hidden={!expanded}>
              <div className="secondary-navigation__items-inner">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    id={item.domId}
                    type="button"
                    tabIndex={expanded ? 0 : -1}
                    className={`secondary-navigation__item${item.active ? " is-active" : ""}`}
                    aria-current={item.active ? "page" : undefined}
                    disabled={item.disabled}
                    onClick={item.onSelect}
                  >
                    {item.icon ? <WorkbenchIcon name={item.icon} size={18} /> : null}
                    <span className="secondary-navigation__item-copy">
                      <span>{item.label}</span>
                      {item.description ? <small>{item.description}</small> : null}
                    </span>
                    {item.trailingIcon ? <WorkbenchIcon className="secondary-navigation__item-trailing" name={item.trailingIcon} size={14} aria-hidden="true" /> : null}
                  </button>
                ))}
              </div>
            </div>
          </section>
        );
      })}
      {emptyState}
    </nav>
  );
}
