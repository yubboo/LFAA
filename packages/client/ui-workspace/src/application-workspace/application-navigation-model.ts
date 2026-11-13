/**
 * 功能：生成 ApplicationNavigationPanel 使用的应用导航模型。
 * 作用：集中维护应用/共享能力分组、活动项和选择回调规则，供组件及定向回归共用。
 */
import type { ApplicationId, ApplicationMode } from "lfaa-client-connection/src/api.js";
import type { ApplicationNavigationItem } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";
import type { SecondaryNavigationGroup } from "lfaa-client-ui-sidebar/src/SecondaryNavigation.js";

export function buildApplicationNavigationGroups(
  app: ApplicationId,
  applicationNavigationItems: ApplicationNavigationItem[],
  gameLibrary: boolean,
  onNavigate: (path: string) => void,
  onOpenApplication: (app: ApplicationId, mode: ApplicationMode) => Promise<void>
): SecondaryNavigationGroup[] {
  const createItems = (items: ApplicationNavigationItem[]): SecondaryNavigationGroup["items"] => items.map<SecondaryNavigationGroup["items"][number]>((item) => ({
    id: `module-context-application-${item.id}`,
    label: item.title,
    description: item.description,
    icon: item.id === "games" || item.id === "canvas" ? "grid"
      : item.id === "steamcmd" ? "terminal"
        : item.id === "minecraft" ? "monitor"
          : item.id === "connectivity" ? "branch"
            : item.id === "writing" ? "book" : "spark",
    trailingIcon: "chevron",
    active: Boolean(item.applicationId && item.applicationId === app || item.id === "games" && gameLibrary),
    onSelect: () => {
      if (item.route) onNavigate(item.route);
      else if (item.applicationId) void onOpenApplication(item.applicationId, "ai-work").catch(() => undefined);
    },
  }));
  const domainApplications = applicationNavigationItems.filter(item => item.id !== "canvas");
  const sharedCapabilities = applicationNavigationItems.filter(item => item.id === "canvas");
  return [
    ...(domainApplications.length > 0 ? [{
      id: "module-context-domain-applications",
      label: "领域应用",
      collapsible: false,
      items: createItems(domainApplications),
    }] : []),
    ...(sharedCapabilities.length > 0 ? [{
      id: "module-context-shared-capabilities",
      label: "系统共享能力",
      collapsible: false,
      items: createItems(sharedCapabilities),
    }] : []),
  ];
}
