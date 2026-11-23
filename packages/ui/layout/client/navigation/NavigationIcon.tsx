// 将统一的 Tabler 图标映射为侧栏可复用组件；「working」使用圆弧图标表示 Agent 运行中。
import {
  IconAdjustmentsHorizontal,
  IconAffiliate,
  IconArrowLeft,
  IconBell,
  IconBellOff,
  IconBooks,
  IconBrandOpenai,
  IconChartBar,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCircleLetterC,
  IconCircleDashed,
  IconClock,
  IconCopy,
  IconCube,
  IconDots,
  IconDownload,
  IconEdit,
  IconFolder,
  IconGitBranch,
  IconHelpCircle,
  IconHomeFilled,
  IconLayoutGrid,
  IconLayoutSidebar,
  IconLayoutSidebarRight,
  IconLoader2,
  IconLogout,
  IconMap,
  IconPalette,
  IconPhoto,
  IconPin,
  IconPlus,
  IconRobot,
  IconSearch,
  IconSend,
  IconUsers,
  IconSettings,
  IconUserCircle,
  IconX,
} from "@tabler/icons-react";

type IconComponent = typeof IconHomeFilled;

/** 限制工作台导航可以引用的图标名，确保名称能映射到共享图标集合。 */
export type NavigationIconName =
  | "home" | "images" | "scheduled" | "library" | "plugins" | "more" | "sites"
  | "companion" | "bell" | "muted" | "search" | "newChat" | "project" | "filter" | "plus"
  | "pin" | "map" | "gpt" | "codeReview" | "openai" | "canva" | "data"
  | "chevronDown" | "chevronRight" | "arrowLeft" | "close" | "settings" | "palette"
  | "copy" | "import" | "invite" | "profile" | "help" | "signOut" | "check"
  | "sidebarLeft" | "sidebarRight" | "working" | "agents" | "group";

const icons: Record<NavigationIconName, IconComponent> = {
  home: IconHomeFilled,
  images: IconPhoto,
  scheduled: IconClock,
  library: IconBooks,
  plugins: IconAffiliate,
  more: IconDots,
  sites: IconLayoutGrid,
  sidebarLeft: IconLayoutSidebar,
  sidebarRight: IconLayoutSidebarRight,
  companion: IconCircleDashed,
  bell: IconBell,
  muted: IconBellOff,
  search: IconSearch,
  newChat: IconEdit,
  project: IconFolder,
  filter: IconAdjustmentsHorizontal,
  plus: IconPlus,
  pin: IconPin,
  map: IconMap,
  gpt: IconCube,
  codeReview: IconGitBranch,
  openai: IconBrandOpenai,
  canva: IconCircleLetterC,
  data: IconChartBar,
  check: IconCheck,
  chevronDown: IconChevronDown,
  chevronRight: IconChevronRight,
  arrowLeft: IconArrowLeft,
  close: IconX,
  settings: IconSettings,
  palette: IconPalette,
  copy: IconCopy,
  import: IconDownload,
  invite: IconSend,
  profile: IconUserCircle,
  help: IconHelpCircle,
  signOut: IconLogout,
  working: IconLoader2,
  agents: IconRobot,
  group: IconUsers,
};

// 所有侧栏入口使用一致的线宽和尺寸，不产生重复的无障碍朗读；旋转动画由列表样式按状态附加。
export function NavigationIcon({ name, className }: { name: NavigationIconName; className?: string | undefined }) {
  const Icon = icons[name];
  return <Icon className={className} size={20} stroke={1.7} aria-hidden="true" />;
}
