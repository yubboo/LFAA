/**
 * 文件：WorkbenchIcon.tsx
 * 作用：保留 App Shell 原有 WorkbenchIcon 源入口兼容性，并把真实实现转交 Workbench shared 模块。
 * 负责：重导出 WorkbenchIcon、WorkbenchIconName、WorkbenchIconProps。
 * 不负责：SVG path、样式、交互、布局或任何运行时状态。
 * 状态归属：无状态；真实 SVG Primitive 由 workbench/shared/WorkbenchIcon.tsx 拥有。
 * 对外接口：WorkbenchIcon、WorkbenchIconName、WorkbenchIconProps。
 * 关联文件：workbench/shared/WorkbenchIcon.tsx、workbench/shared/index.ts。
 * 修改注意事项：禁止在此复制图标实现；新增/修改图标进入 shared Owner。
 */
export { WorkbenchIcon, type WorkbenchIconName, type WorkbenchIconProps } from "./workbench/shared";
