// 统一的左二菜单栏列表原语：复用搜索框、分组标题、折叠能力、拖拽分区、空态与液态玻璃交互样式。
import { useState, type ReactNode } from "react";
import { NavigationIcon, type NavigationIconName } from "../navigation/NavigationIcon";
import { ToolbarTip } from "../navigation/Toolbar-Tip";
import controlStyles from "./SidebarSectionList.controls.module.css";
import createStyles from "./SidebarSectionList.create.module.css";
import styles from "./SidebarSectionList.module.css";
import statusStyles from "./SidebarStatus.module.css";
import badgeStyles from "./SidebarSectionList.badge.module.css";

/** 定义侧栏列表行的名称、状态、动作和可选子层级。 */
export interface SidebarItemConfig {
  id: string;
  label: string;
  icon: NavigationIconName;
  nested?: boolean;
  hideIcon?: boolean;
  expanded?: boolean;
  active?: boolean;
  unread?: boolean;
  /** 会话通知已静音，显示铃铛关闭标记。 */
  muted?: boolean;
  /** 会话需要用户处理时的状态：等待审批或等待回答澄清。 */
  attention?: "approval" | "question";
  /** 徽标文案，例如「待确认」「待回答」。 */
  attentionLabel?: string;
  /** 已置顶项目显示强调色图钉；未置顶的行不出现任何强调色标记。 */
  pinned?: boolean;
  /** 图钉按钮的悬停提示与无障碍文案。 */
  pinLabel?: string;
  /** 末尾的会话窗口控件（展开其余 / 收起）：不承载选中态与行内动作。 */
  control?: boolean;
  /** 点击图钉取消置顶；不传时图钉只作状态标记。 */
  onTogglePin?: () => void;
  trailingHint?: string;
  /** 绑定工作树时在标题旁显示分支标签；不占会话时间提示的位置。 */
  branchLabel?: string;
  branchTitle?: string;
  title?: string;
  /** 行标签的悬停气泡（如默认工作区的完整路径）；设置后不再使用原生 title。 */
  labelTip?: string;
  onClick: () => void;
  actions?: ReactNode;
  actionsVisible?: boolean;
  draggableProjectId?: string;
  onMouseEnter?: (element: HTMLElement) => void;
  onMouseLeave?: () => void;
  onDoubleClick?: () => void;
}

/** 描述侧栏分组的标题、展开方式和内部行列表。 */
export interface SidebarGroupConfig {
  id: string;
  title: string;
  collapsible?: boolean;
  expanded?: boolean;
  isCustomSection?: boolean;
  onToggle?: () => void;
  tools?: ReactNode;
  items: SidebarItemConfig[];
  /** 固定显示在列表最前、但不参与空态判断的常驻行（如「默认工作区」）。 */
  leadingItems?: SidebarItemConfig[] | undefined;
  emptyText?: string;
  /** 列表末尾的弱化操作行（如「+ 创建新项目」），有项目时常驻显示但存在感很低。 */
  trailingAction?: {
    label: string;
    icon: NavigationIconName;
    onClick: () => void;
  } | undefined;
  emptyAction?: {
    label: string;
    icon: NavigationIconName;
    onClick: () => void;
  };
  onDropProject?: (projectId: string) => void;
  footerNote?: string;
}

const DRAG_PROJECT_MIME = "text/lfaa-project-id";

/** 解析行首状态：运行中优先，其次完成未读；没有状态时返回 null。 */
function statusState(item: SidebarItemConfig): "working" | "done" | null {
  if (item.icon === "working") return "working";
  return item.unread ? "done" : null;
}

/**
 * 行首状态标记：运行中显示旋转圆弧，完成未读显示小圆点。
 * 绝对定位在行首图标列（与项目文件夹图标同一列），不参与行内布局——有标记时标题不会右移；
 * 项目行、会话行、会话子行因此共用同一条左侧标记列，缩进只作用于图标与标题。
 */
function StatusMarker({ item }: { item: SidebarItemConfig }) {
  const state = statusState(item);
  if (!state) return null;
  return (
    <span
      className={statusStyles.statusMarker}
      data-state={state}
      aria-label={state === "working" ? "运行中" : "未读"}
    >
      {state === "working" && <NavigationIcon name="working" className={statusStyles.workingIcon} />}
    </span>
  );
}

/** 行首图标：状态标记占用图标位时只保留占位宽度，避免转圈/圆点与常态图标叠在一起。 */
function RowIcon({ item }: { item: SidebarItemConfig }) {
  if (item.hideIcon) return null;
  return (
    <NavigationIcon
      name={item.icon === "working" ? "newChat" : item.icon}
      className={statusState(item) ? statusStyles.iconSlotTaken : undefined}
    />
  );
}

/**
 * 渲染单行：带行内动作或置顶按钮的行用容器行，其余用按钮行。
 * 行标签支持统一气泡提示（labelTip），有提示时不再挂原生 title，避免两套悬浮层并存。
 */
function SidebarRow({ item }: { item: SidebarItemConfig }) {
  const label = item.labelTip ? (
    <ToolbarTip label={item.labelTip}>
      <span className={styles.label}>{item.label}</span>
    </ToolbarTip>
  ) : (
    <span className={styles.label}>{item.label}</span>
  );
  const nativeTitle = item.labelTip || item.onMouseEnter ? undefined : (item.title ?? item.label);

  if (item.actions || item.onTogglePin) {
    return (
      <div
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
        <StatusMarker item={item} />
        <button
          type="button"
          className={styles.itemMain}
          aria-current={item.active ? "page" : undefined}
          aria-expanded={item.expanded}
          title={nativeTitle}
          onClick={item.onClick}
          onDoubleClick={item.onDoubleClick}
        >
          <RowIcon item={item} />
          {label}
          {item.branchLabel && (
            <span className={badgeStyles.branchBadge} title={item.branchTitle ?? item.branchLabel}>
              {item.branchLabel}
            </span>
          )}
          {item.muted && <NavigationIcon name="muted" className={statusStyles.mutedMarker} />}
          {item.attention && item.attentionLabel && (
            <span
              className={styles.attentionBadge}
              data-attention={item.attention}
              title={item.attentionLabel}
            >
              {item.attentionLabel}
            </span>
          )}
        </button>
        {!item.attention && item.trailingHint && (
          <span className={styles.trailingHint}>{item.trailingHint}</span>
        )}
        <div className={styles.rowActions}>
          {item.actions}
        </div>
        {item.onTogglePin ? (
          <button
            type="button"
            className={`${styles.pinButton} ${item.pinned ? styles.pinButtonActive : ""}`}
            aria-label={item.pinLabel}
            aria-pressed={Boolean(item.pinned)}
            title={item.pinLabel}
            onClick={(event) => {
              event.stopPropagation();
              item.onTogglePin?.();
            }}
          >
            <NavigationIcon name="pin" />
          </button>
        ) : item.pinned ? (
          <NavigationIcon name="pin" className={styles.pinMarker} />
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.item} ${item.nested ? styles.itemNested : ""} ${item.active ? styles.itemActive : ""} ${item.control ? controlStyles.moreButton : ""}`}
      aria-current={item.active ? "page" : undefined}
      aria-expanded={item.expanded}
      title={nativeTitle}
      data-sidebar-item={item.id}
      data-sidebar-control={item.control ? "true" : undefined}
      onClick={item.onClick}
    >
      <StatusMarker item={item} />
      <RowIcon item={item} />
      {label}
      {item.muted && <NavigationIcon name="muted" className={statusStyles.mutedMarker} />}
      {item.pinned && <NavigationIcon name="pin" className={styles.pinMarker} />}
      {item.attention && item.attentionLabel && (
        <span
          className={styles.attentionBadge}
          data-attention={item.attention}
          title={item.attentionLabel}
        >
          {item.attentionLabel}
        </span>
      )}
    </button>
  );
}

/** 使用统一配置渲染侧栏分组、搜索和行项，折叠、移动与选择由调用方同步。 */
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
                  {group.leadingItems?.map((item) => (
                    <SidebarRow key={item.id} item={item} />
                  ))}
                  {group.items.length > 0 ? (
                    group.items.map((item) => (
                      <SidebarRow key={item.id} item={item} />
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
                  {group.trailingAction && (
                    <button
                      type="button"
                      className={createStyles.createRow}
                      onClick={group.trailingAction.onClick}
                    >
                      <NavigationIcon name={group.trailingAction.icon} />
                      <span className={styles.label}>{group.trailingAction.label}</span>
                    </button>
                  )}
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
