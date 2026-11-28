// 桌面端单行一体化顶栏与 A1 三级色阶圆角主画布外框：
// Electron 桌面态渲染 34px 可拖拽顶栏并转发「文件 / 编辑 / 视图 / 帮助」到原生子菜单；
// 桌面态与 Web 态统一套用 A1 左一/左二微色阶分离与贴底贴右 14px 左上圆角主画布。
// 关联：apps/desktop/src/preload.ts、packages/ui/layout/client/shell/WorkbenchShell.tsx；运行环境：浏览器 / Electron 渲染进程。
import type { MouseEvent, ReactNode } from "react";
import styles from "./DesktopTitleBar.module.css";

type DesktopMenuId = "file" | "edit" | "view" | "help";

interface DesktopChromeBridge {
  isDesktop?: boolean;
  platform?: string;
  titleBarHeight?: number;
  popupMenu?: (menuId: DesktopMenuId, x?: number, y?: number) => void;
}

declare global {
  interface Window {
    __LFAA_DESKTOP_CHROME__?: DesktopChromeBridge;
  }
}

interface MenuEntry {
  id: DesktopMenuId;
  label: string;
}

const ZH_MENUS: readonly MenuEntry[] = [
  { id: "file", label: "文件" },
  { id: "edit", label: "编辑" },
  { id: "view", label: "视图" },
  { id: "help", label: "帮助" },
];

const EN_MENUS: readonly MenuEntry[] = [
  { id: "file", label: "File" },
  { id: "edit", label: "Edit" },
  { id: "view", label: "View" },
  { id: "help", label: "Help" },
];

function getDesktopChromeBridge(): DesktopChromeBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = window.__LFAA_DESKTOP_CHROME__;
  return bridge?.isDesktop ? bridge : null;
}

/** 桌面端单行顶栏：仅在 Electron 桌面环境挂载，右侧自动避让 Windows 原生窗口控制按钮。 */
function DesktopTitleBar({ bridge }: { bridge: DesktopChromeBridge }) {
  const isZh = typeof navigator === "undefined" || navigator.language.toLowerCase().startsWith("zh");
  const menus = isZh ? ZH_MENUS : EN_MENUS;

  const handlePopup = (menuId: DesktopMenuId, event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    bridge.popupMenu?.(menuId, rect.left, rect.bottom + 2);
  };

  return (
    <header className={styles.titleBar} data-region="desktop-titlebar">
      <div className={styles.brand} aria-hidden="true">
        <span className={styles.brandMark}>L</span>
      </div>

      <nav className={styles.menuBar} aria-label={isZh ? "应用菜单" : "Application menu"}>
        {menus.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.menuButton}
            onClick={(event) => handlePopup(item.id, event)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className={styles.dragSpacer} aria-hidden="true" />
    </header>
  );
}

/** 包裹四栏 WorkbenchShell：提供 A1 视觉外框，并在桌面态于顶部挂载 34px 单行顶栏。 */
export function DesktopChromeFrame({ children }: { children: ReactNode }) {
  const bridge = getDesktopChromeBridge();
  const isDesktop = Boolean(bridge);

  return (
    <div className={styles.frame} data-desktop-chrome={isDesktop ? "true" : "false"}>
      {bridge && <DesktopTitleBar bridge={bridge} />}
      <div className={styles.frameBody}>{children}</div>
    </div>
  );
}
