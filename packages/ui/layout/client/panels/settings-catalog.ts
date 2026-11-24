// 定义设置中心目录的分组与中英文标题：只登记已接入的页面，未接入不占目录位。
import type { NavigationIconName } from "../navigation/NavigationIcon";

/** 描述设置入口与文案。 */
export interface SettingsCatalogItem {
  viewId: string;
  labelZh: string;
  labelEn: string;
  icon: NavigationIconName;
}

/** 将设置入口组织为左栏导航分组。 */
export interface SettingsCatalogGroup {
  id: string;
  titleZh: string;
  titleEn: string;
  items: SettingsCatalogItem[];
}

/** 维护设置中心目录的稳定顺序，供侧栏和搜索共用；新增页必须先注册视图再登记此处。 */
export const SETTINGS_CATALOG: SettingsCatalogGroup[] = [
  {
    id: "personal",
    titleZh: "个人",
    titleEn: "Personal",
    items: [
      { viewId: "settings:general", labelZh: "常规", labelEn: "General", icon: "settings" },
      { viewId: "appearance", labelZh: "外观", labelEn: "Appearance", icon: "palette" },
      { viewId: "settings:notifications", labelZh: "通知", labelEn: "Notifications", icon: "bell" },
      { viewId: "settings:storage", labelZh: "存储", labelEn: "Storage", icon: "project" },
    ],
  },
  {
    id: "coding",
    titleZh: "编码",
    titleEn: "Coding",
    items: [
      { viewId: "settings:config", labelZh: "模型与规则", labelEn: "Models & Rules", icon: "filter" },
      { viewId: "settings:codeReview", labelZh: "代码审查", labelEn: "Code review", icon: "codeReview" },
      { viewId: "settings:git", labelZh: "Git", labelEn: "Git", icon: "filter" },
    ],
  },
  {
    id: "integrations",
    titleZh: "集成",
    titleEn: "Integrations",
    items: [
      { viewId: "settings:browser", labelZh: "浏览器", labelEn: "Browser", icon: "map" },
      { viewId: "settings:mcp", labelZh: "MCP", labelEn: "MCP", icon: "settings" },
    ],
  },
];

/** 按设置入口标识定位对应目录项。 */
export function findSettingsCatalogItem(viewId: string): SettingsCatalogItem | undefined {
  for (const group of SETTINGS_CATALOG) {
    const found = group.items.find((item) => item.viewId === viewId);
    if (found) return found;
  }
  return undefined;
}