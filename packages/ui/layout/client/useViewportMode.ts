// 监听桌面、平板与手机断点，供四栏 Shell 切换侧栏抽屉与移动底栏模式。
import { useEffect, useState } from "react";

export type ViewportDevice = "desktop" | "tablet" | "mobile";

export interface ViewportMode {
  device: ViewportDevice;
  isCompact: boolean;
  isMobile: boolean;
}

const COMPACT_QUERY = "(max-width: 1023px)";
const MOBILE_QUERY = "(max-width: 767px)";

function readViewportMode(): ViewportMode {
  if (typeof window === "undefined") {
    return { device: "desktop", isCompact: false, isMobile: false };
  }
  const isMobile = window.matchMedia(MOBILE_QUERY).matches;
  const isCompact = window.matchMedia(COMPACT_QUERY).matches;
  const device: ViewportDevice = isMobile ? "mobile" : isCompact ? "tablet" : "desktop";
  return { device, isCompact, isMobile };
}

// 实时响应窗口与设备方向变化，避免同一状态跨断点产生挤压或溢出。
export function useViewportMode(): ViewportMode {
  const [mode, setMode] = useState<ViewportMode>(readViewportMode);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const compactMedia = window.matchMedia(COMPACT_QUERY);
    const mobileMedia = window.matchMedia(MOBILE_QUERY);
    const sync = () => setMode(readViewportMode());
    sync();
    compactMedia.addEventListener("change", sync);
    mobileMedia.addEventListener("change", sync);
    return () => {
      compactMedia.removeEventListener("change", sync);
      mobileMedia.removeEventListener("change", sync);
    };
  }, []);

  return mode;
}
