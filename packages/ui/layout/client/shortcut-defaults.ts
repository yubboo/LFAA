// 快捷键默认键位总表（唯一来源）：动作注册与悬停提示都从这里取，避免两处漂移。
//
// 命名空间约定：
// - 主命名空间是 Ctrl+Alt(+Shift)：`Ctrl+<字母>` / `Ctrl+Shift+<字母>` 会被 Chrome/Edge 截走
//   （保存、另存为、书签栏、强制刷新、DevTools、隐身窗等），`Alt+Shift(+字母)` 是 Windows 输入法切换，
//   `Ctrl+Alt+方向键` 会被显卡驱动当成屏幕旋转。
// - 三栏开合用方向键直觉键位 `Ctrl+←/→/↓`：浏览器不保留这组（页面能收到 keydown），
//   且输入框内仍然保留按词移动光标——全局监听在编辑区内只放行 Ctrl+Alt 组合，不会抢输入。
import { formatShortcutKeys, readShortcutKeysFor } from "./shortcuts";

/** 动作 id → 默认键位；键位 token 与 `shortcuts.ts` 的规范化结果保持一致（如 Comma / Slash / PageUp）。 */
export const DEFAULT_SHORTCUT_KEYS = {
  // 全局与壳层：方向键直觉组合给三栏，其余走 Ctrl+Alt
  "global.search": "Ctrl+Alt+K",
  "global.activity": "Ctrl+Alt+U",
  "global.toggle-left-sidebar": "Ctrl+Left",
  "global.toggle-right-panel": "Ctrl+Right",
  "global.maximize-right-panel": "Ctrl+Alt+M",
  "navigation.settings": "Ctrl+Alt+Comma",
  "navigation.shortcuts": "Ctrl+Alt+Slash",
  "navigation.library": "Ctrl+Alt+L",
  // 会话
  "session.new-chat": "Ctrl+Alt+N",
  "session.archive": "Ctrl+Alt+Shift+A",
  "session.pin": "Ctrl+Alt+Shift+P",
  "session.mark-unread": "Ctrl+Alt+Shift+U",
  "session.abort": "Ctrl+Alt+X",
  // 输入栏
  "composer.dictation": "Ctrl+Alt+V",
  "composer.reasoning": "Ctrl+Alt+R",
  // 工作台
  "workbench.new-tab": "Ctrl+Alt+B",
  "workbench.close-tab": "Ctrl+Alt+W",
  "workbench.next-tab": "Ctrl+Alt+PageDown",
  "workbench.prev-tab": "Ctrl+Alt+PageUp",
  "workbench.terminal": "Ctrl+Down",
  "workbench.review": "Ctrl+Alt+G",
  "workbench.side-ask": "Ctrl+Alt+S",
} as const;

/** 动作 id 联合类型：注册表与提示都必须命中这张表。 */
export type ShortcutActionId = keyof typeof DEFAULT_SHORTCUT_KEYS;

/** 某个动作的默认键位（注册表用）。 */
export function defaultShortcutKeys(id: ShortcutActionId): string {
  return DEFAULT_SHORTCUT_KEYS[id];
}

/** 某个动作当前生效键位的展示文本（悬停气泡用）；用户清空绑定后返回 undefined。 */
export function shortcutHint(id: ShortcutActionId): string | undefined {
  return formatShortcutKeys(readShortcutKeysFor(id, DEFAULT_SHORTCUT_KEYS[id])) || undefined;
}