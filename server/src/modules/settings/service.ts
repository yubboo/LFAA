/**
 * 文件：service.ts
 * 作用：保存用户设置并安全管理 AI Provider 账户与模型目录。
 * 负责：设置默认值、白名单 Provider 连接检测、模型发现、密钥加密和账户生命周期。
 * 不负责：前端页面、AI 推理、插件执行或主机节点操作。
 * 状态归属：用户设置与 AI 账户保存在控制端 SQLite；AI 密钥使用本机密钥文件加密。
 * 关联文件：server/src/database.ts、server/src/api/routes.ts、frontend/src/api.ts、frontend/src/components/SettingsPage.tsx。
 * 修改注意事项：Provider 地址必须来自固定登记表；不得接受任意 URL 或将明文密钥写入数据库、日志和 API 响应。
 */
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { database } from "../../database.js";
import { config } from "../../config.js";

export type SettingsCategory = "general" | "appearance" | "shortcuts" | "ai-runtime" | "permissions" | "plugins";

export interface GeneralSettings {
  defaultMode: "normal" | "ai-work";
  showServiceStatus: boolean;
  showBottomPanelControl: boolean;
  taskFolder: string;
  fileOpenLocation: "system" | "ask";
  agentEnvironment: "system" | "windows-native" | "wsl" | "linux";
  integratedShell: "system" | "powershell" | "cmd" | "bash" | "zsh";
  language: "system" | "zh-CN" | "en-US";
  defaultFullView: boolean;
  navigationLayout: "left-two-column" | "three-column" | "right-tools" | "focus";
  terminalPosition: "bottom" | "right";
  plainTextEditor: boolean;
  sendShortcut: "enter" | "ctrl-enter";
  followupBehavior: "queue" | "steer";
  popupShortcut: string;
  defaultStandaloneChat: boolean;
  completionNotification: "always" | "unfocused" | "never";
  permissionNotifications: boolean;
  questionNotifications: boolean;
  notificationSound: "default" | "subtle" | "off";
  confettiEnabled: boolean;
}

export interface AppearanceSettings {
  theme: "light" | "dark" | "system";
  accentColor: string;
  sidebarColor: string;
  backgrounds: {
    login: string;
    appCenter: string;
    steamcmd: string;
    minecraft: string;
    writing: string;
    settings: string;
  };
  overlay: number;
  blur: number;
  advanced: AppearanceAdvancedSettings;
}

export interface AppearanceFonts {
  interface: "system" | "sans" | "serif";
  content: "system" | "sans" | "serif";
  code: "system" | "cascadia" | "consolas" | "jetbrains";
}

export interface AppearanceAdvancedSettings {
  interfaceFontSize: number;
  codeFontSize: number;
  reducedMotion: "system" | "on" | "off";
  separateModes: boolean;
  fonts: AppearanceFonts;
  modeStyles: {
    light: { accentColor: string; fonts: AppearanceFonts };
    dark: { accentColor: string; fonts: AppearanceFonts };
  };
  translucentSidebar: boolean;
  contrast: number;
  diffMarkers: "color" | "symbols";
  pointerCursor: boolean;
}

export interface AppearanceBackgroundView {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  createdAt: string;
}

export interface ShortcutSettings {
  openSettings: string[];
  openHome: string[];
  openSteamcmd: string[];
  openMinecraft: string[];
  openWriting: string[];
  toggleSidebar: string[];
  toggleContextPanel: string[];
  toggleBottomPanel: string[];
  openTerminal: string[];
  switchNormalMode: string[];
  switchAiWorkMode: string[];
}

export interface UserSettings {
  general: GeneralSettings;
  appearance: AppearanceSettings;
  shortcuts: ShortcutSettings;
  aiRuntime: AiRuntimeSettings;
  permissions: PermissionSettings;
  plugins: PluginSettings;
}

export interface AiRuntimeSettings {
  speed: "balanced" | "fast" | "deep";
  promptSuggestions: boolean;
  showContextUsage: boolean;
  requestTimeoutSeconds: number;
  maxOutputTokens: number;
}

export interface PermissionSettings {
  mode: "ask" | "approve_remembered" | "full_access";
}

export interface PluginSettings {
  enabled: boolean;
}

export const defaultSettings: UserSettings = {
  general: {
    defaultMode: "normal",
    showServiceStatus: true,
    showBottomPanelControl: true,
    taskFolder: "",
    fileOpenLocation: "system",
    agentEnvironment: "system",
    integratedShell: "system",
    language: "system",
    defaultFullView: true,
    navigationLayout: "three-column",
    terminalPosition: "bottom",
    plainTextEditor: true,
    sendShortcut: "enter",
    followupBehavior: "queue",
    popupShortcut: "",
    defaultStandaloneChat: false,
    completionNotification: "unfocused",
    permissionNotifications: true,
    questionNotifications: true,
    notificationSound: "default",
    confettiEnabled: false
  },
  appearance: { theme: "system", accentColor: "#3457d5", sidebarColor: "auto", backgrounds: { login: "forest-bridge-evening", appCenter: "cherry-blossom-shore", steamcmd: "ocean-cliff-sunset", minecraft: "cherry-blossom-village", writing: "snowy-cabin-interior", settings: "lakeside-pagoda-morning" }, overlay: 42, blur: 8, advanced: { interfaceFontSize: 14, codeFontSize: 12, reducedMotion: "system", separateModes: false, fonts: { interface: "system", content: "system", code: "system" }, modeStyles: { light: { accentColor: "#3457d5", fonts: { interface: "system", content: "system", code: "system" } }, dark: { accentColor: "#3457d5", fonts: { interface: "system", content: "system", code: "system" } } }, translucentSidebar: false, contrast: 60, diffMarkers: "color", pointerCursor: false } },
  shortcuts: { openSettings: ["Ctrl+,"], openHome: ["Alt+0"], openSteamcmd: ["Ctrl+Alt+1"], openMinecraft: ["Ctrl+Alt+2"], openWriting: ["Ctrl+Alt+3"], toggleSidebar: ["Ctrl+B"], toggleContextPanel: ["Ctrl+Alt+B"], toggleBottomPanel: ["Ctrl+J"], openTerminal: ["Ctrl+`"], switchNormalMode: ["Alt+1"], switchAiWorkMode: ["Alt+2"] },
  aiRuntime: { speed: "balanced", promptSuggestions: true, showContextUsage: false, requestTimeoutSeconds: 90, maxOutputTokens: 2048 },
  permissions: { mode: "ask" },
  plugins: { enabled: false }
};

const allowedAccentColors = new Set(["#3457d5", "#1687a7", "#27845b", "#8956bb", "#d05b37", "#d64d8f"]);

export function getUserSettings(userId: string): UserSettings {
  const rows = database.prepare("SELECT category, value_json FROM user_settings WHERE user_id = ?").all(userId) as Array<{ category: SettingsCategory; value_json: string }>;
  const result = structuredClone(defaultSettings);
  for (const row of rows) {
    try {
      const value = JSON.parse(row.value_json) as Record<string, unknown>;
      if (row.category === "general") result.general = readGeneralSettings(value) ?? result.general;
      if (row.category === "appearance") {
        const appearance = readAppearanceSettings(value);
        if (appearance) result.appearance = appearance;
      }
    if (row.category === "shortcuts") result.shortcuts = readShortcutSettings(value) ?? result.shortcuts;
    if (row.category === "ai-runtime") result.aiRuntime = readAiRuntimeSettings(value) ?? result.aiRuntime;
    if (row.category === "permissions") result.permissions = readPermissionSettings(value) ?? result.permissions;
    if (row.category === "plugins") result.plugins = readPluginSettings(value) ?? result.plugins;
    } catch {
      // 损坏的单项设置回退到默认值，不影响其他设置分类读取。
    }
  }
  return result;
}

function readGeneralSettings(value: Record<string, unknown>): GeneralSettings | null {
  if ((value.defaultMode !== "normal" && value.defaultMode !== "ai-work") || typeof value.showServiceStatus !== "boolean") return null;
  const defaults = defaultSettings.general;
  const choose = <T extends string>(candidate: unknown, options: readonly T[], fallback: T): T =>
    typeof candidate === "string" && (options as readonly string[]).includes(candidate) ? candidate as T : fallback;
  return {
    ...defaults,
    defaultMode: value.defaultMode,
    showServiceStatus: value.showServiceStatus,
    showBottomPanelControl: typeof value.showBottomPanelControl === "boolean" ? value.showBottomPanelControl : defaults.showBottomPanelControl,
    taskFolder: typeof value.taskFolder === "string" && value.taskFolder.length <= 512 ? value.taskFolder : defaults.taskFolder,
    fileOpenLocation: choose(value.fileOpenLocation, ["system", "ask"], defaults.fileOpenLocation),
    agentEnvironment: choose(value.agentEnvironment, ["system", "windows-native", "wsl", "linux"], defaults.agentEnvironment),
    integratedShell: choose(value.integratedShell, ["system", "powershell", "cmd", "bash", "zsh"], defaults.integratedShell),
    language: choose(value.language, ["system", "zh-CN", "en-US"], defaults.language),
    defaultFullView: typeof value.defaultFullView === "boolean" ? value.defaultFullView : defaults.defaultFullView,
    navigationLayout: choose(value.navigationLayout, ["left-two-column", "three-column", "right-tools", "focus"], defaults.navigationLayout),
    terminalPosition: choose(value.terminalPosition, ["bottom", "right"], defaults.terminalPosition),
    plainTextEditor: typeof value.plainTextEditor === "boolean" ? value.plainTextEditor : defaults.plainTextEditor,
    sendShortcut: choose(value.sendShortcut, ["enter", "ctrl-enter"], defaults.sendShortcut),
    followupBehavior: choose(value.followupBehavior, ["queue", "steer"], defaults.followupBehavior),
    popupShortcut: typeof value.popupShortcut === "string" && value.popupShortcut.length <= 48 ? value.popupShortcut : defaults.popupShortcut,
    defaultStandaloneChat: typeof value.defaultStandaloneChat === "boolean" ? value.defaultStandaloneChat : defaults.defaultStandaloneChat,
    completionNotification: choose(value.completionNotification, ["always", "unfocused", "never"], defaults.completionNotification),
    permissionNotifications: typeof value.permissionNotifications === "boolean" ? value.permissionNotifications : defaults.permissionNotifications,
    questionNotifications: typeof value.questionNotifications === "boolean" ? value.questionNotifications : defaults.questionNotifications,
    notificationSound: choose(value.notificationSound, ["default", "subtle", "off"], defaults.notificationSound),
    confettiEnabled: typeof value.confettiEnabled === "boolean" ? value.confettiEnabled : defaults.confettiEnabled
  };
}

function readAiRuntimeSettings(value: Record<string, unknown>): AiRuntimeSettings | null {
  const choose = <T extends string>(candidate: unknown, options: readonly T[], fallback: T): T =>
    typeof candidate === "string" && (options as readonly string[]).includes(candidate) ? candidate as T : fallback;
  return {
    speed: choose(value.speed, ["fast", "balanced", "deep"], defaultSettings.aiRuntime.speed),
    promptSuggestions: typeof value.promptSuggestions === "boolean" ? value.promptSuggestions : defaultSettings.aiRuntime.promptSuggestions,
    showContextUsage: typeof value.showContextUsage === "boolean" ? value.showContextUsage : defaultSettings.aiRuntime.showContextUsage,
    requestTimeoutSeconds: typeof value.requestTimeoutSeconds === "number" && Number.isInteger(value.requestTimeoutSeconds) && value.requestTimeoutSeconds >= 10 && value.requestTimeoutSeconds <= 300 ? value.requestTimeoutSeconds : defaultSettings.aiRuntime.requestTimeoutSeconds,
    maxOutputTokens: typeof value.maxOutputTokens === "number" && Number.isInteger(value.maxOutputTokens) && value.maxOutputTokens >= 256 && value.maxOutputTokens <= 16384 ? value.maxOutputTokens : defaultSettings.aiRuntime.maxOutputTokens
  };
}

function readPermissionSettings(value: Record<string, unknown>): PermissionSettings | null {
  if (value.mode === "ask" || value.mode === "approve_remembered" || value.mode === "full_access") return { mode: value.mode };
  if (value.defaultPermission === "ask") return { mode: "ask" };
  // 旧版工作区授权不带可审计的目标范围，迁移为首次需审批的记忆模式，不能继续静默放行。
  if (value.defaultPermission === "workspace") return { mode: "approve_remembered" };
  return null;
}

function readPluginSettings(value: Record<string, unknown>): PluginSettings | null {
  return typeof value.enabled === "boolean" ? { enabled: value.enabled } : null;
}

export function saveUserSettings(
  userId: string,
  category: SettingsCategory,
  value: GeneralSettings | AppearanceSettings | ShortcutSettings | AiRuntimeSettings | PermissionSettings | PluginSettings
): void {
  database.prepare(`
    INSERT INTO user_settings (user_id, category, value_json)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, category) DO UPDATE SET
      value_json = excluded.value_json,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `).run(userId, category, JSON.stringify(value));
}

function imageDimensions(data: Buffer, mimeType: string): { width: number; height: number } {
  // 根据文件头与编码尺寸复核图片内容，不能只信任浏览器声明的 MIME 类型或像素值。
  if (mimeType === "image/png") {
    if (data.length < 24 || data.toString("hex", 0, 8) !== "89504e470d0a1a0a") throw new Error("PNG 图片头无效。");
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  if (mimeType === "image/jpeg") {
    if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) throw new Error("JPEG 图片头无效。");
    let offset = 2;
    while (offset + 4 < data.length) {
      if (data[offset] !== 0xff) { offset += 1; continue; }
      const marker = data[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > data.length) break;
      const length = data.readUInt16BE(offset);
      if (length < 2 || offset + length > data.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (length < 7) break;
        return { width: data.readUInt16BE(offset + 5), height: data.readUInt16BE(offset + 3) };
      }
      offset += length;
    }
    throw new Error("无法读取 JPEG 图片尺寸。");
  }
  if (data.length < 30 || data.toString("ascii", 0, 4) !== "RIFF" || data.toString("ascii", 8, 12) !== "WEBP") throw new Error("WebP 图片头无效。");
  const chunk = data.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { width: 1 + data.readUIntLE(24, 3), height: 1 + data.readUIntLE(27, 3) };
  if (chunk === "VP8 ") return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L" && data[20] === 0x2f) {
    const bits = data.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  throw new Error("无法读取 WebP 图片尺寸。");
}

export function listUserBackgrounds(userId: string): AppearanceBackgroundView[] {
  const rows = database.prepare("SELECT id, display_name, mime_type, created_at FROM appearance_backgrounds WHERE user_id = ? ORDER BY created_at DESC").all(userId) as Array<{ id: string; display_name: string; mime_type: string; created_at: string }>;
  return rows.map((image) => ({ id: image.id, name: image.display_name, mimeType: image.mime_type, url: `/api/settings/backgrounds/${image.id}`, createdAt: image.created_at }));
}

export function saveUserBackground(userId: string, dataUrl: string, displayName: string): AppearanceBackgroundView {
  if (dataUrl.length > 4_200_000) throw new Error("背景图片不能超过 3 MiB。");
  const match = /^data:(image\/png|image\/jpeg|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/u.exec(dataUrl);
  if (!match) throw new Error("背景图片仅支持 PNG、JPEG 或 WebP 格式。");
  const mimeType = match[1]!;
  const data = Buffer.from(match[2]!, "base64");
  if (data.length === 0 || data.length > 3 * 1024 * 1024) throw new Error("背景图片不能超过 3 MiB。");
  const { width, height } = imageDimensions(data, mimeType);
  if (width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 20_000_000) throw new Error("背景图片尺寸不能超过 8192 像素边长或 2000 万像素。");
  const id = `user-${randomUUID()}`;
  const name = displayName.trim().slice(0, 80) || "自定义背景";
  database.prepare("INSERT INTO appearance_backgrounds (user_id, id, display_name, mime_type, image_data) VALUES (?, ?, ?, ?, ?)").run(userId, id, name, mimeType, data);
  return { id, name, mimeType, url: `/api/settings/backgrounds/${id}`, createdAt: new Date().toISOString() };
}

export function getUserBackground(userId: string, id: string): { mimeType: string; data: Buffer } | null {
  const row = database.prepare("SELECT mime_type, image_data FROM appearance_backgrounds WHERE user_id = ? AND id = ?").get(userId, id) as { mime_type: string; image_data: Uint8Array } | undefined;
  return row ? { mimeType: row.mime_type, data: Buffer.from(row.image_data) } : null;
}

export function deleteUserBackground(userId: string, id: string): void {
  database.prepare("DELETE FROM appearance_backgrounds WHERE user_id = ? AND id = ?").run(userId, id);
}

function readAppearanceSettings(value: Record<string, unknown>): AppearanceSettings | null {
  if (!isAppearanceSettings(value)) return null;
  const appearance = value as unknown as AppearanceSettings;
  return {
    ...appearance,
    // 旧账户没有侧边栏颜色字段时继续跟随主题；自定义颜色仅接受标准六位十六进制值。
    sidebarColor: typeof appearance.sidebarColor === "string" ? appearance.sidebarColor.toLocaleLowerCase() : defaultSettings.appearance.sidebarColor,
    // 旧账户没有高级外观字段时使用默认值，保留原有主题、背景和遮罩设置。
    backgrounds: { ...defaultSettings.appearance.backgrounds, ...appearance.backgrounds },
    advanced: isAppearanceAdvancedSettings(value.advanced) ? value.advanced : structuredClone(defaultSettings.appearance.advanced)
  };
}

function isValidSidebarColor(value: unknown): boolean {
  return value === undefined || value === "auto" || (typeof value === "string" && /^#[0-9a-f]{6}$/iu.test(value));
}

function isAppearanceSettings(value: Record<string, unknown>): boolean {
  const backgrounds = typeof value.backgrounds === "object" && value.backgrounds !== null && !Array.isArray(value.backgrounds)
    ? value.backgrounds as Record<string, unknown>
    : null;
  if (backgrounds === null) return false;
  const legacyTargets = ["appCenter", "steamcmd", "minecraft", "writing", "settings"];
  const targets = [...legacyTargets, "login"];
  const keys = Object.keys(backgrounds);
  const hasLegacyShape = keys.length === legacyTargets.length && legacyTargets.every((target) => target in backgrounds);
  const hasCurrentShape = keys.length === targets.length && targets.every((target) => target in backgrounds);
  if (!hasLegacyShape && !hasCurrentShape) return false;
  const backgroundIds = new Set(["none", "service-room", "steamcmd-world", "minecraft-world", "writing-desk", "cherry-blossom-shore", "cherry-blossom-village", "flower-meadow-castle", "forest-bridge-evening", "golden-wheat-field", "lakeside-pagoda-morning", "ocean-cliff-sunset", "rainy-grassland", "snowy-cabin-interior", "tropical-coast-day"]);
  return (value.theme === "light" || value.theme === "dark" || value.theme === "system")
    && typeof value.accentColor === "string" && allowedAccentColors.has(value.accentColor)
    && isValidSidebarColor(value.sidebarColor)
    && targets.every((target) => {
      const backgroundId = backgrounds[target] ?? (target === "login" && hasLegacyShape ? defaultSettings.appearance.backgrounds.login : undefined);
      return typeof backgroundId === "string" && (backgroundIds.has(backgroundId) || /^user-[0-9a-f-]{36}$/iu.test(backgroundId));
    })
    && Number.isInteger(value.overlay) && Number(value.overlay) >= 0 && Number(value.overlay) <= 75
    && Number.isInteger(value.blur) && Number(value.blur) >= 0 && Number(value.blur) <= 32;
}

function isAppearanceFonts(value: unknown): value is AppearanceFonts {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const fonts = value as Record<string, unknown>;
  return ["system", "sans", "serif"].includes(String(fonts.interface))
    && ["system", "sans", "serif"].includes(String(fonts.content))
    && ["system", "cascadia", "consolas", "jetbrains"].includes(String(fonts.code));
}

function isAppearanceAdvancedSettings(value: unknown): value is AppearanceAdvancedSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const advanced = value as Record<string, unknown>;
  const modeStyles = typeof advanced.modeStyles === "object" && advanced.modeStyles !== null && !Array.isArray(advanced.modeStyles)
    ? advanced.modeStyles as Record<string, unknown>
    : null;
  if (!modeStyles) return false;
  const isModeStyle = (candidate: unknown): candidate is { accentColor: string; fonts: AppearanceFonts } =>
    typeof candidate === "object" && candidate !== null && !Array.isArray(candidate)
    && typeof (candidate as Record<string, unknown>).accentColor === "string"
    && allowedAccentColors.has((candidate as Record<string, unknown>).accentColor as string)
    && isAppearanceFonts((candidate as Record<string, unknown>).fonts);
  return Number.isInteger(advanced.interfaceFontSize) && Number(advanced.interfaceFontSize) >= 10 && Number(advanced.interfaceFontSize) <= 24
    && Number.isInteger(advanced.codeFontSize) && Number(advanced.codeFontSize) >= 8 && Number(advanced.codeFontSize) <= 24
    && ["system", "on", "off"].includes(String(advanced.reducedMotion))
    && typeof advanced.separateModes === "boolean"
    && isAppearanceFonts(advanced.fonts)
    && isModeStyle(modeStyles.light) && isModeStyle(modeStyles.dark)
    && typeof advanced.translucentSidebar === "boolean"
    && Number.isInteger(advanced.contrast) && Number(advanced.contrast) >= 0 && Number(advanced.contrast) <= 100
    && ["color", "symbols"].includes(String(advanced.diffMarkers))
    && typeof advanced.pointerCursor === "boolean";
}

function isValidShortcut(value: unknown): value is string {
  return typeof value === "string" && value.length <= 32 && /^[\p{L}\p{N}\p{P} ]*$/u.test(value);
}

function readShortcutSettings(value: Record<string, unknown>): ShortcutSettings | null {
  const requiredKeys: Array<keyof ShortcutSettings> = ["openSettings", "openHome", "openSteamcmd", "openMinecraft", "openWriting"];
  const allowedKeys = Object.keys(defaultSettings.shortcuts) as Array<keyof ShortcutSettings>;
  if (Object.keys(value).some((key) => !allowedKeys.includes(key as keyof ShortcutSettings)) || requiredKeys.some((key) => value[key] === undefined)) return null;
  const result = structuredClone(defaultSettings.shortcuts);
  for (const key of allowedKeys) {
    const saved = value[key];
    if (saved === undefined) continue;
    const bindings = typeof saved === "string" ? [saved] : saved;
    if (!Array.isArray(bindings) || bindings.length > 4 || !bindings.every(isValidShortcut)) return null;
    result[key] = [...bindings];
  }
  return result;
}

export interface AiProviderDefinition {
  id: string;
  name: string;
  description: string;
  options: Array<{ id: string; label: string; choices: Array<{ value: string; label: string }> }>;
  discovery: "api" | "official-list";
}

const providers: readonly AiProviderDefinition[] = [
  { id: "openai", name: "OpenAI", description: "OpenAI API 官方模型目录。", options: [], discovery: "api" },
  { id: "deepseek", name: "DeepSeek", description: "DeepSeek 官方 API。", options: [], discovery: "api" },
  { id: "qwen", name: "千问 / 百炼", description: "阿里云百炼区域 API。", options: [{ id: "region", label: "区域", choices: [{ value: "cn-beijing", label: "中国（北京）" }, { value: "ap-southeast-1", label: "新加坡" }, { value: "cn-hongkong", label: "中国（香港）" }, { value: "eu-central-1", label: "德国（法兰克福）" }, { value: "ap-northeast-1", label: "日本（东京）" }, { value: "us-east-1", label: "美国（弗吉尼亚）" }] }, { id: "workspaceId", label: "Workspace ID", choices: [] }], discovery: "api" },
  { id: "kimi", name: "Kimi", description: "Moonshot / Kimi 开放平台。", options: [{ id: "region", label: "区域", choices: [{ value: "china", label: "中国" }, { value: "international", label: "国际" }] }], discovery: "api" },
  { id: "zhipu", name: "智谱 GLM", description: "智谱 BigModel 官方模型目录。", options: [{ id: "endpoint", label: "接口类型", choices: [{ value: "standard", label: "标准 API" }, { value: "coding", label: "Coding API" }] }], discovery: "official-list" },
  { id: "xiaomi", name: "Xiaomi MiMo", description: "小米 MiMo 按量 API 或 Token Plan。", options: [{ id: "authMethod", label: "认证方式", choices: [{ value: "api-key", label: "按量 API Key" }, { value: "token-plan", label: "Token Plan" }] }, { id: "region", label: "Token Plan 区域", choices: [{ value: "cn", label: "中国" }, { value: "sgp", label: "新加坡" }, { value: "ams", label: "欧洲" }] }], discovery: "api" }
];

export function listAiProviders(): readonly AiProviderDefinition[] {
  return providers;
}

export interface AiProviderInput {
  providerId: string;
  secret: string;
  options: Record<string, string>;
}

export interface AiProviderProbe {
  status: "connected" | "unverified";
  message: string;
  models: Array<{ id: string; name: string }>;
}

const documentedZhipuModels = ["glm-5.3", "glm-5.3-flash", "glm-5.3-flashx", "glm-5.2"];

function resolveProvider(providerId: string, options: Record<string, string>): { url: string; chatUrl: string; keyHeader: string; keyPrefix?: string } {
  switch (providerId) {
    case "openai": return { url: "https://api.openai.com/v1/models", chatUrl: "https://api.openai.com/v1/chat/completions", keyHeader: "Authorization", keyPrefix: "Bearer " };
    case "deepseek": return { url: "https://api.deepseek.com/models", chatUrl: "https://api.deepseek.com/chat/completions", keyHeader: "Authorization", keyPrefix: "Bearer " };
    case "kimi": {
      const base = options.region === "international" ? "https://api.moonshot.ai/v1" : "https://api.moonshot.cn/v1";
      if (options.region && options.region !== "china" && options.region !== "international") throw new Error("Kimi 区域无效。");
      return { url: `${base}/models`, chatUrl: `${base}/chat/completions`, keyHeader: "Authorization", keyPrefix: "Bearer " };
    }
    case "qwen": {
      const region = options.region || "ap-southeast-1";
      const workspace = options.workspaceId?.trim() ?? "";
      const regionNames: Record<string, string> = {
        "cn-beijing": "cn-beijing",
        "ap-southeast-1": "ap-southeast-1",
        "cn-hongkong": "cn-hongkong",
        "eu-central-1": "eu-central-1",
        "ap-northeast-1": "ap-northeast-1",
        "us-east-1": "us-east-1"
      };
      const regionName = regionNames[region];
      if (!regionName) throw new Error("百炼区域无效。");
      if (workspace && !/^[A-Za-z0-9-]{2,64}$/u.test(workspace)) throw new Error("百炼 Workspace ID 格式无效。");
      const sharedHosts: Record<string, string> = {
        "cn-beijing": "dashscope.aliyuncs.com",
        "ap-southeast-1": "dashscope-intl.aliyuncs.com",
        "cn-hongkong": "cn-hongkong.dashscope.aliyuncs.com",
        "us-east-1": "dashscope-us.aliyuncs.com"
      };
      if (!workspace && !sharedHosts[region]) throw new Error("此百炼区域需要填写有效的 Workspace ID。");
      const resolvedHost = workspace ? `${workspace}.${regionName}.maas.aliyuncs.com` : sharedHosts[region]!;
      const chatBase = `https://${resolvedHost}/compatible-mode/v1`;
      return { url: `https://${resolvedHost}/api/v1/models`, chatUrl: `${chatBase}/chat/completions`, keyHeader: "Authorization", keyPrefix: "Bearer " };
    }
    case "zhipu": {
      const endpoint = options.endpoint || "standard";
      if (endpoint !== "standard" && endpoint !== "coding") throw new Error("智谱接口类型无效。");
      return { url: endpoint === "coding" ? "https://open.bigmodel.cn/api/coding/paas/v4/models" : "https://open.bigmodel.cn/api/paas/v4/models", chatUrl: endpoint === "coding" ? "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions" : "https://open.bigmodel.cn/api/paas/v4/chat/completions", keyHeader: "Authorization", keyPrefix: "Bearer " };
    }
    case "xiaomi": {
      const authMethod = options.authMethod || "api-key";
      if (authMethod !== "api-key" && authMethod !== "token-plan") throw new Error("小米 MiMo 认证方式无效。");
      const region = options.region || "cn";
      const planHosts: Record<string, string> = { cn: "token-plan-cn.xiaomimimo.com", sgp: "token-plan-sgp.xiaomimimo.com", ams: "token-plan-ams.xiaomimimo.com" };
      if (authMethod === "token-plan" && !planHosts[region]) throw new Error("小米 Token Plan 区域无效。");
      const base = authMethod === "token-plan" ? `https://${planHosts[region]}/v1` : "https://api.xiaomimimo.com/v1";
      return { url: `${base}/models`, chatUrl: `${base}/chat/completions`, keyHeader: authMethod === "token-plan" ? "Authorization" : "api-key", ...(authMethod === "token-plan" ? { keyPrefix: "Bearer " } : {}) };
    }
    default: throw new Error("AI Provider 不在允许列表中。");
  }
}

export async function probeAiProvider(input: AiProviderInput): Promise<AiProviderProbe> {
  if (!providers.some((provider) => provider.id === input.providerId)) throw new Error("AI Provider 不在允许列表中。");
  if (!input.secret.trim() || input.secret.length > 4096) throw new Error("请输入有效的 API Key。");
  if (input.providerId === "zhipu") {
    return { status: "unverified", message: "智谱设置中心采用官方文档模型目录；官方目录不验证账户密钥，请确认 API Key 来自所选接口。", models: documentedZhipuModels.map((id) => ({ id, name: id })) };
  }

  const connection = resolveProvider(input.providerId, input.options);
  let response: Response;
  try {
    response = await fetch(connection.url, {
      method: "GET",
      headers: { [connection.keyHeader]: `${connection.keyPrefix ?? ""}${input.secret.trim()}`, Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
      redirect: "error"
    });
  } catch {
    throw new Error("连接 Provider 失败，请检查网络、区域与服务地址后重试。");
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("Provider 拒绝了 API Key，请检查密钥与认证方式。");
    throw new Error(`Provider 返回 HTTP ${response.status}，暂时无法读取模型目录。`);
  }
  const raw = await response.text();
  if (raw.length > 1_000_000) throw new Error("Provider 模型目录响应超过允许大小。");
  let payload: unknown;
  try { payload = JSON.parse(raw) as unknown; } catch { throw new Error("Provider 返回的数据不是有效 JSON。"); }
  const record = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};
  const list = Array.isArray(record.data) ? record.data : Array.isArray(record.models) ? record.models : Array.isArray(record.model_list) ? record.model_list : [];
  const models = list.flatMap((item) => {
    if (typeof item === "string" && item.length <= 160) return [{ id: item, name: item }];
    if (typeof item !== "object" || item === null) return [];
    const model = item as Record<string, unknown>;
    const id = typeof model.id === "string" ? model.id : typeof model.name === "string" ? model.name : "";
    if (!id || id.length > 160) return [];
    return [{ id, name: typeof model.name === "string" ? model.name : id }];
  }).slice(0, 500);
  if (!models.length) throw new Error("连接已成功，但 Provider 没有返回可用模型目录。");
  return { status: "connected", message: `连接成功，发现 ${models.length} 个模型。`, models };
}

type AiAccountRow = {
  id: string;
  provider_id: string;
  display_name: string;
  model_id: string;
  models_json: string;
  is_active: number;
  created_at: string;
};

export interface AiAccountView {
  id: string;
  providerId: string;
  displayName: string;
  modelId: string;
  models: Array<{ id: string; name: string }>;
  active: boolean;
  createdAt: string;
  hasSecret: true;
}

function mapAccount(row: AiAccountRow): AiAccountView {
  return { id: row.id, providerId: row.provider_id, displayName: row.display_name, modelId: row.model_id, models: JSON.parse(row.models_json) as AiAccountView["models"], active: row.is_active === 1, createdAt: row.created_at, hasSecret: true };
}

function accountRows(userId: string): AiAccountRow[] {
  return database.prepare("SELECT id, provider_id, display_name, model_id, models_json, is_active, created_at FROM ai_accounts WHERE user_id = ? ORDER BY created_at DESC").all(userId) as AiAccountRow[];
}

export function listAiAccounts(userId: string): AiAccountView[] {
  return accountRows(userId).map(mapAccount);
}

function getEncryptionKey(): Buffer {
  // 使用数据根目录中的稳定密钥文件，避免服务重启后无法解密已保存的 Provider 凭证。
  const keyPath = resolve(config.dataDirectory, "credentials", "settings.key");
  mkdirSync(dirname(keyPath), { recursive: true, mode: 0o700 });
  try {
    const key = readFileSync(keyPath);
    if (key.length !== 32) throw new Error("AI 密钥加密文件格式无效。");
    return key;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const key = randomBytes(32);
    try { writeFileSync(keyPath, key, { flag: "wx", mode: 0o600 }); }
    catch (writeError) {
      if ((writeError as NodeJS.ErrnoException).code !== "EEXIST") throw writeError;
      const existing = readFileSync(keyPath);
      if (existing.length !== 32) throw new Error("AI 密钥加密文件格式无效。");
      return existing;
    }
    return key;
  }
}

function encryptSecret(secret: string): { ciphertext: string; iv: string; tag: string } {
  // 每个密钥使用随机初始化向量和 GCM 认证标签，数据库中只保存密文。
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64url"), iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url") };
}

function decryptSecret(row: { secret_ciphertext: string; secret_iv: string; secret_tag: string }): string {
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(row.secret_iv, "base64url"));
  decipher.setAuthTag(Buffer.from(row.secret_tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(row.secret_ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export interface ActiveAiModelConfiguration {
  providerId: string;
  modelId: string;
  secret: string;
  chatUrl: string;
  keyHeader: string;
  keyPrefix: string;
}

/** 仅供服务端推理 Runtime 读取活动账户；此结果不得从 HTTP API 返回或写入日志。 */
export function resolveActiveAiModelConfiguration(userId: string): ActiveAiModelConfiguration | null {
  const row = database.prepare(`
    SELECT provider_id, options_json, model_id, secret_ciphertext, secret_iv, secret_tag
    FROM ai_accounts WHERE user_id = ? AND is_active = 1
  `).get(userId) as ({ provider_id: string; options_json: string; model_id: string; secret_ciphertext: string; secret_iv: string; secret_tag: string } | undefined);
  if (!row) return null;
  const connection = resolveProvider(row.provider_id, JSON.parse(row.options_json) as Record<string, string>);
  return {
    providerId: row.provider_id,
    modelId: row.model_id,
    secret: decryptSecret(row),
    chatUrl: connection.chatUrl,
    keyHeader: connection.keyHeader,
    keyPrefix: connection.keyPrefix ?? ""
  };
}

export async function saveAiAccount(userId: string, input: AiProviderInput & { displayName: string; modelId: string }): Promise<AiAccountView> {
  const displayName = input.displayName.trim();
  if (displayName.length < 1 || displayName.length > 48) throw new Error("账户名称需要为 1 到 48 个字符。");
  const probe = await probeAiProvider(input);
  if (!probe.models.some((model) => model.id === input.modelId)) throw new Error("所选模型不在该 Provider 返回的官方模型目录中。");
  const secret = encryptSecret(input.secret.trim());
  const id = randomUUID();
  try {
    database.prepare(`
      INSERT INTO ai_accounts (id, user_id, provider_id, display_name, options_json, model_id, models_json, secret_ciphertext, secret_iv, secret_tag)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, input.providerId, displayName, JSON.stringify(input.options), input.modelId, JSON.stringify(probe.models), secret.ciphertext, secret.iv, secret.tag);
  } catch (error) {
    if (String(error).includes("UNIQUE constraint failed: ai_accounts.user_id, ai_accounts.display_name")) throw new Error("此用户下已有同名 AI 账户。");
    throw error;
  }
  const row = accountRows(userId).find((account) => account.id === id);
  if (!row) throw new Error("AI 账户保存失败，请重试。");
  return mapAccount(row);
}

export async function reprobeAiAccount(userId: string, accountId: string): Promise<AiProviderProbe> {
  const row = database.prepare("SELECT provider_id, options_json, model_id, secret_ciphertext, secret_iv, secret_tag FROM ai_accounts WHERE user_id = ? AND id = ?").get(userId, accountId) as ({ provider_id: string; options_json: string; model_id: string; secret_ciphertext: string; secret_iv: string; secret_tag: string } | undefined);
  if (!row) throw new Error("找不到该 AI 账户。");
  const result = await probeAiProvider({ providerId: row.provider_id, options: JSON.parse(row.options_json) as Record<string, string>, secret: decryptSecret(row) });
  const nextModel = result.models.some((model) => model.id === row.model_id) ? row.model_id : result.models[0]?.id;
  database.prepare("UPDATE ai_accounts SET models_json = ?, model_id = COALESCE(?, model_id) WHERE user_id = ? AND id = ?").run(JSON.stringify(result.models), nextModel ?? null, userId, accountId);
  return result;
}

export function updateAiAccountModel(userId: string, accountId: string, modelId: string): AiAccountView {
  const row = database.prepare("SELECT id, provider_id, display_name, model_id, models_json, is_active, created_at FROM ai_accounts WHERE user_id = ? AND id = ?").get(userId, accountId) as AiAccountRow | undefined;
  if (!row) throw new Error("找不到该 AI 账户。");
  const models = JSON.parse(row.models_json) as AiAccountView["models"];
  if (!models.some((model) => model.id === modelId)) throw new Error("所选模型不在已保存的官方目录中，请先重新测试连接。");
  database.prepare("UPDATE ai_accounts SET model_id = ? WHERE user_id = ? AND id = ?").run(modelId, userId, accountId);
  return mapAccount({ ...row, model_id: modelId });
}

export function activateAiAccount(userId: string, accountId: string): AiAccountView {
  const account = database.prepare("SELECT id FROM ai_accounts WHERE user_id = ? AND id = ?").get(userId, accountId);
  if (!account) throw new Error("找不到该 AI 账户。");
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.prepare("UPDATE ai_accounts SET is_active = 0 WHERE user_id = ?").run(userId);
    database.prepare("UPDATE ai_accounts SET is_active = 1 WHERE user_id = ? AND id = ?").run(userId, accountId);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
  const row = accountRows(userId).find((item) => item.id === accountId);
  if (!row) throw new Error("无法读取已激活的 AI 账户。");
  return mapAccount(row);
}

export function deleteAiAccount(userId: string, accountId: string): void {
  database.prepare("DELETE FROM ai_accounts WHERE user_id = ? AND id = ?").run(userId, accountId);
}
