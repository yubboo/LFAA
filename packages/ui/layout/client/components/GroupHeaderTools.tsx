// 渲染左二分组标题栏右侧按需显现的排序下拉按钮与快捷操作按钮（如新建项目 / 新聊天）。
import type { RefObject } from "react";
import type { ProjectSortMode } from "../ui-preferences";
import { NavigationIcon } from "./NavigationIcon";
import styles from "./NavigationGroups.module.css";

/** 展示分组排序和快捷创建动作，使分组工具不挤占常规列表行。 */
export function GroupHeaderTools({
  filterLabel,
  sortByCreatedLabel,
  sortByNameLabel,
  triggerRef,
  isMenuOpen,
  currentSort,
  onToggleMenu,
  onSelectSort,
  action,
}: {
  filterLabel: string;
  sortByCreatedLabel: string;
  sortByNameLabel: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  isMenuOpen: boolean;
  currentSort: ProjectSortMode;
  onToggleMenu: () => void;
  onSelectSort: (nextSort: ProjectSortMode) => void;
  action?: { label: string; icon: "plus" | "newChat"; onClick: () => void };
}) {
  return (
    <div className={styles.groupTools} data-tools-open={isMenuOpen ? "true" : undefined}>
      <button
        ref={triggerRef}
        className={styles.toolButton}
        type="button"
        aria-label={filterLabel}
        aria-expanded={isMenuOpen}
        data-tooltip={filterLabel}
        onClick={onToggleMenu}
      >
        <NavigationIcon name="filter" />
      </button>
      {action && (
        <button
          className={styles.toolButton}
          type="button"
          aria-label={action.label}
          data-tooltip={action.label}
          onClick={action.onClick}
        >
          <NavigationIcon name={action.icon} />
        </button>
      )}
      {isMenuOpen && (
        <div className={styles.filterMenu} role="menu" aria-label={filterLabel}>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={currentSort === "created"}
            onClick={() => onSelectSort("created")}
          >
            {sortByCreatedLabel}
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={currentSort === "name"}
            onClick={() => onSelectSort("name")}
          >
            {sortByNameLabel}
          </button>
        </div>
      )}
    </div>
  );
}
