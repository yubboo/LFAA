/**
 * 功能：回归登录失败和恢复反馈不推挤认证表单。
 * 作用：确保反馈区域在无消息时仍保留稳定高度，防止提交后插入/移除提示引起卡片抖动。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const authView = readFileSync(new URL("../../../packages/client/ui-settings-account/src/AuthView.tsx", import.meta.url), "utf8");
const authStyles = readFileSync(new URL("../../../packages/client/ui-settings-account/src/auth.css", import.meta.url), "utf8");
const renderer = readFileSync(new URL("../../../packages/client/ui-renderer/src/App.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../../../packages/client/ui-settings/src/SettingsPage.tsx", import.meta.url), "utf8");
const slotRoot = readFileSync(new URL("../../../packages/client/ui-renderer/src/render.tsx", import.meta.url), "utf8");
const htmlEntry = readFileSync(new URL("../../../apps/web/index.html", import.meta.url), "utf8");

test("认证反馈始终占据固定消息位，错误提示不改变表单纵向布局", () => {
  assert.match(authView, /<div className="auth-page__form-message-slot" aria-live="polite" aria-atomic="true">\s*\{error && <Alert/u);
  assert.match(authStyles, /\.auth-page__form-heading\s*\{\s*margin-bottom:\s*0;/u);
  assert.match(authStyles, /\.auth-page__form-message-slot\s*\{[^}]*min-height:\s*48px;/su);
  assert.match(authStyles, /\.auth-page__form-message\s*\{[^}]*margin:\s*0;/su);
});

test("重复登录期间保留原错误反馈，按钮不因悬停而位移或渐变闪变", () => {
  const handleAuth = renderer.match(/async function handleAuth\(username: string, password: string\): Promise<void> \{([\s\S]*?)\n  \}/u)?.[1];
  assert.ok(handleAuth, "handleAuth must remain discoverable for this regression check");
  assert.match(handleAuth, /if \(authRequestInFlightRef\.current\) return;/u);
  assert.match(handleAuth, /authRequestInFlightRef\.current = true;/u);
  assert.match(handleAuth, /authRequestInFlightRef\.current = false;/u);
  assert.doesNotMatch(handleAuth, /setError\(null\)/u);
  assert.match(authStyles, /\.auth-page__form \.ant-btn-primary\s*\{[^}]*transition:\s*none;/su);
  assert.match(authStyles, /\.auth-page \.auth-page__form \.ant-btn-primary,\s*\.auth-page \.auth-page__form \.ant-btn-primary:disabled,\s*\.auth-page \.auth-page__form \.ant-btn-primary\[aria-busy="true"\]:disabled\s*\{[^}]*background:\s*var\(--settings-accent/u);
  assert.match(authView, /loading=\{busy \? \{ delay: 250 \} : false\}/u);
  assert.match(authView, /aria-busy=\{busy\}/u);
  assert.doesNotMatch(authStyles, /\.auth-page__form \.ant-btn-primary:not\(:disabled\):hover\s*\{[^}]*transform\s*:/su);
  assert.match(authView, /<ConfigProvider wave=\{\{ disabled: true \}\}>/u);
  assert.equal((authView.match(/disabled=\{busy \|\| serverState !== "online"\}/gu) ?? []).length, 2);
  assert.match(authView, /<Button type="link" block disabled=\{busy\} onClick=\{toggleRecoveryMode\}>/u);
});

test("认证成功后保持当前页面等待目标就绪，再执行设置控制的一镜到底转场", () => {
  assert.match(renderer, /authTransitionPhase !== "preparing" \|\| !user \|\| !userSettings/u);
  assert.match(renderer, /wallpaperEngine\.enabled && clientModulesReadyUserId !== user\.id/u);
  assert.match(renderer, /startViewTransition\(\(\) =>\s*\{\s*flushSync\(\(\) => setAuthTransitionPhase\("idle"\)\);/u);
  assert.match(renderer, /shouldReduceMotion\(userSettings\.appearance\.advanced\.reducedMotion\)/u);
  assert.match(renderer, /configuredAuthTransitionPluginId[\s\S]*authTransitionPlugins\.some/u);
  assert.match(slotRoot, /\[LFAA_AUTH_TRANSITION_SLOT\]: \{ kind: "list", scope: "root" \}/u);
  assert.match(authView, /name=\{LFAA_AUTH_TRANSITION_SLOT\}[\s\S]*owner=\{\{ phase: transitionPhase, reducedMotion \}/u);
  assert.doesNotMatch(authView.match(/owner=\{\{([^}]+)\}\}/u)?.[1] ?? "", /password|credential|token/iu);
  assert.match(settings, /title="登录进入动画"[\s\S]*authTransitionPluginId/u);
  assert.match(settings, /useDshSlotEntries\(LFAA_AUTH_TRANSITION_SLOT\)/u);
  assert.match(settings, /title="减少动态效果" description="开启后跳过登录进入动画/u);
  assert.match(authStyles, /::view-transition-group\(lfaa-auth-scene\)[\s\S]*animation-duration:\s*900ms/u);
  assert.doesNotMatch(authStyles, /auth-page-enter|auth-page__split-layout\s*\{[^}]*animation:/u);
});

test("刷新首帧不使用浏览器默认白底，工作区仅回用同一路由的内置图片提示", () => {
  assert.match(htmlEntry, /html,\s*body\s*\{[^}]*background-color:\s*#f3f5f8;[^}]*scrollbar-gutter:\s*stable;/su);
  assert.match(htmlEntry, /preference = cachedPreference === "dark" \|\| cachedPreference === "light" \|\| cachedPreference === "system" \? cachedPreference : "system"/u);
  assert.match(htmlEntry, /safeRoute && safeBackground/u);
  assert.match(htmlEntry, /lfaa\.appearance-canvas-bootstrap\.v1/u);
  assert.match(htmlEntry, /html\[data-lfaa-bootstrap-canvas="true"\]:not\(:has\(\.workbench-shell\)\) body/u);
  assert.match(htmlEntry, /document\.documentElement\.dataset\.lfaaBootstrapCanvas\s*=\s*"true"/u);
  assert.match(htmlEntry, /setProperty\("--lfaa-bootstrap-canvas-image"/u);
  assert.match(authStyles, /::view-transition-new\(lfaa-auth-scene\)/u);
});

test("登录页改为主题驱动的不透明居中卡片，默认凭据和注册入口唯一", () => {
  assert.match(authView, /默认登录名：<code>admin<\/code>　默认密码：<code>123456<\/code>/u);
  assert.doesNotMatch(authView, /首次初始化|创建超级管理员并进入/u);
  assert.doesNotMatch(renderer, /initializeAdmin|loadSetupStatus|requiresSetup/u);
  assert.match(authStyles, /\.auth-page \.auth-page__split-layout\s*\{[^}]*width:\s*min\(460px, 100%\);/su);
  assert.match(authStyles, /\.auth-page \.auth-page__form-panel\s*\{[^}]*backdrop-filter:\s*none;/su);
  assert.match(authStyles, /html\[data-lfaa-bootstrap-theme="dark"\] \.auth-page \.auth-page__form-panel/u);
  assert.match(settings, /title="默认账户安全提醒"/u);
  assert.match(settings, /登录用户名/u);
});
