export const MINECRAFT_PROPERTY_KEY_PATTERN: RegExp;
export const MINECRAFT_PROPERTY_VALUE_LIMIT: number;
export const MINECRAFT_PROPERTIES_TOTAL_LIMIT: number;
export const MINECRAFT_PROPERTIES_ENTRY_LIMIT: number;
export function isSensitiveMinecraftPropertyKey(key: string): boolean;
export function validateMinecraftPropertyChanges(values: unknown, knownKeys: Set<string>, releaseId: string): Record<string, string | null>;
