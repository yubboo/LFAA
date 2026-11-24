// 内置浏览器双引擎视口：Agent 控制态下以全透明防误触护盾锁定视口（零白雾），用户点「接管」后解锁原生直连或 2x 无损协同操作。
import { useEffect, useRef, useState, type RefObject } from "react";
import { IconHandStop, IconLock, IconWorld } from "@tabler/icons-react";
import type { BrowserSessionSnapshot } from "../api/browser-client";
import type { ViewportPreset } from "./BrowserToolbar";
import { BrowserCanvasViewport, type FrameDrawer } from "./BrowserCanvasViewport";
import type { EffectiveRenderMode } from "./browser-render-mode";
import styles from "./BrowserViewport.module.css";

const QUICK_PORTS = ["http://127.0.0.1:5174/", "http://127.0.0.1:3000/"];

function presetDimensions(preset: ViewportPreset): { width: number; height: number } | null {
  if (preset === "desktop") return { width: 1280, height: 800 };
  if (preset === "mobile") return { width: 390, height: 844 };
  return null;
}

export function BrowserViewport({
  sessionId,
  isZh,
  snap,
  preset,
  effectiveMode,
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
  preset: ViewportPreset;
  effectiveMode: EffectiveRenderMode;
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
  const fixedPreset = presetDimensions(preset);

  const hasPage = Boolean(snap?.active && snap.url && snap.url !== "about:blank");
  const lockedByAgent = hasPage && !userControl;

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

  // 桌面/手机预设在原生直连模式下按容器尺寸等比缩放，避免外层容器出现滚动条抢滚轮。
  useEffect(() => {
    const el = stageRef.current;
    if (!el || effectiveMode !== "native" || preset === "auto") return;
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
  }, [effectiveMode, preset, stageRef]);

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
    if (!fixedPreset) {
      return (
        <iframe
          key={`${snap.activeTabId}:${nativeReloadNonce}`}
          src={snap.url}
          title={snap.title || snap.url}
          className={styles.nativeFrame}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
          allow="clipboard-read; clipboard-write"
          referrerPolicy="no-referrer-when-downgrade"
        />
      );
    }
    const availW = Math.max(120, (stageBox?.width ?? fixedPreset.width) - 24);
    const availH = Math.max(120, (stageBox?.height ?? fixedPreset.height) - 24);
    const scale = Math.min(1, availW / fixedPreset.width, availH / fixedPreset.height);
    const scaledW = Math.round(fixedPreset.width * scale);
    const scaledH = Math.round(fixedPreset.height * scale);
    return (
      <div
        className={styles.deviceShell}
        data-preset={preset}
        style={{ width: `${scaledW}px`, height: `${scaledH}px` }}
      >
        <iframe
          key={`${snap.activeTabId}:${nativeReloadNonce}`}
          src={snap.url}
          title={snap.title || snap.url}
          className={styles.nativeFrameScaled}
          style={{
            width: `${fixedPreset.width}px`,
            height: `${fixedPreset.height}px`,
            transform: `scale(${scale})`,
          }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
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
      data-preset={preset}
      data-engine={hasPage ? effectiveMode : "empty"}
      data-locked={lockedByAgent ? "true" : undefined}
      aria-label={isZh ? "内置浏览器实时视口" : "Built-in browser viewport"}
    >
      {hasPage && snap ? (
        <>
          {effectiveMode === "native" ? (
            renderNativeFrame()
          ) : (
            <BrowserCanvasViewport
              sessionId={sessionId}
              isZh={isZh}
              snap={snap}
              preset={preset}
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
