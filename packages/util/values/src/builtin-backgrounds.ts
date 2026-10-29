/**
 * 功能：登记随 Web 交付的场景图片与背景名称。
 * 作用：作为登录、工作台和设置中心的纯数据清单，主题无需依赖业务 UI。
 * 关联文件：apps/web/public/backgrounds、apps/web/public/images/minecraft、client/ui-theme/src/login-appearance.ts、client/ui-settings/src/SettingsPage.tsx、client/ui-layout/src/Workbench.tsx。
 */
export const minecraftSceneImages = {
  forestBridgeEvening: "/images/minecraft/forest-bridge-evening.png",
  tropicalCoastDay: "/images/minecraft/tropical-coast-day.png",
  oceanCliffSunset: "/images/minecraft/ocean-cliff-sunset.png",
  rainyGrassland: "/images/minecraft/rainy-grassland.png",
  snowyCabinInterior: "/images/minecraft/snowy-cabin-interior.png",
  lakesidePagodaMorning: "/images/minecraft/lakeside-pagoda-morning.png",
  goldenWheatField: "/images/minecraft/golden-wheat-field.png",
  flowerMeadowCastle: "/images/minecraft/flower-meadow-castle.png",
  cherryBlossomShore: "/images/minecraft/cherry-blossom-shore.png",
  cherryBlossomVillage: "/images/minecraft/cherry-blossom-village.png"
} as const;

export type MinecraftSceneImage = keyof typeof minecraftSceneImages;

export const minecraftSceneBackgrounds = [
  { id: "cherry-blossom-shore", name: "樱花海岸", file: minecraftSceneImages.cherryBlossomShore },
  { id: "cherry-blossom-village", name: "樱花村庄", file: minecraftSceneImages.cherryBlossomVillage },
  { id: "flower-meadow-castle", name: "花野城堡", file: minecraftSceneImages.flowerMeadowCastle },
  { id: "forest-bridge-evening", name: "林间桥影", file: minecraftSceneImages.forestBridgeEvening },
  { id: "golden-wheat-field", name: "金色麦田", file: minecraftSceneImages.goldenWheatField },
  { id: "lakeside-pagoda-morning", name: "湖畔晨光", file: minecraftSceneImages.lakesidePagodaMorning },
  { id: "ocean-cliff-sunset", name: "海崖日落", file: minecraftSceneImages.oceanCliffSunset },
  { id: "rainy-grassland", name: "雨后草原", file: minecraftSceneImages.rainyGrassland },
  { id: "snowy-cabin-interior", name: "雪夜木屋", file: minecraftSceneImages.snowyCabinInterior },
  { id: "tropical-coast-day", name: "热带海岸", file: minecraftSceneImages.tropicalCoastDay }
] as const;

/** 外观设置与 Agent 共享的内置背景选项；ID 必须与 Settings Owner 校验合同一致。 */
export const appearanceBackgroundOptions = [
  { id: "none", name: "纯色" },
  { id: "cherry-blossom-waterfront", name: "樱花水岸", file: "/backgrounds/cherry-blossom-waterfront.png" },
  { id: "service-room", name: "服务机房", file: "/backgrounds/service-room.jpg" },
  { id: "steamcmd-world", name: "游戏世界", file: "/backgrounds/steamcmd-world.jpg" },
  { id: "minecraft-world", name: "方块日落", file: "/backgrounds/minecraft-world.jpg" },
  { id: "writing-desk", name: "写作桌面", file: "/backgrounds/writing-desk.jpg" },
  { id: "writing-yunjian", name: "云涧书境", file: "/backgrounds/writing-yunjian.png" },
  ...minecraftSceneBackgrounds
] as const;

/** 外观设置背景图的唯一槽位名称；每个槽位独立保存，Agent 不应推断为全局批量修改。 */
export const appearanceBackgroundTargets = [
  { id: "login", label: "登录页（当前设备）" },
  { id: "appCenter", label: "小鱼智能体工作区" },
  { id: "steamcmd", label: "SteamCMD 工作区" },
  { id: "minecraft", label: "Minecraft 工作区（常规与小鱼智能体）" },
  { id: "writing", label: "写作工作区" },
  { id: "settings", label: "设置中心" }
] as const;
