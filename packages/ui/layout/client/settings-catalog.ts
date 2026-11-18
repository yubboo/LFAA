// 定义设置中心左二栏的分组目录与中英文标题，保持未接入项状态透明。
import type { NavigationIconName } from "./components/NavigationIcon";

export interface SettingsCatalogItem {
  viewId: string;
  labelZh: string;
  labelEn: string;
  icon: NavigationIconName;
  implemented?: boolean;
}

export interface SettingsCatalogGroup {
  id: string;
  titleZh: string;
  titleEn: string;
  items: SettingsCatalogItem[];
}

export const SETTINGS_CATALOG: SettingsCatalogGroup[] = [
  {
    id: "personal",
    titleZh: "个人",
    titleEn: "Personal",
    items: [
      { viewId: "settings:general", labelZh: "常规", labelEn: "General", icon: "settings" },
      { viewId: "settings:notifications", labelZh: "通知", labelEn: "Notifications", icon: "bell" },
      { viewId: "settings:import", labelZh: "导入", labelEn: "Import", icon: "plus" },
      { viewId: "settings:profile", labelZh: "个人资料", labelEn: "Profile", icon: "profile" },
      { viewId: "appearance", labelZh: "外观", labelEn: "Appearance", icon: "palette", implemented: true },
      { viewId: "settings:account", labelZh: "账户", labelEn: "Account", icon: "invite" },
      { viewId: "settings:archived", labelZh: "已归档的聊天", labelEn: "Archived chats", icon: "library" },
      { viewId: "settings:parental", labelZh: "家长控制", labelEn: "Parental controls", icon: "help" },
      { viewId: "settings:contacts", labelZh: "受信任联系人", labelEn: "Trusted contacts", icon: "profile" },
      { viewId: "settings:voice", labelZh: "语音", labelEn: "Voice", icon: "companion" },
      { viewId: "settings:storage", labelZh: "存储", labelEn: "Storage", icon: "project" },
      { viewId: "settings:config", labelZh: "模型与规则配置", labelEn: "Models & Rules", icon: "filter", implemented: true },
      { viewId: "settings:personalization", labelZh: "个性化", labelEn: "Personalization", icon: "palette" },
      { viewId: "settings:companion", labelZh: "迷你界面和智能伙伴", labelEn: "Mini & companion", icon: "companion" },
      { viewId: "settings:shortcuts", labelZh: "键盘快捷键", labelEn: "Keyboard shortcuts", icon: "search" },
      { viewId: "settings:billing", labelZh: "使用情况和计费", labelEn: "Usage & billing", icon: "data" },
      { viewId: "settings:data", labelZh: "数据管理", labelEn: "Data controls", icon: "library" },
    ],
  },
  {
    id: "integrations",
    titleZh: "集成",
    titleEn: "Integrations",
    items: [
      { viewId: "settings:plugins", labelZh: "插件", labelEn: "Plugins", icon: "plugins" },
      { viewId: "settings:passwords", labelZh: "密码", labelEn: "Passwords", icon: "settings" },
      { viewId: "settings:computer", labelZh: "电脑控制", labelEn: "Computer use", icon: "sites" },
      { viewId: "settings:snapshots", labelZh: "应用快照", labelEn: "App snapshots", icon: "images" },
      { viewId: "settings:browser", labelZh: "浏览器", labelEn: "Browser", icon: "map" },
      { viewId: "settings:cloud", labelZh: "云电脑", labelEn: "Cloud desktop", icon: "gpt" },
    ],
  },
  {
    id: "coding",
    titleZh: "编码",
    titleEn: "Coding",
    items: [
      { viewId: "settings:hooks", labelZh: "钩子", labelEn: "Hooks", icon: "codeReview" },
      { viewId: "settings:connections", labelZh: "连接", labelEn: "Connections", icon: "openai" },
    ],
  },
];

export function findSettingsCatalogItem(viewId: string): SettingsCatalogItem | undefined {
  for (const group of SETTINGS_CATALOG) {
    const found = group.items.find((item) => item.viewId === viewId);
    if (found) return found;
  }
  return undefined;
}
