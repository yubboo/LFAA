// 将设置中心目录映射为通用 SidebarSectionList 配置，复用同一套左二菜单栏组件与样式。
import { useMemo, useState } from "react";
import type { LocaleMessages } from "../locales";
import type { NavigationView } from "../navigation";
import { SETTINGS_CATALOG } from "../settings-catalog";
import { SidebarSectionList, type SidebarGroupConfig } from "./SidebarSectionList";

export function SettingsMenu({
  locale,
  activeView,
  onNavigate,
}: {
  locale: LocaleMessages;
  activeView: NavigationView;
  onNavigate: (view: NavigationView) => void;
}) {
  const [query, setQuery] = useState("");
  const isZh = locale.settings === "设置";
  const normalizedQuery = query.trim().toLowerCase();

  const groups = useMemo<SidebarGroupConfig[]>(() => {
    return SETTINGS_CATALOG
      .map((group) => {
        const items = group.items
          .filter((item) => {
            if (!normalizedQuery) return true;
            const label = (isZh ? item.labelZh : item.labelEn).toLowerCase();
            return label.includes(normalizedQuery);
          })
          .map((item) => {
            const label = isZh ? item.labelZh : item.labelEn;
            return {
              id: item.viewId,
              label,
              icon: item.icon,
              active: activeView === item.viewId,
              title: item.implemented ? label : `${label}（${locale.unavailable}）`,
              onClick: () => onNavigate(item.viewId as NavigationView),
            };
          });
        return {
          id: group.id,
          title: isZh ? group.titleZh : group.titleEn,
          items,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [activeView, isZh, locale.unavailable, normalizedQuery, onNavigate]);

  return (
    <SidebarSectionList
      ariaLabel={locale.settingsCenter}
      search={{
        value: query,
        placeholder: locale.searchSettingsPlaceholder,
        onChange: setQuery,
      }}
      groups={groups}
      emptySearchText={locale.noMatchingSettings}
    />
  );
}
