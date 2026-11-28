// 安装中文应用菜单：Windows 上菜单缺失会连带 Ctrl+C/V/A 失效，所以编辑角色的快捷键必须显式保留；
// 同时提供按顶层菜单 ID 弹出原生子菜单的能力，供单行一体化顶栏点击唤起。
import { app, dialog, Menu, shell, type BrowserWindow, type MenuItemConstructorOptions } from "electron";

export type DesktopMenuId = "file" | "edit" | "view" | "help";

export interface ApplicationMenuOptions {
  /** 与 Web 入口共享的数据根，供「文件 → 打开数据目录」使用。 */
  dataRoot: string;
  /** 未打包运行：仅在此时露出重新加载与开发者工具。 */
  devMode: boolean;
}

/** 构建并安装应用菜单；重复调用会整体替换旧菜单。 */
export function installApplicationMenu(options: ApplicationMenuOptions): void {
  const viewSubmenu: MenuItemConstructorOptions[] = [
    { label: "实际大小", role: "resetZoom" },
    { label: "放大", role: "zoomIn" },
    { label: "缩小", role: "zoomOut" },
  ];
  if (options.devMode) {
    viewSubmenu.push(
      { type: "separator" },
      { label: "重新加载", role: "reload" },
      { label: "开发者工具", role: "toggleDevTools" },
    );
  }

  const template: MenuItemConstructorOptions[] = [
    {
      id: "file",
      label: "文件",
      submenu: [
        { label: "打开数据目录", click: () => void shell.openPath(options.dataRoot) },
        { type: "separator" },
        { label: "退出", role: "quit" },
      ],
    },
    {
      id: "edit",
      label: "编辑",
      submenu: [
        { label: "撤销", role: "undo" },
        { label: "重做", role: "redo" },
        { type: "separator" },
        { label: "剪切", role: "cut" },
        { label: "复制", role: "copy" },
        { label: "粘贴", role: "paste" },
        { label: "全选", role: "selectAll" },
      ],
    },
    { id: "view", label: "视图", submenu: viewSubmenu },
    {
      id: "help",
      label: "帮助",
      submenu: [
        { label: "关于 LFAA", click: () => showAboutDialog(options.dataRoot) },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/** 供单行顶栏菜单按钮调用：在指定窗口坐标下弹出对应的原生子菜单。 */
export function popupApplicationSubmenu(
  win: BrowserWindow | null,
  menuId: DesktopMenuId,
  x?: number,
  y?: number,
): void {
  if (!win || win.isDestroyed()) return;
  const submenu = Menu.getApplicationMenu()?.getMenuItemById(menuId)?.submenu;
  if (!submenu) return;
  submenu.popup({
    window: win,
    ...(typeof x === "number" && Number.isFinite(x) ? { x: Math.round(x) } : {}),
    ...(typeof y === "number" && Number.isFinite(y) ? { y: Math.round(y) } : {}),
  });
}

/** 关于弹窗：只展示运行态真实版本与数据目录，不编造更新状态。 */
function showAboutDialog(dataRoot: string): void {
  void dialog.showMessageBox({
    type: "info",
    title: "关于 LFAA",
    message: `LFAA 桌面端 ${app.getVersion()}`,
    detail: `Electron ${process.versions.electron}\nNode ${process.versions.node}\n数据目录：${dataRoot}`,
    buttons: ["确定"],
  });
}