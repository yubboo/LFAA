/** 统一 Overlay 层级语义；CSS 值由 layers.css 提供，业务代码不再散写 z-index 魔法数字。 */
export const UI_LAYER = Object.freeze({
  dock: "var(--lfaa-layer-dock)",
  header: "var(--lfaa-layer-header)",
  popover: "var(--lfaa-layer-popover)",
  tooltip: "var(--lfaa-layer-tooltip)",
  modal: "var(--lfaa-layer-modal)",
  toast: "var(--lfaa-layer-toast)",
});
