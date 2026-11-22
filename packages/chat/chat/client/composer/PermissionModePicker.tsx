// 渲染输入栏底部的三种 Agent 权限模式切换器（请求批准 / 帮我审批 / 完全访问权限）及说明弹层。
import { useEffect, useRef, useState } from "react";
import { HoverTip } from "@lfaa/ui-primitives/client";
import {
  IconCheck,
  IconHandStop,
  IconShieldExclamation,
  IconTerminal2,
} from "@tabler/icons-react";
import type { AgentPermissionMode } from "../store/chat-types";
import type { ChatLocaleMessages } from "../locales";
import styles from "./PermissionModePicker.module.css";

/** 显示当前 Agent 工具权限模式和选项说明，由聊天 Store 持久化选择。 */
export function PermissionModePicker({
  locale,
  mode,
  onSelectMode,
}: {
  locale: ChatLocaleMessages;
  mode: AgentPermissionMode;
  onSelectMode: (mode: AgentPermissionMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showLearnMore, setShowLearnMore] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const options: Array<{
    id: AgentPermissionMode;
    title: string;
    desc: string;
    icon: typeof IconHandStop;
    isDanger?: boolean;
  }> = [
    {
      id: "ask",
      title: locale.permissionAskLabel,
      desc: locale.permissionAskDesc,
      icon: IconHandStop,
    },
    {
      id: "smart",
      title: locale.permissionSmartLabel,
      desc: locale.permissionSmartDesc,
      icon: IconTerminal2,
    },
    {
      id: "full",
      title: locale.permissionFullLabel,
      desc: locale.permissionFullDesc,
      icon: IconShieldExclamation,
      isDanger: true,
    },
  ];

  const activeTriggerIcon = mode === "full"
    ? IconShieldExclamation
    : mode === "smart"
      ? IconTerminal2
      : IconHandStop;
  const ActiveIcon = activeTriggerIcon;

  const activeTriggerText = mode === "full"
    ? locale.permissionFullShort
    : mode === "smart"
      ? locale.permissionSmartLabel
      : locale.permissionAskLabel;

  return (
    <div ref={rootRef} className={styles.root}>
      <HoverTip label={locale.isZh ? "更改权限" : "Change permission"} disabled={open}>
        <button
          type="button"
          className={`${styles.trigger} ${mode === "full" ? styles.triggerFull : mode === "smart" ? styles.triggerSmart : ""} ${open ? styles.triggerOpen : ""}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={locale.permissionLabel}
          aria-description={activeTriggerText}
          onClick={() => setOpen((prev) => !prev)}
        >
          <ActiveIcon size={14} aria-hidden="true" />
          <span className={styles.triggerLabel}>{activeTriggerText}</span>
        </button>
      </HoverTip>

      {open && (
        <div className={styles.popover} role="dialog" aria-label={locale.permissionPromptTitle}>
          <div className={styles.header}>
            <span className={styles.headerTitle}>{locale.permissionPromptTitle}</span>
            <button
              type="button"
              className={styles.learnMoreBtn}
              aria-expanded={showLearnMore}
              onClick={() => setShowLearnMore((prev) => !prev)}
            >
              {locale.learnMore}
            </button>
          </div>

          {showLearnMore && (
            <p className={styles.learnMoreBox}>{locale.permissionLearnMoreText}</p>
          )}

          {options.map((opt) => {
            const Icon = opt.icon;
            const isActive = opt.id === mode;
            return (
              <button
                key={opt.id}
                type="button"
                className={`${styles.option} ${isActive ? styles.optionActive : ""} ${opt.isDanger ? styles.optionFull : ""}`}
                onClick={() => {
                  onSelectMode(opt.id);
                  setOpen(false);
                }}
              >
                <span className={styles.optionIcon}>
                  <Icon size={16} aria-hidden="true" />
                </span>
                <span className={styles.optionBody}>
                  <span className={styles.optionTitle}>{opt.title}</span>
                  <span className={styles.optionDesc}>{opt.desc}</span>
                </span>
                {isActive && <IconCheck size={15} className={styles.optionCheck} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
