/**
 * 功能：计算浏览器 Dock 截图请求的最短间隔。
 * 作用：限制连续页面修订触发的整页 JPEG 刷新频率，避免挤占用户交互。
 * 关联文件：BrowserPanel.tsx、apps/cli/tests/client-workspace-right-launcher-layout.test.mjs。
 */
export const BROWSER_SCREENSHOT_FRAME_INTERVAL_MS = 120;

export function browserScreenshotWaitMs(lastRequestAt: number, now: number): number {
  if (lastRequestAt <= 0) return 0;
  return Math.max(0, BROWSER_SCREENSHOT_FRAME_INTERVAL_MS - (now - lastRequestAt));
}
