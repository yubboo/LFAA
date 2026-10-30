/** 功能：声明 Minecraft 实例 JVM 参数共享合同。作用：供 Client、领域服务与 Daemon 共用静态类型。关联文件：同目录 minecraft-jvm-contract.mjs。 */
export type MinecraftJvmConfiguration = { memoryMb: number; initialHeapMb: number; jvmArguments: string[] };
export type MinecraftJvmPresetId = "recommended" | "high-performance" | "low-memory" | "custom";
export function parseMinecraftJvmArguments(value: string, context: { javaMajor: number; coreType: string }): MinecraftJvmConfiguration;
export function defaultMinecraftInitialHeapMb(memoryMb: number, executionMode?: "native" | "appcontainer"): number;
export function buildMinecraftJvmArguments(configuration: MinecraftJvmConfiguration, context: { javaMajor: number; coreType: string }): string[];
export function getMinecraftJvmPreset(preset: MinecraftJvmPresetId, context: { javaMajor: number; coreType: string; memoryMb: number }): MinecraftJvmConfiguration | null;
export function resolveMinecraftJvmArguments(configuration: { jvmArguments?: string[]; configured?: boolean }, context: { javaMajor: number; coreType: string; memoryMb: number }): string[];
export function serializeMinecraftJvmArguments(configuration: MinecraftJvmConfiguration): string;
export const MINECRAFT_JVM_PRESET_IDS: readonly MinecraftJvmPresetId[];
