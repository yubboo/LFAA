// 内置浏览器双引擎视口：保留原生预览，Agent 控制和人工接管时展示宿主协同画面。
import { useEffect, useRef, useState, type RefObject } from "react";
import { IconHandStop, IconLock, IconWorld } from "@tabler/icons-react";
import type { BrowserSessionSnapshot } from "../api/browser-client";
import { getDesktopBrowserBridge } from "../api/desktop-browser-bridge";
import { BrowserCanvasViewport, type FrameDrawer } from "./BrowserCanvasViewport";
import type { EffectiveRenderMode } from "./browser-render-mode";
import styles from "./BrowserViewport.module.css";

const QUICK_PORTS = ["http://127.0.0.1:5174/", "http://127.0.0.1:3000/"];

export function BrowserViewport({
  sessionId,
  isZh,
  snap,
  customViewport,
  effectiveMode,
  browserAutomationActive = false,
  browserActivity,
  userControl,
  nativeReloadNonce,
  stageRef,
  frameDrawerRef,
  onOpenUrl,
  onRequestTakeover,
}: {
  sessionId: string;
  isZh: boolean;
  snap: BrowserSessionSnapshot | null;
  /** 打开响应式设备工具栏时传入固定尺寸；为 null 时铺满右侧视口（零黑边）。 */
  customViewport: { width: number; height: number } | null;
  effectiveMode: EffectiveRenderMode;
  browserAutomationActive?: boolean | undefined;
  browserActivity?: string | undefined;
  /** 仅用户手动点击「接管」后为 true；默认 false 表示由 Agent 控制，视口锁定防误触。 */
  userControl: boolean;
  nativeReloadNonce: number;
  stageRef: RefObject<HTMLDivElement | null>;
  frameDrawerRef: RefObject<FrameDrawer | null>;
  onOpenUrl: (url: string) => void;
  onRequestTakeover: () => void;
}) {
  const [stageBox, setStageBox] = useState<{ width: number; height: number } | null>(null);
  const [lockHintVisible, setLockHintVisible] = useState(false);
  const shieldRef = useRef<HTMLDivElement>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewMode = customViewport ? "device" : "fill";

  const hasPage = Boolean(snap?.active && snap.url && snap.url !== "about:blank");
  const desktopBridge = getDesktopBrowserBridge();
  const [desktopDownloads, setDesktopDownloads] = useState(false);
  useEffect(() => {
    let active = true;
    void desktopBridge?.supportsManagedDownloads?.()
      .then((supported) => { if (active) setDesktopDownloads(supported); })
      .catch(() => { if (active) setDesktopDownloads(false); });
    return () => { active = false; };
  }, [desktopBridge]);
  // 桌面端非 Agent 实操阶段直接使用 Electron 原生 WebContentsView（GPU 硬件合成 60/120fps，零截图压缩延迟）。
  const useDesktopNativeView = Boolean(
    desktopBridge
    && desktopDownloads
    && hasPage
    && !userControl
    && !browserAutomationActive
    && snap?.url
    && /^https?:\/\//iu.test(snap.url),
  );
  const lockedByAgent = hasPage && !userControl && !useDesktopNativeView;

  // 同步 Electron 原生 WebContentsView 坐标与尺寸；出现弹窗/菜单或切走时自动隐藏避免遮挡 UI。
  useEffect(() => {
    if (!desktopBridge) return;
    if (!useDesktopNativeView || !snap?.url) {
      void desktopBridge.syncBounds({ visible: false, x: 0, y: 0, width: 0, height: 0 }).catch(() => {});
      return;
    }
    const el = stageRef.current;
    if (!el) return;
    const sync = () => {
      const covered = Boolean(el.closest("[data-covered='true']"))
        || Boolean(document.querySelector('[role="dialog"], [role="menu"]'));
      const rect = el.getBoundingClientRect();
      if (covered || rect.width < 40 || rect.height < 40 || document.visibilityState === "hidden") {
        void desktopBridge.syncBounds({ visible: false, x: 0, y: 0, width: 0, height: 0 }).catch(() => {});
        return;
      }
      if (!customViewport) {
        void desktopBridge.syncBounds({
          visible: true,
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          url: snap.url,
          sessionId,
          zoomFactor: 1,
        }).catch(() => {});
        return;
      }
      const availW = Math.max(120, rect.width - 24);
      const availH = Math.max(120, rect.height - 24);
      const scale = Math.min(1, availW / customViewport.width, availH / customViewport.height);
      const boxW = Math.round(customViewport.width * scale);
      const boxH = Math.round(customViewport.height * scale);
      const boxX = rect.left + Math.round((rect.width - boxW) / 2);
      const boxY = rect.top + Math.round((rect.height - boxH) / 2);
      void desktopBridge.syncBounds({
        visible: true,
        x: boxX,
        y: boxY,
        width: boxW,
        height: boxH,
        url: snap.url,
        sessionId,
        zoomFactor: scale,
      }).catch(() => {});
    };
    sync();
    const resizeObs = typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    resizeObs?.observe(el);
    const domObs = typeof MutationObserver !== "undefined" ? new MutationObserver(sync) : null;
    domObs?.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-covered", "role"] });
    window.addEventListener("resize", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      resizeObs?.disconnect();
      domObs?.disconnect();
      window.removeEventListener("resize", sync);
      document.removeEventListener("visibilitychange", sync);
      void desktopBridge.syncBounds({ visible: false, x: 0, y: 0, width: 0, height: 0 }).catch(() => {});
    };
  }, [customViewport, desktopBridge, sessionId, snap?.url, stageRef, useDesktopNativeView]);

  // 解锁后立即收起锁定提示胶囊。
  useEffect(() => {
    if (!lockedByAgent) {
      setLockHintVisible(false);
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
        hintTimerRef.current = null;
      }
    }
  }, [lockedByAgent]);

  useEffect(() => () => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
  }, []);

  // Agent 控制态下在透明护盾上拦截非被动 wheel，既阻断误触滚动远端，也杜绝外层工作区穿透滚动。
  useEffect(() => {
    const shield = shieldRef.current;
    if (!shield || !lockedByAgent) return;
    const blockWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    shield.addEventListener("wheel", blockWheel, { passive: false });
    return () => shield.removeEventListener("wheel", blockWheel);
  }, [lockedByAgent]);

  // 设备工具栏开启时按容器尺寸等比缩放原生 iframe，避免外层出现滚动条抢滚轮。
  useEffect(() => {
    const el = stageRef.current;
    if (!el || effectiveMode !== "native" || !customViewport) return;
    const sync = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageBox((prev) => (
          prev && Math.abs(prev.width - rect.width) < 2 && Math.abs(prev.height - rect.height) < 2
            ? prev
            : { width: rect.width, height: rect.height }
        ));
      }
    };
    sync();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [customViewport, effectiveMode, stageRef]);

  const showLockHint = () => {
    setLockHintVisible(true);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => {
      hintTimerRef.current = null;
      setLockHintVisible(false);
    }, 2800);
  };

  const renderNativeFrame = () => {
    if (!snap) return null;
    if (!customViewport) {
      return (
        <iframe
          key={`${snap.activeTabId}:${nativeReloadNonce}`}
          src={snap.url}
          title={snap.title || snap.url}
          className={styles.nativeFrame}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          allow="clipboard-read; clipboard-write"
          referrerPolicy="no-referrer-when-downgrade"
        />
      );
    }
    const availW = Math.max(120, (stageBox?.width ?? customViewport.width) - 24);
    const availH = Math.max(120, (stageBox?.height ?? customViewport.height) - 24);
    const scale = Math.min(1, availW / customViewport.width, availH / customViewport.height);
    const scaledW = Math.round(customViewport.width * scale);
    const scaledH = Math.round(customViewport.height * scale);
    return (
      <div
        className={styles.deviceShell}
        data-mode={viewMode}
        style={{ width: `${scaledW}px`, height: `${scaledH}px` }}
      >
        <iframe
          key={`${snap.activeTabId}:${nativeReloadNonce}`}
          src={snap.url}
          title={snap.title || snap.url}
          className={styles.nativeFrameScaled}
          style={{
            width: `${customViewport.width}px`,
            height: `${customViewport.height}px`,
            transform: `scale(${scale})`,
          }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          allow="clipboard-read; clipboard-write"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    );
  };

  return (
    <div
      ref={stageRef}
      className={styles.viewportStage}
      data-mode={viewMode}
      data-engine={hasPage ? effectiveMode : "empty"}
      data-locked={lockedByAgent ? "true" : undefined}
      aria-label={isZh ? "内置浏览器实时视口" : "Built-in browser viewport"}
    >
      {hasPage && snap ? (
        <>
          {useDesktopNativeView ? null : effectiveMode === "native" ? (
            renderNativeFrame()
          ) : (
            <BrowserCanvasViewport
              sessionId={sessionId}
              isZh={isZh}
              snap={snap}
              viewMode={viewMode}
              interactive={userControl}
              stageRef={stageRef}
              frameDrawerRef={frameDrawerRef}
            />
          )}
          {lockedByAgent && (
            <div
              ref={shieldRef}
              className={styles.agentLockShield}
              role="presentation"
              aria-label={isZh ? "当前由 Agent 控制，防误触已锁定" : "Controlled by Agent; interaction locked"}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                showLockHint();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                showLockHint();
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                showLockHint();
              }}
            />
          )}
          {effectiveMode === "native" && !useDesktopNativeView && !lockHintVisible && (
            <button type="button" className={styles.downloadTakeover} onClick={onRequestTakeover}>
              {isZh ? "接管后下载" : "Take over to download"}
            </button>
          )}
          {browserActivity && lockedByAgent && (
            <div className={styles.agentStatusDock} role="status" title={browserActivity}>
              <span className={styles.thinkingDots} aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className={styles.agentStatusPill}>{browserActivity}</span>
            </div>
          )}
          {lockedByAgent && lockHintVisible && (
            <div className={styles.lockToast} role="status">
              <IconLock size={13} aria-hidden="true" />
              <span>
                {isZh ? "当前由 Agent 控制（防误触已锁定）" : "Controlled by Agent (interaction locked)"}
              </span>
              <button
                type="button"
                className={styles.lockToastBtn}
                onClick={() => onRequestTakeover()}
              >
                <IconHandStop size={12} aria-hidden="true" />
                <span>{isZh ? "立即接管" : "Take Over"}</span>
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyStage}>
          <IconWorld size={34} stroke={1.4} aria-hidden="true" />
          <h4>{isZh ? "内置浏览器已就绪" : "Built-in Browser Ready"}</h4>
          <p>
            {isZh
              ? "默认由小鱼 Agent 控制并锁定防误触；如需亲自浏览或操作，点击上方「接管」即可自由控制并同步通知 Agent。"
              : "Controlled by Agent by default to prevent accidental touches. Click Takeover above to control manually and notify the Agent."}
          </p>
          <div className={styles.quickLinks}>
            {QUICK_PORTS.map((u) => (
              <button key={u} type="button" className={styles.quickBtn} onClick={() => onOpenUrl(u)}>
                {u}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
