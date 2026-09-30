/** Public image URLs for the supplied Minecraft scene artwork. */
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
