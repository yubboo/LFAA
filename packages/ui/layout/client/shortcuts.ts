// 工作台快捷键基础设施：真实动作注册表元数据、键位标准化与匹配、冲突检测，以及浏览器本地键位持久化。
// 只提供纯逻辑与存储读写；动作由各插件注册（没注册的动作不会出现在设置页，也不会响应按键）。
import { readStoredJson, writeStoredJson } from "./shell/ui-preferences";
import type {
  WorkbenchShortcutContribution,
  WorkbenchShortcutState,
  WorkbenchShortcutText,
} from "../contract/index";

export type ShortcutGroup = WorkbenchShortcutContribution["group"];
export type ShortcutText = WorkbenchShortcutText;
/** 兼容可读命名：动作即契约里的注册项，快照即设置页/菜单消费的状态。 */
export type WorkbenchShortcutAction = WorkbenchShortcutContribution;
export type WorkbenchShortcutBinding = WorkbenchShortcutState;

/** 浏览器本地键位覆盖；缺失表示用默认，null 表示用户主动清除。 */
export type ShortcutBindingMap = Record<string, string | null>;

export const SHORTCUT_BINDINGS_KEY = "lfaa:shortcut-bindings:v1";

/** 快捷键判断只需要这几个字段，测试可直接传普通对象。 */
export interface ShortcutKeyEvent {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta", "CapsLock", "Dead"]);

/** 事件键名 → 稳定可读的存储与展示 token。 */
const KEY_TOKENS: Record<string, string> = {
  " ": "Space",
  Escape: "Esc",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ",": "Comma",
  ".": "Period",
  "/": "Slash",
  ";": "Semicolon",
  "'": "Quote",
  "[": "BracketLeft",
  "]": "BracketRight",
  "-": "Minus",
  "=": "Equal",
  "`": "Backquote",
  "\\": "Backslash",
};

function normalizeKeyToken(key: string): string | null {
  if (!key) return null;
  const mapped = KEY_TOKENS[key];
  if (mapped) return mapped;
  if (key.length === 1) return key.toUpperCase();
  return key;
}

/** 把一次按键规范成 `Ctrl+Alt+W` 形式；裸字母、裸修饰键与纯 Shift 组合返回 null。 */
export function normalizeShortcutEvent(event: ShortcutKeyEvent): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null;
  const key = normalizeKeyToken(event.key);
  if (!key) return null;
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Meta");
  const isFunctionKey = /^F(?:[1-9]|1[0-2])$/u.test(key);
  if (!isFunctionKey && parts.length === 0) return null;
  // 只剩 Shift 等价于输入大写，不应占用成快捷键。
  if (!isFunctionKey && parts.every((part) => part === "Shift")) return null;
  return [...parts, key].join("+");
}

/** 展示用键位文本：把存储 token 还原成符号，macOS 上把 Meta 显示成 Cmd。 */
export function formatShortcutKeys(keys: string | null): string {
  if (!keys) return "";
  const isMac = typeof navigator !== "undefined" && /mac/iu.test(navigator.platform);
  const display = keys
    .replace(/(^|\+)Comma(?=\+|$)/u, "$1,")
    .replace(/(^|\+)Period(?=\+|$)/u, "$1.")
    .replace(/(^|\+)Slash(?=\+|$)/u, "$1/")
    .replace(/(^|\+)Semicolon(?=\+|$)/u, "$1;")
    .replace(/(^|\+)Quote(?=\+|$)/u, "$1'")
    .replace(/(^|\+)BracketLeft(?=\+|$)/u, "$1[")
    .replace(/(^|\+)BracketRight(?=\+|$)/u, "$1]")
    .replace(/(^|\+)Minus(?=\+|$)/u, "$1-")
    .replace(/(^|\+)Equal(?=\+|$)/u, "$1=")
    .replace(/(^|\+)Backquote(?=\+|$)/u, "$1`")
    .replace(/(^|\+)Backslash(?=\+|$)/u, "$1\\");
  return isMac ? display.replace(/(^|\+)Meta(?=\+|$)/u, "$1Cmd") : display;
}

/** 判断当前按键是否命中绑定键位。 */
export function matchesShortcut(keys: string, event: ShortcutKeyEvent): boolean {
  return normalizeShortcutEvent(event) === keys;
}

/** 读取本地键位覆盖；数据损坏时回退为空表。 */
export function readShortcutBindings(): ShortcutBindingMap {
  const raw = readStoredJson<unknown>(SHORTCUT_BINDINGS_KEY, null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const map: ShortcutBindingMap = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null || typeof value === "string") map[id] = value;
  }
  return map;
}

/** 按动作 id 取当前生效键位；未改键时回退默认值，供工具提示使用。 */
export function readShortcutKeysFor(id: string, defaultKeys: string | null): string | null {
  const bindings = readShortcutBindings();
  return Object.prototype.hasOwnProperty.call(bindings, id) ? (bindings[id] ?? null) : defaultKeys;
}

/** 写回本地键位覆盖。 */
export function writeShortcutBindings(bindings: ShortcutBindingMap): void {
  writeStoredJson(SHORTCUT_BINDINGS_KEY, bindings);
}

/** 合并默认键位与用户覆盖，生成设置页与全局监听共用的清单（按注册顺序）。 */
export function resolveShortcutBindings(
  actions: WorkbenchShortcutAction[],
  stored: ShortcutBindingMap,
): WorkbenchShortcutBinding[] {
  return actions.map((action) => ({
    id: action.id,
    group: action.group,
    title: action.title,
    description: action.description,
    keys: Object.prototype.hasOwnProperty.call(stored, action.id) ? (stored[action.id] ?? null) : action.defaultKeys,
    defaultKeys: action.defaultKeys,
  }));
}

/** 找出与目标键位冲突的其它动作（同组或跨组都算冲突，避免按一次触发两个）。 */
export function findShortcutConflict(
  bindings: WorkbenchShortcutBinding[],
  keys: string,
  excludeId: string,
): WorkbenchShortcutBinding | undefined {
  const normalized = keys.trim().toLowerCase();
  if (!normalized) return undefined;
  return bindings.find((item) => item.id !== excludeId && item.keys?.toLowerCase() === normalized);
}

/** 输入框、文本域与可编辑区域里不触发工作台快捷键，避免抢输入。 */
export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  const element = target as (HTMLElement & { tagName?: string }) | null;
  if (!element || typeof element.tagName !== "string") return false;
  const tag = element.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || element.isContentEditable === true;
}
