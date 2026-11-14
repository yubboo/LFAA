/**
 * 功能：呈现账户设置的受控分类标签。
 * 作用：提供一致的键盘导航、ARIA 语义和窄宽度横向滚动；当前分类与切换动作由调用方持有。
 * 关联文件：packages/client/ui-settings/src/SettingsPage.tsx、account-settings-tabs.css。
 */
import "./account-settings-tabs.css";

export interface AccountSettingsTab<T extends string> {
  id: T;
  label: string;
}

export function AccountSettingsTabs<T extends string>({
  activeSection,
  onSelect,
  tabs
}: {
  activeSection: T;
  onSelect: (section: T) => void;
  tabs: readonly AccountSettingsTab<T>[];
}) {
  return (
    <div className="settings-account-tabs" role="tablist" aria-label="账号设置分类" onKeyDown={(event) => {
      const tabElements = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]"));
      if (tabElements.length === 0) return;
      const currentIndex = tabElements.indexOf(event.target as HTMLButtonElement);
      const nextIndex = event.key === "ArrowRight" ? (currentIndex + 1) % tabElements.length
        : event.key === "ArrowLeft" ? (currentIndex - 1 + tabElements.length) % tabElements.length
          : event.key === "Home" ? 0 : event.key === "End" ? tabElements.length - 1 : -1;
      if (currentIndex >= 0 && nextIndex >= 0) {
        event.preventDefault();
        tabElements[nextIndex]?.focus();
        tabElements[nextIndex]?.click();
      }
    }}>
      {tabs.map((tab) => <button
        key={tab.id}
        id={`settings-account-tab-${tab.id}`}
        type="button"
        role="tab"
        tabIndex={activeSection === tab.id ? 0 : -1}
        aria-selected={activeSection === tab.id}
        aria-controls="settings-account-panel"
        className={activeSection === tab.id ? "is-active" : ""}
        onClick={() => onSelect(tab.id)}
      >{tab.label}</button>)}
    </div>
  );
}
