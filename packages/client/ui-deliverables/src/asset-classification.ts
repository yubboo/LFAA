/** 功能：按真实登记类型和文件扩展名整理资产；不推断或伪造构建状态。 */
export type AssetGroup = "minecraft-plugin" | "minecraft-mod" | "models" | "textures" | "resources" | "other";
export interface ClassifiableAsset { artifactKind: "minecraft-plugin" | "minecraft-mod" | "other"; fileName: string }

export const assetGroupLabels: Record<AssetGroup, string> = {
  "minecraft-plugin": "插件包",
  "minecraft-mod": "模组包",
  models: "模型",
  textures: "贴图",
  resources: "资源文件",
  other: "其他产物"
};

export function getAssetGroup(item: ClassifiableAsset): AssetGroup {
  if (item.artifactKind === "minecraft-plugin") return "minecraft-plugin";
  if (item.artifactKind === "minecraft-mod") return "minecraft-mod";
  const extension = item.fileName.toLowerCase().split(".").pop() ?? "";
  if (["obj", "fbx", "glb", "gltf", "bbmodel", "blend"].includes(extension)) return "models";
  if (["png", "jpg", "jpeg", "webp", "gif", "tif", "tiff", "ase", "aseprite"].includes(extension)) return "textures";
  if (["json", "yml", "yaml", "toml", "zip"].includes(extension)) return "resources";
  return "other";
}

export function isFeaturedMinecraftJar(item: ClassifiableAsset): boolean {
  return item.artifactKind !== "other" && item.fileName.toLowerCase().endsWith(".jar");
}
