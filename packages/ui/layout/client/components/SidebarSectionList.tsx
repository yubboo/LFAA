// 统一的左二菜单栏列表原语：复用搜索框、分组标题、折叠能力、拖拽分区、空态与液态玻璃交互样式。
import { useState, type ReactNode } from "react";
import { NavigationIcon, type NavigationIconName } from "./NavigationIcon";
import styles from "./SidebarSectionList.module.css";

export interface SidebarItemConfig {
  id: string;
  label: string;
  icon: NavigationIconName;
  nested?: boolean;
  hideIcon?: boolean;
  expanded?: boolean;
  active?: boolean;
  unread?: boolean;
  trailingHint?: string;
  title?: string;
  onClick: () => void;
  actions?: ReactNode;
  actionsVisible?: boolean;
  draggableProjectId?: string;
  onMouseEnter?: (element: HTMLElement) => void;
  onMouseLeave?: () => void;
  onDoubleClick?: () => void;
}

export interface SidebarGroupConfig {
  id: string;
  title: string;
  collapsible?: boolean;
  expanded?: boolean;
  isCustomSection?: boolean;
  onToggle?: () => void;
  tools?: ReactNode;
  items: SidebarItemConfig[];
  emptyText?: string;
  emptyAction?: {
    label: string;
    icon: NavigationIconName;
    onClick: () => void;
  };
  onDropProject?: (projectId: string) => void;
  footerNote?: string;
}

const DRAG_PROJECT_MIME = "text/lfaa-project-id";

export function SidebarSectionList({
  ariaLabel,
  search,
  topSlot,
  groups,
  emptySearchText,
}: {
  ariaLabel: string;
  search?: {
    value: string;
    placeholder: string;
    onChange: (nextValue: string) => void;
  };
  topSlot?: ReactNode;
  groups: SidebarGroupConfig[];
  emptySearchText?: string;
}) {
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);

  return (
    <div className={styles.root} role="navigation" aria-label={ariaLabel}>
      {search && (
        <label className={styles.searchWrap}>
          <NavigationIcon name="search" />
          <input
            type="search"
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder}
            aria-label={search.placeholder}
          />
        </label>
      )}

      {topSlot}

      <div className={styles.groups}>
        {groups.map((group) => {
          const isOpen = group.collapsible ? Boolean(group.expanded) : true;
          const isDropTarget = dragOverGroupId === group.id;
          return (
            <section
              key={group.id}
              className={`${styles.group} ${isDropTarget ? styles.groupDropActive : ""}`}
              onDragOver={group.onDropProject ? (event) => {
                event.preventDefault();
                if (dragOverGroupId !== group.id) setDragOverGroupId(group.id);
              } : undefined}
              onDragLeave={group.onDropProject ? (event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDragOverGroupId((curr) => (curr === group.id ? null : curr));
                }
              } : undefined}
              onDrop={group.onDropProject ? (event) => {
                event.preventDefault();
                setDragOverGroupId(null);
                const projectId = event.dataTransfer.getData(DRAG_PROJECT_MIME);
                if (projectId) group.onDropProject?.(projectId);
              } : undefined}
            >
              <div
                className={styles.headingRow}
                data-heading-row="true"
                data-section-heading={group.isCustomSection ? "true" : undefined}
              >
                {group.collapsible ? (
                  <button
                    type="button"
                    className={styles.groupHeadingButton}
                    aria-expanded={isOpen}
                    onClick={group.onToggle}
                  >
                    <span>{group.title}</span>
                    <NavigationIcon name={isOpen ? "chevronDown" : "chevronRight"} />
                  </button>
                ) : (
                  <p className={styles.sectionTitle}>{group.title}</p>
                )}
                {group.tools}
              </div>

              {isOpen && (
                <div className={styles.list}>
                  {group.items.length > 0 ? (
                    group.items.map((item) => (
                      item.actions ? (
                        <div
                          key={item.id}
                          className={`${styles.itemRow} ${item.nested ? styles.itemNested : ""} ${item.active ? styles.itemActive : ""}`}
                          data-sidebar-item={item.id}
                          data-actions-visible={item.actionsVisible ? "true" : undefined}
                          draggable={Boolean(item.draggableProjectId)}
                          onDragStart={item.draggableProjectId ? (event) => {
                            event.dataTransfer.setData(DRAG_PROJECT_MIME, item.draggableProjectId!);
                            event.dataTransfer.effectAllowed = "move";
                          } : undefined}
                          onMouseEnter={(event) => item.onMouseEnter?.(event.currentTarget)}
                          onMouseLeave={() => item.onMouseLeave?.()}
                        >
                          <button
                            type="button"
                            className={styles.itemMain}
                            aria-current={item.active ? "page" : undefined}
                            aria-expanded={item.expanded}
                            title={item.onMouseEnter ? undefined : (item.title ?? item.label)}
                            onClick={item.onClick}
                            onDoubleClick={item.onDoubleClick}
                          >
                            {!item.hideIcon && <NavigationIcon name={item.icon} />}
                            <span className={styles.label}>{item.label}</span>
                            {item.unread && <span className={styles.unreadDot} aria-label="未读" />}
                          </button>
                          {item.trailingHint && (
                            <span className={styles.trailingHint}>{item.trailingHint}</span>
                          )}
                          <div className={styles.rowActions}>
                            {item.actions}
                          </div>
                        </div>
                      ) : (
                        <button
                          key={item.id}
                          type="button"
                          className={`${styles.item} ${item.nested ? styles.itemNested : ""} ${item.active ? styles.itemActive : ""}`}
                          aria-current={item.active ? "page" : undefined}
                          title={item.onMouseEnter ? undefined : (item.title ?? item.label)}
                          onClick={item.onClick}
                        >
                          {!item.hideIcon && <NavigationIcon name={item.icon} />}
                          <span className={styles.label}>{item.label}</span>
                        </button>
                      )
                    ))
                  ) : group.emptyAction ? (
                    <button
                      type="button"
                      className={styles.emptyAction}
                      onClick={group.emptyAction.onClick}
                    >
                      <NavigationIcon name={group.emptyAction.icon} />
                      <span className={styles.label}>{group.emptyAction.label}</span>
                    </button>
                  ) : group.emptyText ? (
                    <p className={group.isCustomSection ? styles.emptySectionHint : styles.emptyGroup}>
                      {group.emptyText}
                    </p>
                  ) : null}
                  {group.footerNote && <p className={styles.localNote}>{group.footerNote}</p>}
                </div>
              )}
            </section>
          );
        })}

        {groups.length === 0 && emptySearchText && (
          <p className={styles.emptySearch}>{emptySearchText}</p>
        )}
      </div>
    </div>
  );
}
