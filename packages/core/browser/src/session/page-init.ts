// 内置浏览器页面初始化脚本，标记受控页面并关闭根滚动越界。
/** 注入到受控页面的纯字符串初始化脚本：避免 tsdown/esbuild 插桩 __name 辅助函数导致页面报 ReferenceError。 */
export const EMBEDDED_BROWSER_INIT_SCRIPT = [
  "window.__LFAA_EMBEDDED_BROWSER__ = true;",
  "(function () {",
  "  function applyOverscroll() {",
  "    if (document.getElementById('lfaa-browser-overscroll-guard')) return;",
  "    var style = document.createElement('style');",
  "    style.id = 'lfaa-browser-overscroll-guard';",
  "    style.textContent = 'html, body { overscroll-behavior: none !important; }';",
  "    var root = document.head || document.documentElement;",
  "    if (root) root.appendChild(style);",
  "  }",
  "  if (document.readyState === 'loading') {",
  "    document.addEventListener('DOMContentLoaded', applyOverscroll, { once: true });",
  "  } else {",
  "    applyOverscroll();",
  "  }",
  "})();",
].join("\n");
