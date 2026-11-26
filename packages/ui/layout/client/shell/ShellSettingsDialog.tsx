// 设置中心弹窗宿主：以覆盖层形式盖在当前工作区之上，关闭即回到打开前的视图。
import type { ReactNode } from "react";
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
  if (!open) return null;
  return (
    <SettingsDialog
      locale={locale}
      activeView={activeView}
      renderContent={renderContent}
      onNavigate={onNavigate}
      onClose={onClose}
    />
  );
}