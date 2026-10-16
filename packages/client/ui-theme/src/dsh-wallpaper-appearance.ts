/**
 * 功能：把固定 DSH Wallpaper Engine Client 的实时外观令牌映射为 LFAA 共享主题令牌。
 * 作用：插件运行并拥有壁纸画布时，让 LFAA 对应表面即时读取同一组插件 Profile 值；停用时由调用方不装配此层，回到账户 Appearance。
 * 关联文件：packages/client/ui-layout/src/Workbench.tsx、packages/client/ui-layout/src/workbench.css、packages/client/ui-chat/src/ai-work-chat.css。
 */

export interface DshWallpaperAppearanceFallback {
  theme: "light" | "dark";
  accentColor: string;
  overlay: number;
  blur: number;
  canvasColor: string;
  surfaceColor: string;
  mutedSurfaceColor: string;
  hoverSurfaceColor: string;
  selectedSurfaceColor: string;
  inverseTextColor: string;
}

/**
 * 返回的 CSS 值只引用 DSH Client 已写入 body 的令牌，不复制插件状态，也不触发读取或订阅。
 * 百分比/色板 fallback 在插件 Client 完成初始化前保持 LFAA 当前主题可读；插件值出现后由 CSS 惰性解析即时接管。
 */
export function createDshWallpaperAppearanceTokens(
  fallback: DshWallpaperAppearanceFallback
): Record<string, string> {
  const boundedOverlay = Math.min(100, Math.max(0, fallback.overlay));
  const opacity = `var(--we-glass-alpha, ${boundedOverlay / 100})`;
  const floor = "var(--we-readability-floor, 0)";
  const base = `var(--we-readability-base, ${fallback.canvasColor})`;
  const tint = `var(--we-surface-tint-${fallback.theme}, ${fallback.surfaceColor})`;
  const mixSurface = (weight: number, fallbackColor: string) =>
    `color-mix(in srgb, ${base} calc(${floor} * 100%), color-mix(in srgb, var(--we-surface-tint-${fallback.theme}, ${fallbackColor}) calc(${opacity} * ${weight} * 100%), transparent) calc((1 - ${floor}) * 100%))`;
  const windowOpacity = "var(--we-settings-window-alpha, var(--we-glass-alpha, 0.15))";
  const leftSidebarOpacity = "var(--we-left-sidebar-alpha, var(--we-glass-alpha, 0.15))";
  const sidebarTint = "var(--we-sidebar-tint, calc(var(--we-glass-alpha, 0.15) * 100%))";
  const sidebarSurfaceWeight = fallback.theme === "dark" ? `calc(${sidebarTint} * 0.65)` : sidebarTint;
  const border = "rgba(180, 180, 180, var(--we-border-alpha, 0.35))";

  return {
    "--settings-accent": `var(--we-accent, ${fallback.accentColor})`, // 强调色：跟随插件配色滑杆，并在插件停用时回到账户色。
    "--color-brand": `var(--we-accent, ${fallback.accentColor})`, // 品牌控件填充：使用插件当前强调色。
    "--color-brand-hover": `color-mix(in srgb, var(--we-accent, ${fallback.accentColor}) 86%, var(--we-accent-ink, ${fallback.inverseTextColor}))`, // 品牌悬停：使用插件强调色及其可读前景。
    "--color-brand-deep": `color-mix(in srgb, var(--we-accent, ${fallback.accentColor}) 72%, ${fallback.canvasColor})`, // 深色品牌状态：插件强调色混入主题画布色。
    "--color-brand-subtle": `color-mix(in srgb, var(--we-accent, ${fallback.accentColor}) 14%, transparent)`, // 浅品牌底：插件强调色 14% 透明混合。
    "--color-brand-glow": `color-mix(in srgb, var(--we-accent, ${fallback.accentColor}) 24%, transparent)`, // 品牌光晕：插件强调色 24% 透明混合。
    "--color-focus-ring": `color-mix(in srgb, var(--we-accent, ${fallback.accentColor}) 34%, transparent)`, // 焦点环：插件强调色 34% 透明混合。
    "--color-text-inverse": `var(--we-accent-ink, ${fallback.inverseTextColor})`, // 强调色上的文字：使用插件计算的黑/白可读前景。
    "--color-canvas": mixSurface(0.9, fallback.canvasColor), // 工作画布：按插件可读性地板和玻璃色以 0.9 档合成。
    "--color-surface": mixSurface(1, fallback.surfaceColor), // 常规表面：按插件可读性地板和玻璃色以 1 档合成。
    "--color-surface-muted": mixSurface(0.9, fallback.mutedSurfaceColor), // 次级表面：按插件可读性地板和玻璃色以 0.9 档合成。
    "--color-surface-hover": mixSurface(1.1, fallback.hoverSurfaceColor), // 悬停表面：按插件可读性地板和玻璃色以 1.1 档合成。
    "--color-surface-selected": `color-mix(in srgb, var(--we-accent, ${fallback.accentColor}) 14%, ${mixSurface(1, fallback.selectedSurfaceColor)})`, // 选中表面：插件强调色 14% 混入玻璃底。
    "--color-border": border, // 普通边框：使用插件边框滑杆的中性灰与 Alpha。
    "--color-border-strong": border, // 强边框：使用插件边框滑杆的中性灰与 Alpha。
    "--color-border-subtle": border, // 细边框：使用插件边框滑杆的中性灰与 Alpha。
    "--color-border-soft": border, // 柔和边框：使用插件边框滑杆的中性灰与 Alpha。
    "--color-border-muted": border, // 弱化边框：使用插件边框滑杆的中性灰与 Alpha。
    "--settings-background-surface-opacity": "100%", // 表面令牌已含插件 Alpha，100% 防止 LFAA 再次衰减。
    "--settings-glass-blur": `var(--we-blur, ${fallback.blur}px)`, // 通用表面模糊：跟随插件全局模糊滑杆。
    "--settings-wallpaper-window-surface": `color-mix(in srgb, ${base} calc(${floor} * 100%), color-mix(in srgb, ${tint} calc(${windowOpacity} * 100%), transparent) calc((1 - ${floor}) * 100%))`, // 设置表面：使用插件设置窗口逐面透明度与全局玻璃色。
    "--settings-wallpaper-window-blur": `var(--we-settings-window-blur, var(--we-blur, ${fallback.blur}px))`, // 设置表面模糊：优先插件设置窗口逐面模糊。
    "--settings-wallpaper-chat-surface": `var(--we-chat-glass-fill, color-mix(in srgb, var(--we-chat-surface-tint-${fallback.theme}, ${tint}) calc(${opacity} * 100%), transparent))`, // 聊天表面：优先使用插件给对话栏生成的最终玻璃令牌。
    "--settings-wallpaper-chat-blur": `var(--we-blur, ${fallback.blur}px)`, // 聊天表面模糊：跟随插件全局模糊滑杆。
    "--settings-wallpaper-left-sidebar-surface": `color-mix(in srgb, ${base} calc(${floor} * 100%), color-mix(in srgb, ${tint} calc(${leftSidebarOpacity} * 100%), transparent) calc((1 - ${floor}) * 100%))`, // 左侧栏表面：使用插件左侧栏逐面 Alpha 和全局可读性地板。
    "--settings-wallpaper-left-sidebar-blur": `var(--we-left-sidebar-blur, var(--we-blur, ${fallback.blur}px))`, // 左侧栏模糊：优先插件左侧栏逐面值。
    "--settings-wallpaper-sidebar-surface": `color-mix(in srgb, ${base} calc(${floor} * 100%), color-mix(in srgb, var(--we-sidebar-color, ${tint}) ${sidebarSurfaceWeight}, transparent) calc((1 - ${floor}) * 100%))`, // 右侧栏表面：匹配插件浅色全权重与深色 65% 权重的侧栏面板配方。
    "--settings-wallpaper-sidebar-blur": `var(--we-sidebar-blur, var(--we-blur, ${fallback.blur}px))`, // 右侧栏模糊：优先插件侧栏逐面值。
    "--settings-wallpaper-floaters-surface": `color-mix(in srgb, var(--we-surface-tint-${fallback.theme}, ${fallback.surfaceColor}) calc(var(--we-floaters-alpha, ${boundedOverlay / 100}) * 90%), ${base} calc(max(${floor}, 0.82) * 100%))`, // 浮层表面：使用插件浮层透明度和可读性地板。
    "--settings-wallpaper-floaters-blur": `var(--we-floaters-blur, var(--we-blur, ${fallback.blur}px))`, // 浮层模糊：优先插件浮层逐面值。
  };
}
