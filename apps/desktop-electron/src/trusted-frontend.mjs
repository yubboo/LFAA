/**
 * 功能：验证桌面主窗口是否仍显示 LFAA 前端。
 * 作用：限制受信 IPC 只服务于当前桌面入口，阻止被导航的远程页面调用 preload 能力。
 * 关联文件：apps/desktop-electron/src/main.mjs、tests/native-browser-workspace.test.mjs。
 */
export function isTrustedFrontendUrl(candidate, expectedFrontendUrl) {
  try {
    const expected = new URL(expectedFrontendUrl);
    const actual = new URL(candidate, expected);
    if (expected.protocol === "file:") return actual.protocol === "file:" && actual.pathname === expected.pathname;
    return actual.origin === expected.origin;
  } catch {
    return false;
  }
}
