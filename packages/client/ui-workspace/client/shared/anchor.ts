// 浮层锚点矩形：项目行悬停卡、操作菜单与 store 共用的纯类型，避免 store 反向依赖组件。

/** 锚点元素相对视口的包围盒。 */
export interface HoverAnchorRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}