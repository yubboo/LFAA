// 内置浏览器工具栏：前进/后退/刷新、网址输入、视口预设、DevTools 开关与人工接管/附带页面操作。
import type { FormEvent, RefObject } from "react";
import {
  IconArrowLeft,
  IconArrowRight,
  IconDeviceDesktop,
  IconDeviceMobile,
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

export type ViewportPreset = "auto" | "desktop" | "mobile";

export function BrowserToolbar({
  isZh,
  snap,
  navigating,
  urlInput,
  urlInputRef,
  preset,
  onSelectPreset,
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
  preset: ViewportPreset;
  onSelectPreset: (preset: ViewportPreset) => void;
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
  return (
    <div className={styles.toolbar}>
      <div className={styles.navButtons}>
        <button
          type="button"
          className={styles.navBtn}
          disabled={navigating || !snap?.canGoBack}
          title={isZh ? "后退" : "Back"}
          aria-label={isZh ? "后退" : "Back"}
          onClick={() => onNavControl("back")}
        >
          <IconArrowLeft size={14} />
        </button>
        <button
          type="button"
          className={styles.navBtn}
          disabled={navigating || !snap?.canGoForward}
          title={isZh ? "前进" : "Forward"}
          aria-label={isZh ? "前进" : "Forward"}
          onClick={() => onNavControl("forward")}
        >
          <IconArrowRight size={14} />
        </button>
        <button
          type="button"
          className={styles.navBtn}
          disabled={navigating || !snap?.active}
          title={isZh ? "刷新" : "Reload"}
          aria-label={isZh ? "刷新" : "Reload"}
          onClick={() => onNavControl("reload")}
        >
          <IconRefresh size={14} />
        </button>
      </div>

      <form className={styles.urlForm} onSubmit={onNavigate}>
        <IconShieldCheck size={13} className={styles.urlIcon} aria-hidden="true" />
        <input
          ref={urlInputRef}
          className={styles.urlInput}
          value={urlInput}
          placeholder="http://127.0.0.1:5173/"
          aria-label={isZh ? "网址输入框" : "Browser URL"}
          onFocus={onUrlFocus}
          onBlur={onUrlBlur}
          onChange={(e) => onUrlChange(e.target.value)}
        />
        {navigating && <span className={styles.loadingHint}>{isZh ? "加载中…" : "Loading"}</span>}
      </form>

      <div className={styles.toolGroup}>
        <button
          type="button"
          className={`${styles.navBtn} ${preset === "auto" ? styles.navBtnActive : ""}`}
          title={isZh ? "视口自适应面板宽高" : "Responsive viewport"}
          onClick={() => onSelectPreset("auto")}
        >
          <IconLayoutColumns size={14} />
        </button>
        <button
          type="button"
          className={`${styles.navBtn} ${preset === "desktop" ? styles.navBtnActive : ""}`}
          title={isZh ? "桌面视口 (1280×800)" : "Desktop viewport"}
          onClick={() => onSelectPreset("desktop")}
        >
          <IconDeviceDesktop size={14} />
        </button>
        <button
          type="button"
          className={`${styles.navBtn} ${preset === "mobile" ? styles.navBtnActive : ""}`}
          title={isZh ? "手机视口 (390×844)" : "Mobile viewport"}
          onClick={() => onSelectPreset("mobile")}
        >
          <IconDeviceMobile size={14} />
        </button>
        <button
          type="button"
          className={`${styles.navBtn} ${devtoolsOpen ? styles.navBtnActive : ""}`}
          title={isZh ? "控制台与网络检查" : "Console & Network"}
          onClick={onToggleDevtools}
        >
          <IconTerminal2 size={14} />
          {(snap?.errorCount ?? 0) > 0 && <span className={styles.badgeDot} />}
        </button>
        <button
          type="button"
          className={`${styles.pillBtn} ${snap?.takeoverPaused ? styles.pillBtnActive : ""}`}
          disabled={!snap?.active}
          title={isZh ? "开启后暂停 Agent 自动操作，改为人工接管" : "Toggle human takeover"}
          onClick={() => onToggleTakeover(!snap?.takeoverPaused)}
        >
          {snap?.takeoverPaused ? <IconPlayerPlay size={13} /> : <IconHandStop size={13} />}
          <span>{snap?.takeoverPaused ? (isZh ? "恢复" : "Resume") : (isZh ? "接管" : "Takeover")}</span>
        </button>
        <button
          type="button"
          className={styles.navBtn}
          title={isZh ? "弹出桌面有头 Edge 窗口人工操作" : "Open visible desktop browser"}
          onClick={() => onToggleTakeover(true, true)}
        >
          <IconExternalLink size={14} />
        </button>
        {onAttachPage && snap?.active && (
          <button
            type="button"
            className={styles.navBtn}
            title={isZh ? "附带当前页面到对话" : "Attach page to chat"}
            onClick={() => onAttachPage(snap)}
          >
            <IconMessagePlus size={14} />
          </button>
        )}
      </div>
    </div>
  );
}