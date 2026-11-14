/**
 * 功能：呈现输入框 `/` 命令和 `@` 应用/能力关联候选菜单。
 * 作用：消费聊天协调层投影的受控菜单状态，不解析草稿、不处理键盘或执行写入。
 * 关联文件：ui-chat/src/AiWorkChat.tsx、composer-trigger-menu.css。
 */
import type { AgentAssociations, ApplicationId } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon, type WorkbenchIconName } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import "./composer-trigger-menu.css";

export interface ComposerTriggerMenuState {
  trigger: "/" | "@";
  start: number;
  end: number;
  query: string;
}

export type ComposerTriggerMenuAssociation =
  | { kind: "application"; id: ApplicationId }
  | { kind: "capability"; id: string };

export interface ComposerTriggerMenuItem {
  id: string;
  group: string;
  label: string;
  description: string;
  icon: WorkbenchIconName;
  disabled?: boolean;
  insertText?: string;
  action?: "open-model-picker";
  association?: ComposerTriggerMenuAssociation;
  searchText?: string;
}

export interface ComposerTriggerMenuProps {
  menu: ComposerTriggerMenuState | null;
  maxHeight: number | null;
  items: readonly ComposerTriggerMenuItem[];
  groups: readonly string[];
  activeIndex: number;
  associations: AgentAssociations;
  capabilitiesError: string;
  onSelect: (item: ComposerTriggerMenuItem) => void;
}

export function ComposerTriggerMenu({
  menu,
  maxHeight,
  items,
  groups,
  activeIndex,
  associations,
  capabilitiesError,
  onSelect
}: ComposerTriggerMenuProps) {
  if (!menu) return null;

  return (
    <div
      className="ai-work-chat__composer-menu"
      data-trigger={menu.trigger}
      style={maxHeight === null ? undefined : { maxHeight: `${maxHeight}px` }}
      onMouseDown={event => event.preventDefault()}
    >
      <div className="ai-work-chat__composer-menu-heading">
        <strong>{menu.trigger === "/" ? "命令" : "关联到本次对话"}</strong>
        <span>↑↓ 选择 · Enter 确认 · Esc 关闭</span>
      </div>
      <div
        id="ai-work-chat-composer-menu"
        className="ai-work-chat__composer-menu-list"
        role="listbox"
        aria-label={menu.trigger === "/" ? "可用聊天命令" : "可关联的应用和能力"}
      >
        {groups.map(group => <div className="ai-work-chat__composer-menu-group" key={group} role="group" aria-label={group}>
          <span className="ai-work-chat__composer-menu-group-label" role="presentation">{group}</span>
          {items.filter(item => item.group === group).map(item => {
            const index = items.indexOf(item);
            const isAssociated = item.association?.kind === "application"
              ? associations.applicationIds.includes(item.association.id)
              : item.association?.kind === "capability" && associations.capabilityIds.includes(item.association.id);
            return <button
              id={`ai-work-chat-composer-option-${encodeURIComponent(item.id)}`}
              className="ai-work-chat__composer-menu-option"
              type="button"
              role="option"
              key={item.id}
              aria-selected={index === activeIndex}
              aria-disabled={item.disabled || undefined}
              data-associated={isAssociated || undefined}
              disabled={item.disabled}
              onClick={() => onSelect(item)}
            >
              <WorkbenchIcon className="ai-work-chat__composer-menu-option-icon" name={item.icon} size={18} />
              <span className="ai-work-chat__composer-menu-option-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
              {isAssociated ? <span className="ai-work-chat__composer-menu-associated">已关联</span> : null}
            </button>;
          })}
        </div>)}
        {!items.length ? <div className="ai-work-chat__composer-menu-empty" role="status">{menu.trigger === "@" && capabilitiesError ? `能力目录读取失败：${capabilitiesError}` : "没有匹配项"}</div> : null}
      </div>
    </div>
  );
}
