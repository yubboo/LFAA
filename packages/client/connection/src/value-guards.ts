/**
 * Connection 响应对象的窄化守卫。
 */

export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }