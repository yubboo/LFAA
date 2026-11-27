// 设置中心弹窗宿主：以覆盖层形式盖在当前工作区之上，关闭时保留 150ms 平滑退场后卸载。
import { useRef, type ReactNode } from "react";
import { usePanePresence } from "@lfaa/ui-primitives/client";
import type { LocaleMessages } from "../locales";
import type { NavigationView } from "../navigation/navigation";
import { SettingsDialog } from "../panels/SettingsDialog";

export function ShellSettingsDialog({
  open,
  locale,
  activeView,
  renderContent,
  onNavigate,
  onClose,
}: {
  open: boolean;
  locale: LocaleMessages;
  activeView: string;
  renderContent: () => ReactNode;
  onNavigate: (view: NavigationView) => void;
  onClose: () => void;
}) {
  const mounted = usePanePresence(open, 160);
  // 退场期间 activeView 已切回背景路由，沿用关闭前最后一个设置子页与内容，避免退场帧变空白。
  const lastViewRef = useRef(activeView);
  const lastContentRef = useRef<ReactNode>(null);
  if (open) {
    lastViewRef.current = activeView;
    lastContentRef.current = renderContent();
  }

  if (!mounted) return null;

  return (
    <SettingsDialog
      open={open}
      locale={locale}
      activeView={open ? activeView : lastViewRef.current}
      renderContent={() => (open ? lastContentRef.current : lastContentRef.current)}
      onNavigate={onNavigate}
      onClose={onClose}
    />
  );
}
