import type { ReactNode } from "react";
import type { UiMotionEffect } from "lfaa-util-values/src/settings-contract.js";
import { WorkbenchIcon } from "./WorkbenchIcon.js";
import "./NotificationToast.css";

export interface NotificationToastProps {
  title: ReactNode;
  description: ReactNode;
  actionLabel?: ReactNode;
  actionAriaLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  tone?: "neutral" | "issue";
  role?: "status" | "alert";
  ariaLive?: "off" | "polite" | "assertive";
  ariaAtomic?: boolean;
  ariaLabel?: string;
  effect?: UiMotionEffect;
  countdown?: ReactNode;
  closeLabel: string;
  onClose: () => void;
}

export function NotificationToast({
  title,
  description,
  actionLabel,
  actionAriaLabel,
  onAction,
  icon,
  tone = "neutral",
  role = "status",
  ariaLive = "polite",
  ariaAtomic,
  ariaLabel,
  effect,
  countdown,
  closeLabel,
  onClose
}: NotificationToastProps) {
  const content = <>
    {icon ? <span className="lfaa-notification-toast__icon" aria-hidden="true">{icon}</span> : null}
    <span className="lfaa-notification-toast__copy">
      <strong>{title}</strong>
      <span>{description}</span>
      {actionLabel !== undefined ? <small>{actionLabel}</small> : null}
    </span>
  </>;

  return <aside
    className="lfaa-notification-toast"
    data-toast-effect={effect}
    data-toast-tone={tone}
    role={role}
    aria-live={ariaLive}
    aria-atomic={ariaAtomic}
    aria-label={ariaLabel}
  >
    <div className="lfaa-notification-toast__main">
      {onAction ? <button className="lfaa-notification-toast__open" type="button" onClick={onAction} aria-label={actionAriaLabel}>{content}</button>
        : <div className="lfaa-notification-toast__plain">{content}</div>}
    </div>
    <button className="lfaa-notification-toast__close" type="button" onClick={onClose} aria-label={closeLabel}>
      <WorkbenchIcon name="close" size={14} />
    </button>
    {countdown !== undefined ? <div className="lfaa-notification-toast__countdown" aria-hidden="true">{countdown}</div> : null}
  </aside>;
}
