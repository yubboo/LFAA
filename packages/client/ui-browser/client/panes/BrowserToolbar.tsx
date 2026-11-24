// 内置浏览器工具栏：精简为导航、地址栏、接管开关与「更多（...）」菜单（基于 @lfaa/ui-primitives 的 Base UI DropdownMenu）。
import type { FormEvent, RefObject } from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@lfaa/ui-primitives/client";
import {
  IconArrowLeft,
  IconArrowRight,
  IconDeviceDesktop,
  IconDots,
  IconExternalLink,
  IconHandStop,
  IconLayoutColumns,
  IconMessagePlus,
  IconPlayerPlay,
  IconRefresh,
  IconShieldCheck,
  IconTerminal2,
} from "@tabler/icons-react";
import type { BrowserSessionSnapshot } from "../api/browser-client";
import styles from "./RightBrowserPane.module.css";

export function BrowserToolbar({
  isZh,
  snap,
  navigating,
  urlInput,
  urlInputRef,
  deviceBarOpen,
  onToggleDeviceBar,
  onResetFullFill,
  userControl,
  devtoolsOpen,
  onToggleDevtools,
  onNavigate,
  onUrlFocus,
  onUrlBlur,
  onUrlChange,
  onNavControl,
  onToggleTakeover,
  onAttachPage,
}: {
  isZh: boolean;
  snap: BrowserSessionSnapshot | null;
  navigating: boolean;
  urlInput: string;
  urlInputRef: RefObject<HTMLInputElement | null>;
  deviceBarOpen: boolean;
  onToggleDeviceBar: () => void;
  onResetFullFill: () => void;
  /** 仅用户手动点击「接管」后才解锁地址栏与导航控制，防止误触打断 Agent。 */
  userControl: boolean;
  devtoolsOpen: boolean;
  onToggleDevtools: () => void;
  onNavigate: (event: FormEvent) => void;
  onUrlFocus: () => void;
  onUrlBlur: () => void;
  onUrlChange: (value: string) => void;
  onNavControl: (action: "back" | "forward" | "reload") => void;
  onToggleTakeover: (paused: boolean, headed?: boolean) => void;
  onAttachPage?: ((snap: BrowserSessionSnapshot) => void) | undefined;
}) {
  const hasPage = Boolean(snap?.active && snap.url && snap.url !== "about:blank");
  const navLocked = hasPage && !userControl;
  const lockedHint = isZh ? "当前由 Agent 控制，请先点击「接管」再手动操作" : "Controlled by Agent — click Takeover to operate";

  return (
    <div className={styles.toolbar}>
      <div className={styles.navButtons}>
        <button
          type="button"
          className={styles.navBtn}
          disabled={navigating || navLocked || !snap?.canGoBack}
          title={navLocked ? lockedHint : (isZh ? "后退" : "Back")}
          aria-label={isZh ? "后退" : "Back"}
          onClick={() => onNavControl("back")}
        >
          <IconArrowLeft size={14} />
        </button>
        <button
          type="button"
          className={styles.navBtn}
          disabled={navigating || navLocked || !snap?.canGoForward}
          title={navLocked ? lockedHint : (isZh ? "前进" : "Forward")}
          aria-label={isZh ? "前进" : "Forward"}
          onClick={() => onNavControl("forward")}
        >
          <IconArrowRight size={14} />
        </button>
        <button
          type="button"
          className={styles.navBtn}
          disabled={navigating || navLocked || !snap?.active}
          title={navLocked ? lockedHint : (isZh ? "刷新" : "Reload")}
          aria-label={isZh ? "刷新" : "Reload"}
          onClick={() => onNavControl("reload")}
        >
          <IconRefresh size={14} />
        </button>
      </div>

      <form
        className={styles.urlForm}
        data-locked={navLocked ? "true" : undefined}
        onSubmit={(event) => {
          if (navLocked) {
            event.preventDefault();
            return;
          }
          onNavigate(event);
        }}
      >
        <IconShieldCheck size={13} className={styles.urlIcon} aria-hidden="true" />
        <input
          ref={urlInputRef}
          className={styles.urlInput}
          value={urlInput}
          readOnly={navLocked}
          title={navLocked ? lockedHint : undefined}
          placeholder="http://127.0.0.1:5174/"
          aria-label={isZh ? "网址输入框" : "Browser URL"}
          onFocus={onUrlFocus}
          onBlur={onUrlBlur}
          onChange={(e) => {
            if (!navLocked) onUrlChange(e.target.value);
          }}
        />
        {navigating && <span className={styles.loadingHint}>{isZh ? "加载中…" : "Loading"}</span>}
      </form>

      <div className={styles.toolGroup}>
        <button
          type="button"
          className={`${styles.pillBtn} ${snap?.takeoverPaused ? styles.pillBtnActive : ""}`}
          disabled={!snap?.active}
          title={snap?.takeoverPaused
            ? (isZh ? "结束人工接管，恢复 Agent 自动协同" : "Resume Agent control")
            : (isZh ? "暂停 Agent 浏览器动作，由你亲自操作当前页面" : "Pause Agent and take over manually")}
          onClick={() => onToggleTakeover(!snap?.takeoverPaused)}
        >
          {snap?.takeoverPaused ? <IconPlayerPlay size={13} /> : <IconHandStop size={13} />}
          <span>{snap?.takeoverPaused ? (isZh ? "交还" : "Resume") : (isZh ? "接管" : "Takeover")}</span>
        </button>

        <DropdownMenu
          align="end"
          side="bottom"
          sideOffset={6}
          trigger={
            <button
              type="button"
              className={`${styles.navBtn} ${deviceBarOpen ? styles.navBtnActive : ""}`}
              title={isZh ? "更多浏览器选项" : "More browser options"}
              aria-label={isZh ? "更多浏览器选项" : "More browser options"}
            >
              <IconDots size={15} />
              {(snap?.errorCount ?? 0) > 0 && <span className={styles.badgeDot} />}
            </button>
          }
        >
          <DropdownMenuCheckboxItem
            icon={<IconLayoutColumns size={14} />}
            label={isZh ? "设备工具栏（响应式）" : "Device toolbar (Responsive)"}
            checked={deviceBarOpen}
            onCheckedChange={() => onToggleDeviceBar()}
          />
          <DropdownMenuCheckboxItem
            icon={<IconDeviceDesktop size={14} />}
            label={isZh ? "电脑铺满显示" : "Fill viewport"}
            checked={!deviceBarOpen}
            onCheckedChange={() => onResetFullFill()}
          />
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            icon={<IconTerminal2 size={14} />}
            label={`${isZh ? "控制台与网络" : "Console & Network"}${(snap?.errorCount ?? 0) > 0 ? ` (${snap?.errorCount})` : ""}`}
            checked={devtoolsOpen}
            onCheckedChange={() => onToggleDevtools()}
          />
          {snap?.url && /^https?:\/\//iu.test(snap.url) && (
            <DropdownMenuItem
              icon={<IconExternalLink size={14} />}
              label={isZh ? "在新窗口打开" : "Open in new window"}
              onClick={() => window.open(snap.url, "_blank", "noopener,noreferrer")}
            />
          )}
          {snap?.active && onAttachPage && (
            <DropdownMenuItem
              icon={<IconMessagePlus size={14} />}
              label={isZh ? "附带当前页面到对话" : "Attach page to chat"}
              onClick={() => onAttachPage(snap)}
            />
          )}
        </DropdownMenu>
      </div>
    </div>
  );
}
