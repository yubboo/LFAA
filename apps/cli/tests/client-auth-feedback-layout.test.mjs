/**
 * 功能：回归登录失败和恢复反馈不推挤认证表单。
 * 作用：确保反馈区域在无消息时仍保留稳定高度，防止提交后插入/移除提示引起卡片抖动。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const authView = readFileSync(new URL("../../../packages/client/ui-settings-account/src/AuthView.tsx", import.meta.url), "utf8");
const authStyles = readFileSync(new URL("../../../packages/client/ui-settings-account/src/auth.css", import.meta.url), "utf8");
const loginAppearance = readFileSync(new URL("../../../packages/client/ui-theme/src/login-appearance.ts", import.meta.url), "utf8");
const renderer = readFileSync(new URL("../../../packages/client/ui-renderer/src/App.tsx", import.meta.url), "utf8");
const workbench = readFileSync(new URL("../../../packages/client/ui-layout/src/Workbench.tsx", import.meta.url), "utf8");
const setupReminder = readFileSync(new URL("../../../packages/client/ui-settings-general/src/SetupReminder.tsx", import.meta.url), "utf8");
const passkeyPrompt = readFileSync(new URL("../../../packages/client/ui-settings-account/src/PasskeySetupPrompt.tsx", import.meta.url), "utf8");
const workbenchStyles = readFileSync(new URL("../../../packages/client/ui-layout/src/workbench.css", import.meta.url), "utf8");
const sharedThemeStyles = readFileSync(new URL("../../../packages/client/ui-theme/src/common.css", import.meta.url), "utf8");
const serviceStatus = readFileSync(new URL("../../../packages/client/ui-primitives/src/ServiceStatus.tsx", import.meta.url), "utf8");
const pluginModalStyles = readFileSync(new URL("../../../packages/client/ui-plugin-manager/src/PluginManagerPage.css", import.meta.url), "utf8");
const aiWorkModalStyles = readFileSync(new URL("../../../packages/client/ui-chat/src/ai-work-chat.css", import.meta.url), "utf8");
const writingModalStyles = `${readFileSync(new URL("../../../packages/client/ui-writing/src/normal/WritingBookSkillsPanel.css", import.meta.url), "utf8")}\n${readFileSync(new URL("../../../packages/client/ui-writing/src/normal/WritingCatalogPanel.css", import.meta.url), "utf8")}`;
const settings = readFileSync(new URL("../../../packages/client/ui-settings/src/SettingsPage.tsx", import.meta.url), "utf8");
const slotRoot = readFileSync(new URL("../../../packages/client/ui-renderer/src/render.tsx", import.meta.url), "utf8");
const htmlEntry = readFileSync(new URL("../../../apps/web/index.html", import.meta.url), "utf8");

test("认证反馈始终占据固定消息位，错误提示不改变表单纵向布局", () => {
  assert.match(authView, /<div className="auth-page__form-message-slot" aria-live="polite" aria-atomic="true">\s*\{error && <Alert/u);
  assert.match(authView, /notice && transitionPhase !== "idle"[\s\S]*?className="auth-page__login-wait" role="status"[\s\S]*?auth-page__black-hole/u);
  assert.match(authView, /notice \? <Alert className="auth-page__form-message" type="success"/u);
  assert.match(authStyles, /\.auth-page__form-heading\s*\{\s*margin-bottom:\s*0;/u);
  assert.match(authStyles, /\.auth-page__form-message-slot\s*\{[^}]*min-height:\s*48px;/su);
  assert.match(authStyles, /\.auth-page \.auth-page__form-message-slot\s*\{\s*min-height:\s*30px;/u);
  assert.match(authStyles, /\.auth-page__black-hole::before[\s\S]*?animation:\s*lfaa-login-black-hole-orbit/u);
  assert.match(authStyles, /\.auth-page\[data-reduced-motion="on"\] \.auth-page__black-hole::before[\s\S]*?animation:\s*none;/u);
  assert.match(authStyles, /prefers-reduced-motion:\s*reduce[\s\S]*?data-reduced-motion="system"[\s\S]*?animation:\s*none;/u);
  assert.match(authView, /transitionExiting \? \([\s\S]*?className="auth-page__transition-vortex"[\s\S]*?auth-page__transition-vortex-core[\s\S]*?auth-page__transition-vortex-orbit/u);
  assert.doesNotMatch(authView, /LoginTransitionScene|transition-shard|transition-particle/u);
  assert.doesNotMatch(authStyles, /auth-page__transition-scene|auth-page__transition-shard|auth-page__transition-particle|lfaa-auth-shard|lfaa-auth-particle/u);
  assert.match(authView, /transitionSettling \? " auth-page--transition-settling"/u);
  assert.match(authView, /event\.target === event\.currentTarget && event\.propertyName === "opacity"\) onTransitionSettle\?\.\(\)/u);
  assert.match(authStyles, /\.auth-page--transition-settling\s*\{[^}]*opacity:\s*0;[^}]*transition:\s*opacity 160ms cubic-bezier\(\.23, 1, \.32, 1\);/su);
  assert.match(authStyles, /\.auth-page\.auth-page--transition-exiting \.auth-page__split-layout\s*\{[^}]*transform-style:\s*preserve-3d;[^}]*perspective:\s*900px;[^}]*animation:\s*lfaa-auth-login-card-absorb 420ms cubic-bezier\(\.23, 1, \.32, 1\) both/u);
  assert.match(authStyles, /\.auth-page__transition-vortex\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*background:\s*radial-gradient\(ellipse at center/u);
  assert.match(authStyles, /\.auth-page--transition-exiting \.auth-page__transition-vortex\s*\{[^}]*animation:\s*lfaa-auth-vortex-veil 420ms/u);
  assert.match(authStyles, /@keyframes lfaa-auth-vortex-core[\s\S]*?transform:\s*scale\(1\.04\)/u);
  assert.match(authStyles, /@keyframes lfaa-auth-vortex-orbit[\s\S]*?rotateX\(58deg\) rotateZ\(72deg\)/u);
  assert.match(authStyles, /\.auth-page\[data-reduced-motion="on"\] \.auth-page__transition-vortex,[\s\S]*?animation:\s*none;/u);
  assert.match(authStyles, /\.auth-page__form-message\s*\{[^}]*margin:\s*0;/su);
});

test("内置登录转场保留 3D 并使用 CSS 变换，不分配逐帧 WebGL 资源", () => {
  assert.doesNotMatch(authView, /LoginTransitionScene|<canvas/u);
  assert.doesNotMatch(authStyles, /auth-page__transition-scene|requestAnimationFrame|WebGLRenderingContext|lfaa-auth-shard|lfaa-auth-particle/u);
  assert.match(authStyles, /transform-style:\s*preserve-3d;[\s\S]*perspective:\s*900px;/u);
  assert.match(authStyles, /@keyframes lfaa-auth-login-card-absorb[\s\S]*rotateX\(24deg\) rotateY\(-18deg\) scale\(\.12\) rotateZ\(14deg\)/u);
  assert.match(authStyles, /@keyframes lfaa-auth-vortex-orbit[\s\S]*rotateX\(58deg\) rotateZ\(72deg\)/u);
  assert.match(renderer, /setTimeout\(beginSettling, 520\)/u);
});

test("登录页品牌和引导文案使用紧凑的垂直间距", () => {
  assert.match(authStyles, /\.auth-page__brand-mark\s*\{[^}]*margin:\s*0 auto 8px;/su);
  assert.match(authStyles, /\.auth-page__brand-name\s*\{[^}]*margin-bottom:\s*16px;/su);
  assert.match(authStyles, /\.auth-page \.auth-page__form-eyebrow\s*\{[^}]*margin-bottom:\s*4px;/su);
  assert.match(authStyles, /\.auth-page \.auth-page__form-heading h2\.ant-typography\s*\{[^}]*margin-bottom:\s*4px;/su);
  assert.match(authStyles, /\.auth-page \.auth-page__form-heading p\.ant-typography\s*\{\s*margin:\s*0 0 6px;/su);
  assert.match(authStyles, /\.auth-page \.auth-page__default-credentials\s*\{[^}]*margin:\s*10px 0 0;/su);
  assert.match(authStyles, /\.auth-page \.auth-page__form-message-slot\s*\{\s*min-height:\s*30px;/u);
  assert.match(authStyles, /@media \(max-width:\s*520px\)[\s\S]*?\.auth-page \.auth-page__form-panel\s*\{\s*padding:\s*28px 22px 40px;/u);
});

test("登录页底部服务状态文案左置一行显示，恢复入口靠右", () => {
  assert.match(authView, /<div className="auth-page__form-support-row">\s*<ServiceStatus state=\{serverState\} compact \/>\s*<Button[\s\S]*?type="link"[\s\S]*?onClick=\{toggleRecoveryMode\}/u);
  assert.match(authView, /data-reduced-motion=\{loginAppearance\.advanced\.reducedMotion\}/u);
  assert.match(authView, /recoveryMode \? \([\s\S]*?className="auth-page__form-footnote"/u);
  assert.doesNotMatch(authView, /账户由本机服务管理|本机服务/u);
  assert.match(serviceStatus, /online:\s*"服务器正常"/u);
  assert.match(serviceStatus, /checking:\s*"正在检查服务器"/u);
  assert.match(serviceStatus, /offline:\s*"服务器未连接"/u);
  assert.match(serviceStatus, /aria-label=\{compact \? label : undefined\}/u);
  assert.match(serviceStatus, /tabIndex=\{compact \? 0 : undefined\}/u);
  assert.match(authStyles, /\.auth-page__form-support-row\s*\{[^}]*justify-content:\s*space-between;/su);
  assert.match(authStyles, /@media \(max-width:\s*520px\)\s*\{\s*\.auth-page__form-support-row\s*\{\s*justify-content:\s*space-between;\s*gap:\s*6px;/u);
  assert.match(authStyles, /\.auth-page__form-support-row > \.ant-btn-link\s*\{\s*flex:\s*0 0 auto;\s*padding-inline:\s*0;\s*white-space:\s*nowrap;/u);
  assert.match(authStyles, /@media \(max-width:\s*260px\)\s*\{\s*\.auth-page__form-support-row > \.ant-btn-link\s*\{\s*font-size:\s*var\(--font-size-sm, 12px\);/u);
  assert.match(authStyles, /\.auth-page__form-support-row \.service-status--compact\s*\{[^}]*width:\s*auto;[^}]*flex:\s*0 0 auto;[^}]*gap:\s*6px;[^}]*white-space:\s*nowrap;/su);
  assert.match(authStyles, /\.auth-page__form-support-row \.service-status--compact \.service-status__label\s*\{[^}]*position:\s*static;[^}]*width:\s*auto;[^}]*opacity:\s*1;[^}]*visibility:\s*visible;[^}]*white-space:\s*nowrap;/su);
  assert.doesNotMatch(authStyles, /\.service-status--compact:hover \.service-status__label/u);
  assert.doesNotMatch(authStyles, /\.auth-page\[data-reduced-motion="off"\][\s\S]*transition:\s*opacity 120ms ease, visibility 120ms/u);
  assert.doesNotMatch(authStyles, /\.service-status--compact \.service-status__label\s*\{[^}]*transition:[^;}]*(?:width|max-width|margin)/su);
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
  assert.match(authView, /<Button\s+type="link"[\s\S]*?disabled=\{busy\}[\s\S]*?onClick=\{toggleRecoveryMode\}/u);
});

test("窄登录支持行将恢复入口平滑缩短并保留完整无障碍名称", () => {
  assert.match(authView, /aria-label=\{recoveryMode \? "返回登录" : "忘记密码？使用恢复密钥找回"\}/u);
  assert.match(authView, /className="auth-page__recovery-link-copy" aria-hidden="true">[\s\S]*?className="auth-page__recovery-label auth-page__recovery-label--full">忘记密码？使用恢复密钥找回/u);
  assert.match(authView, /className="auth-page__recovery-label auth-page__recovery-label--compact">忘记密码？/u);
  assert.match(authStyles, /\.auth-page__recovery-link-copy\s*\{[^}]*overflow:\s*clip;/su);
  assert.match(authStyles, /container:\s*auth-recovery-link\s*\/\s*inline-size;/u);
  assert.match(authStyles, /@container auth-recovery-link\s*\(max-width:\s*280px\)/u);
  assert.match(authStyles, /transition:\s*opacity 140ms ease, transform 140ms ease, visibility 140ms;/u);
  assert.match(authStyles, /prefers-reduced-motion:\s*reduce[\s\S]*?\.auth-page\[data-reduced-motion="system"\] \.auth-page__recovery-label\s*\{\s*transition:\s*none;/u);
});

test("认证成功后先隐藏预热工作台，再把卡片吸入全屏视界；提醒只在完成后出现", () => {
  assert.match(renderer, /authTransitionPhase !== "preparing" \|\| !user \|\| !userSettings/u);
  assert.match(renderer, /wallpaperEngine\.enabled && clientModulesReadyUserId !== user\.id/u);
  assert.match(renderer, /authTransitionPluginId === "builtin"\)\s*\{\s*setAuthTransitionSceneReady\(true\);/u);
  assert.match(renderer, /onAuthTransitionWarmupReady=\{authTransitionPhase === "preparing" && authTransitionSceneReady && authTransitionPluginId === "builtin" \? handleWorkbenchAuthWarmupReady : undefined\}/u);
  assert.match(renderer, /authTransitionStaging=\{authTransitionPhase !== "idle"\}/u);
  assert.match(renderer, /if \(authTransitionActive && !authTransitionSettling\)/u);
  assert.match(renderer, /setAuthTransitionPhase\(\(current\) => current === "preparing" \? "entering" : current\)/u);
  assert.match(renderer, /const vortex = overlay\?\.querySelector<HTMLElement>\("\.auth-page__transition-vortex"\)/u);
  assert.match(renderer, /event\.target === vortex && event\.animationName === "lfaa-auth-vortex-veil"/u);
  assert.match(renderer, /setTimeout\(beginSettling, 520\)/u);
  assert.match(renderer, /setAuthTransitionSettling\(true\)/u);
  assert.match(renderer, /setTimeout\(finishBuiltinAuthTransition, 480\)/u);
  const builtinPath = renderer.match(/if \(animationId === "builtin"\) \{([\s\S]*?)\n    \}\s+let started/u)?.[1] ?? "";
  assert.ok(builtinPath, "the built-in transition must have its own lightweight path");
  assert.doesNotMatch(builtinPath, /startViewTransition|flushSync/u);
  assert.match(renderer, /startViewTransition\(\(\) =>\s*\{\s*flushSync\(\(\) => setAuthTransitionSceneReady\(true\)\);/u);
  assert.match(renderer, /transition\.finished\.then\(cleanup, cleanup\)/u);
  assert.match(renderer, /if \(!cancelled\) setAuthTransitionPhase\("idle"\)/u);
  assert.match(renderer, /authTransitionPhase !== "idle" && !authTransitionSceneReady/u);
  assert.match(renderer, /credentialReminder=\{authTransitionPhase === "idle" \? credentialReminder : null\}/u);
  assert.match(renderer, /suspendSetupReminder=\{credentialReminderChecking \|\| authTransitionPhase !== "idle"\}/u);
  assert.match(renderer, /transitionOnly/u);
  assert.match(renderer, /shouldReduceMotion\(userSettings\.appearance\.advanced\.reducedMotion\)/u);
  assert.match(renderer, /configuredAuthTransitionPluginId[\s\S]*authTransitionPlugins\.some/u);
  assert.match(workbench, /useLayoutEffect\(\(\) => onAuthTransitionWarmupReady\?\.\(\), \[onAuthTransitionWarmupReady\]\)/u);
  assert.match(workbench, /shell\.toggleAttribute\("inert", authTransitionStaging\)/u);
  assert.match(workbench, /shell\.setAttribute\("aria-hidden", "true"\)/u);
  assert.match(slotRoot, /\[LFAA_AUTH_TRANSITION_SLOT\]: \{ kind: "list", scope: "root" \}/u);
  assert.match(authView, /if \(transitionOnly\) \{\s*return transitionPluginId === "builtin" \|\| transitionPhase === "idle" \? null :/u);
  assert.match(authView, /if \(transitionOnly \|\| transitionOverlay \|\| serverState !== "online"\)/u);
  assert.match(authView, /name=\{LFAA_AUTH_TRANSITION_SLOT\}[\s\S]*owner=\{\{ phase: transitionPhase, reducedMotion \}/u);
  assert.doesNotMatch(authView.match(/owner=\{\{([^}]+)\}\}/u)?.[1] ?? "", /password|credential|token/iu);
  assert.match(settings, /title="登录进入动画"[\s\S]*authTransitionPluginId/u);
  assert.match(settings, /useDshSlotEntries\(LFAA_AUTH_TRANSITION_SLOT\)/u);
  assert.match(settings, /title="减少动态效果" description="开启后跳过登录进入动画/u);
  assert.match(authStyles, /html\[data-lfaa-auth-entry-animation\]:not\(\[data-lfaa-auth-entry-animation="builtin"\]\) \.auth-page,[\s\S]*html\[data-lfaa-auth-entry-animation\]:not\(\[data-lfaa-auth-entry-animation="builtin"\]\) \.workbench-shell\s*\{\s*view-transition-name:\s*lfaa-auth-scene;/u);
  assert.match(renderer, /transition\.ready\.then\(\(\)\s*=>\s*\{\s*if \(!cancelled\) root\.dataset\.lfaaAuthTransitionCaptured = "true";/u);
  assert.match(authStyles, /html\[data-lfaa-auth-transition-captured="true"\] \.workbench-shell\s*\{\s*visibility:\s*hidden;/u);
  assert.match(authStyles, /::view-transition-new\(lfaa-auth-scene\)\s*\{\s*opacity:\s*0 !important;\s*visibility:\s*hidden !important;/u);
  assert.match(authStyles, /html\[data-lfaa-auth-workbench-hidden="true"\] \.workbench-shell,[\s\S]*html\[data-lfaa-auth-transition-captured="true"\] \.workbench-shell\s*\{\s*visibility:\s*hidden;/u);
  assert.match(authStyles, /\.auth-page--transition-overlay\s*\{\s*position:\s*fixed;[\s\S]*inset:\s*0;/u);
  assert.match(renderer, /vortex\.removeEventListener\("animationend", handleAnimationEnd\);\s*vortex\.removeEventListener\("animationcancel", beginSettling\);\s*setAuthTransitionSettling\(true\);/u);
  assert.match(renderer, /transitionSettling=\{authTransitionSettling\}[\s\S]*onTransitionSettle=\{finishBuiltinAuthTransition\}/u);
  const cardMotion = authStyles.match(/@keyframes lfaa-auth-login-card-absorb\s*\{([\s\S]*?)\n\}/u)?.[1] ?? "";
  assert.match(cardMotion, /perspective\(900px\) translateZ\(-360px\) rotateX\(24deg\) rotateY\(-18deg\) scale\(\.12\) rotateZ\(14deg\)/u);
  assert.equal((cardMotion.match(/transform:/gu) ?? []).length, 2, "卡片 3D 路径保留完整起止状态");
  assert.match(authStyles, /animation:\s*lfaa-auth-login-card-absorb 420ms cubic-bezier\(\.23, 1, \.32, 1\) both, lfaa-auth-login-card-fade 420ms ease-out both/u);
  assert.match(authView, /transitionExiting \? \([\s\S]*?className="auth-page__transition-vortex"[\s\S]*?auth-page__transition-horizon[\s\S]*?auth-page__transition-vortex-core[\s\S]*?auth-page__transition-vortex-orbit/u);
  assert.doesNotMatch(authView, /auth-page__transition-shard|auth-page__transition-particle|Array\.from\(\{ length: (?:12|8) \}/u);
  assert.match(authStyles, /\.auth-page__transition-vortex\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*background:\s*radial-gradient\(ellipse at center/u);
  assert.match(authStyles, /\.auth-page__transition-horizon\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;/su);
  assert.doesNotMatch(authStyles.match(/\.auth-page__transition-vortex\s*\{([^}]+)\}/u)?.[1] ?? "", /position:\s*fixed/u);
  const veilMotion = authStyles.match(/@keyframes lfaa-auth-vortex-veil\s*\{([\s\S]*?)\n\}/u)?.[1] ?? "";
  assert.match(veilMotion, /from \{ opacity: 0; \}[\s\S]*to \{ opacity: \.76; \}/u);
  assert.doesNotMatch(veilMotion, /transform:|background-position:/u, "全屏遮罩只改变透明度");
  const coreStyle = authStyles.match(/\.auth-page__transition-vortex-core\s*\{([^}]+)\}/u)?.[1] ?? "";
  assert.match(coreStyle, /width:\s*min\(640px, max\(260px, 58vmin\), calc\(100vw - 24px\)\)/u);
  assert.match(coreStyle, /background:\s*radial-gradient\(circle, #000 0 43%[\s\S]*transparent 76%\)/u);
  assert.doesNotMatch(coreStyle, /box-shadow:|filter:/u, "黑洞核心避免额外模糊与阴影绘制");
  assert.match(coreStyle, /transform:\s*scale\(\.92\)/u);
  const orbitStyle = authStyles.match(/\.auth-page__transition-vortex-orbit\s*\{([^}]+)\}/u)?.[1] ?? "";
  assert.match(orbitStyle, /width:\s*min\(calc\(100vw - 24px\), 680px\)/u);
  assert.match(orbitStyle, /transform:\s*perspective\(900px\) rotateX\(58deg\) rotateZ\(-12deg\) scale\(\.9\)/u);
  const orbitMotion = authStyles.match(/@keyframes lfaa-auth-vortex-orbit\s*\{([\s\S]*?)\n\}/u)?.[1] ?? "";
  assert.match(orbitMotion, /rotateX\(58deg\) rotateZ\(-12deg\)[\s\S]*rotateX\(58deg\) rotateZ\(72deg\)/u);
  assert.match(authStyles, /data-reduced-motion="on"\] \.auth-page__transition-vortex,[\s\S]*data-reduced-motion="on"\] \.auth-page__transition-vortex-orbit[\s\S]*animation:\s*none;/u);
  assert.match(authStyles, /data-reduced-motion="system"\] \.auth-page__transition-vortex,[\s\S]*data-reduced-motion="system"\] \.auth-page__transition-vortex-orbit[\s\S]*animation:\s*none;/u);
  assert.doesNotMatch(authStyles, /auth-page__transition-scene|auth-page__transition-shard|auth-page__transition-particle|lfaa-auth-shard|lfaa-auth-particle/u);
});

test("默认凭据提醒复用首次配置提醒的弹窗、卡片与操作区", () => {
  assert.match(workbench, /<SetupReminder[\s\S]*?priorityPrompt=\{credentialReminder \? \{/u);
  assert.doesNotMatch(workbench, /credential-reminder-modal|title="建议修改默认登录凭据"/u);
  assert.equal((setupReminder.match(/<Modal\b/gu) ?? []).length, 1);
  assert.match(setupReminder, /const activePriorityPrompt = priorityPrompt\s+&& settings\.general\.notificationPopupsEnabled\s+&& !isSettingsPage\s+&& settings\.general\.defaultAdminCredentialReminderEnabled\s+&& !isCredentialReminderSnoozedToday\(user\.id, currentLocalDay\)\s+&& !isReminderSnoozedForLater\("credential"\)/u);
  assert.match(setupReminder, /open=\{settings\.general\.notificationPopupsEnabled && !isSettingsPage && \(Boolean\(activePriorityPrompt\) \|\| !suspended && open\)\}/u);
  assert.match(setupReminder, /title=\{promptTitle\}/u);
  assert.doesNotMatch(setupReminder, /introTitle|introDescription|setup-reminder-intro|WorkbenchIcon/u);
  assert.doesNotMatch(workbench, /introTitle:|icon: "settings"/u);
  assert.match(setupReminder, /activePriorityPrompt\.onAction\(\)/u);
  assert.match(setupReminder, /remindLater\("credential"\)\}>稍后再说/u);
  assert.match(setupReminder, /今日不再提醒/u);
  assert.match(setupReminder, /saveSettings\("general", \{ \.\.\.settings\.general, defaultAdminCredentialReminderEnabled: false \}\)/u);
  assert.match(setupReminder, /关闭后续提醒/u);
  assert.match(workbench, /suspended=\{suspendSetupReminder\}/u);
  assert.match(setupReminder, /activePriorityPrompt = priorityPrompt[\s\S]*settings\.general\.notificationPopupsEnabled[\s\S]*!isSettingsPage[\s\S]*settings\.general\.defaultAdminCredentialReminderEnabled\s*&& !isCredentialReminderSnoozedToday[\s\S]*&& !isReminderSnoozedForLater\("credential"\)/u);
  const reminderState = readFileSync(new URL("../../../packages/client/ui-settings-general/src/setup-reminder.ts", import.meta.url), "utf8");
  assert.match(reminderState, /lfaa:credential-reminder-snooze:\$\{userId\}/u);
  assert.match(reminderState, /凭据安全提醒单独暂停，不能连带隐藏首次配置提醒/u);
  assert.doesNotMatch(workbenchStyles, /\.credential-reminder-modal/u);
});

test("通知总开关关闭自动提醒与 AI 弹出通知，但不影响会话内卡片", () => {
  assert.match(settings, /title="通知总开关" description="关闭后停止工作台提醒、浏览器系统通知和通知提示音/u);
  assert.match(settings, /checked=\{settings\.general\.notificationPopupsEnabled\} onChange=\{\(\) => updateGeneral\(\{ notificationPopupsEnabled: !settings\.general\.notificationPopupsEnabled \}\)\}/u);
  assert.match(settings, /message="所有弹出提醒已暂停"/u);
  assert.match(settings, /onClick=\{\(\) => updateGeneral\(\{ notificationPopupsEnabled: true \}\)\}>恢复通知/u);
  assert.match(settings, /\$\{enabledLabel\}（总开关已暂停）/u);
  const notificationGroup = settings.match(/const notificationGroup = \([\s\S]*?\n  \);/u)?.[0] ?? "";
  assert.doesNotMatch(notificationGroup, /首次登录提醒|defaultAdminCredentialReminderEnabled|aiProviderReminderEnabled|setupReminderEnabled/u, "首次登录类别偏好由弹窗交互处理，不新增设置中心开关");
  assert.doesNotMatch(settings, /releaseAnnouncementEnabled/u, "版本公告仍使用通知总开关及按账户/版本确认记录");
  assert.doesNotMatch(settings, /AI Provider 今日不再提醒|业务存储今日不再提醒/u, "按日暂停仍由弹窗按账户和日期记录");
  assert.match(setupReminder, /if \(!settings\.general\.notificationPopupsEnabled\)\s*\{\s*setChecking\(false\);\s*setOpen\(false\);/u);
  assert.match(setupReminder, /open=\{settings\.general\.notificationPopupsEnabled && !isSettingsPage && \(Boolean\(activePriorityPrompt\) \|\| !suspended && open\)\}/u);
  assert.match(workbench, /if \(!settings\.general\.notificationPopupsEnabled\) return;/u);
  assert.match(workbench, /notificationToast && settings\.general\.notificationPopupsEnabled \?/u);
  assert.match(workbench, /<PasskeySetupPrompt[\s\S]*notificationPopupsEnabled=\{settings\.general\.notificationPopupsEnabled\}/u);
  assert.match(passkeyPrompt, /if \(!notificationPopupsEnabled \|\| isSettingsPage/u);
  assert.match(passkeyPrompt, /open=\{notificationPopupsEnabled && open\}/u);
});

test("General 设置保存失败恢复到最后一次服务端确认值", () => {
  const restore = settings.match(/function restorePersistedSettings<[\s\S]*?\n  function persistLatestSettings/u)?.[0];
  assert.ok(restore, "General rollback must stay next to the shared category save path");
  assert.match(restore, /settingsRevisionRef\.current\.set\(category, failedRevision \+ 1\)/u);
  assert.match(restore, /clearSettingsAutoSave\(category\)/u);
  assert.match(restore, /onSettingsChange\(next\)/u);
  assert.match(settings, /persistedSettingsRef\.current = \{ \.\.\.persistedSettingsRef\.current, \[category\]: result\.settings\[category\] \} as UserSettings/u);
  assert.match(settings, /catch \(saveError\) \{\s*if \(\(settingsRevisionRef\.current\.get\(category\) \?\? 0\) !== revision\) continue;\s*restorePersistedSettings\(category, revision\);\s*throw saveError;/u);
});

test("SteamCMD 配置并入项目与存储，首次登录只提醒业务内容数据目录", () => {
  assert.doesNotMatch(settings.match(/const sections:[\s\S]*?const SETTINGS_NAV_GROUPS/u)?.[0] ?? "", /id: "configuration", title: "SteamCMD 配置"/u);
  assert.match(settings, /function resolveSettingsSection\(section: SectionId\): SectionId\s*\{\s*return section === "configuration" \? "workspace" : section;/u);
  assert.match(settings, /if \(activeSection === "workspace"\)[\s\S]*?SettingGroup title="SteamCMD 工具配置"[\s\S]*?SettingGroup title="SteamCMD 安装与校验"[\s\S]*?SettingGroup title="游戏节点数据位置"/u);
  assert.match(settings, /saveSteamcmdConfigurationDefaults[\s\S]*saveSteamcmdStorageDefaults[\s\S]*saveSteamcmdNodeStorageSettings/u);
  assert.match(settings, /node\.storageConfigured \? \{ \.\.\.node\.storage \} : \{ \.\.\.steamcmdStorageDefaults \}/u);
  assert.match(settings, /function displaySteamcmdGamePath\([\s\S]*if \(node\) return displaySteamcmdPath\(node, relativePath\)[\s\S]*contentDirectory/u);
  assert.match(settings, /displaySteamcmdGamePath\(selectedSteamcmdStorageNode, steamcmdGameDirectoryToDisplay, projectStorageLocations\?\.contentDirectory\)/u);
  assert.match(settings, /SettingGroup title="SteamCMD 工具配置"[\s\S]*?SettingGroup title="SteamCMD 安装与校验"[\s\S]*?SettingGroup title="游戏节点数据位置"/u);
  assert.match(setupReminder, /选择业务内容数据目录/u);
  assert.doesNotMatch(setupReminder, /SteamCMD|Steam 游戏目录|游戏安装位置|loadSteamcmdSettings|storageDefaultsConfigured/u);
  assert.doesNotMatch(settings, /steamcmdGameDirectoryReminderEnabled/u);
});

test("账户安全提醒主按钮进入安全分类，包括已挂载的外观设置页", () => {
  assert.match(renderer, /returnedFromSettings && user && userSettings\) void updateCredentialReminder\(userSettings\)/u);
  assert.match(workbench, /onAction: \(\) => openSettings\("security"\)/u);
  assert.match(workbench, /const \[settingsSectionRequest, setSettingsSectionRequest\] = useState<\{ section: "ai" \| "permissions" \| "configuration" \| "account" \| "workspace" \| "security"; requestId: number \} \| null>\(null\)/u);
  assert.match(workbench, /if \(section\) setSettingsSectionRequest\(\{ section, requestId: \+\+settingsSectionRequestSequenceRef\.current \}\)/u);
  assert.match(workbench, /onNavigate\(section \? `\/settings\?section=\$\{encodeURIComponent\(section\)\}` : "\/settings"\)/u);
  assert.match(workbench, /sectionRequest=\{settingsSectionRequest\}/u);
  assert.match(settings, /sectionRequest\?: \{ section: "ai" \| "permissions" \| "configuration" \| "account" \| "workspace" \| "security"; requestId: number \} \| null/u);
  assert.match(settings, /const requestedSection = sectionRequest\?\.section;[\s\S]*?const targetSection = resolveSettingsSection\(requestedSection\);[\s\S]*?setActiveSection\(targetSection\);[\s\S]*?persistSettingsSection\(targetSection, user\.id\);/u);
  assert.match(settings, /url\.searchParams\.set\("section", section\)/u);
});

test("账户安全提醒弹窗明确提供更改与不更改，并使用统一尺寸和单一标题", () => {
  const credentialActions = setupReminder.match(/: activePriorityPrompt \? <>\s*<Space wrap className="setup-reminder-card__actions">([\s\S]*?)<\/Space>/u)?.[1] ?? "";
  assert.match(setupReminder, /rootClassName="setup-reminder-modal"/u);
  assert.match(setupReminder, /title=\{promptTitle\}/u);
  assert.match(setupReminder, /width=\{480\}/u);
  assert.ok(credentialActions.indexOf("disableCredentialReminder") >= 0 && credentialActions.indexOf("disableCredentialReminder") < credentialActions.indexOf("activePriorityPrompt.onAction()"), "credential reminder places 不更改 on the left and 更改 on the right");
  assert.match(setupReminder, /defaultAdminCredentialReminderEnabled: false/u);
  assert.match(setupReminder, /不更改会保留当前登录凭据，并关闭后续提醒；更改会打开安全设置，不会自动修改/u);
  assert.doesNotMatch(workbenchStyles, /setup-reminder-modal--priority|setup-reminder-intro/u);
  assert.match(workbenchStyles, /\.setup-reminder-modal \.setup-reminder-card__actions\.ant-space\s*\{[^}]*flex-wrap:\s*wrap;/u);
  assert.match(workbenchStyles, /var\(--settings-background-surface-opacity\)[\s\S]*var\(--settings-glass-blur\)/u);
  const aiActions = setupReminder.match(/missing\[0\] === "ai" && !activePriorityPrompt \? <>\s*<Space wrap className="setup-reminder-card__actions">([\s\S]*?)<\/Space>/u)?.[1] ?? "";
  assert.ok(aiActions.indexOf("disableReminder()") >= 0 && aiActions.indexOf("disableReminder()") < aiActions.indexOf('openReminderSettings("ai")'), "AI reminder places 不更改 on the left and 去配置模型 on the right");
  assert.doesNotMatch(renderer, /function dismissCredentialReminder\(/u);
  assert.doesNotMatch(renderer, /dismissDefaultCredentialReminder\(/u);
});

test("所有 Ant Design Portal 弹窗继承当前 Appearance 令牌并适配窄短屏", () => {
  assert.match(workbench, /const PORTAL_APPEARANCE_VARIABLES = \[[\s\S]*?"--color-surface"[\s\S]*?"--settings-background-surface-opacity"[\s\S]*?"--settings-glass-blur"/u);
  assert.match(workbench, /window\.getComputedStyle\(shell\)[\s\S]*?body\.style\.setProperty\(property, resolvedValue\)[\s\S]*?body\.setAttribute\("data-lfaa-theme", resolvedTheme\)[\s\S]*?body\.setAttribute\("data-lfaa-dialog-wallpaper"/u);
  assert.match(workbench, /\[resolvedTheme, settings\.appearance, wallpaperCanvasOwnership\.hasWallpaperBackground\]/u);
  const portalSurfaceRule = workbenchStyles.match(/body\[data-lfaa-theme\][^\{]*\{([^}]+)\}/u)?.[1];
  assert.ok(portalSurfaceRule, "body Portal overlay tokens must have a shared surface rule");
  assert.match(portalSurfaceRule, /border-color:\s*var\(--color-border\);\s*background:\s*var\(--color-surface\);\s*color:\s*var\(--color-text-primary\);/u);
  assert.doesNotMatch(workbenchStyles, /body\[data-lfaa-theme\][\s\S]{0,220}#(?:202020|e5e5e5)/u);
  assert.match(sharedThemeStyles, /\.ant-modal-root \.ant-modal\s*\{[^}]*max-width:\s*min\(calc\(100vw - 24px\), calc\(100% - 24px\)\);[^}]*max-height:\s*calc\(100dvh - 24px\);/u);
  assert.match(sharedThemeStyles, /\.ant-modal-root \.ant-modal-body\s*\{[^}]*overflow:\s*auto;[^}]*overscroll-behavior:\s*contain;/u);
  assert.match(sharedThemeStyles, /body\[data-lfaa-theme\] \.ant-modal-root \.ant-modal:not\(\.git-change-review-modal\):not\(\.lfaa-update-modal\)[\s\S]*?border-radius:\s*12px;[\s\S]*?\.ant-modal-header[\s\S]*?padding:\s*16px 18px 8px;[\s\S]*?\.ant-modal-body[\s\S]*?padding:\s*0 18px 14px;[\s\S]*?\.ant-modal-footer[\s\S]*?padding:\s*0 18px 16px;/u);
  assert.match(sharedThemeStyles, /body\[data-lfaa-dialog-wallpaper="true"\]:not\(\[data-we-wallpaper\]\)[\s\S]*?var\(--settings-background-surface-opacity\)[\s\S]*?var\(--settings-glass-blur\)/u);
  assert.match(sharedThemeStyles, /body\[data-we-wallpaper\]\[data-we-glass-floaters\] \.ant-modal-root \.ant-modal:not\(\.git-change-review-modal\):not\(\.lfaa-update-modal\)[\s\S]*?settings-wallpaper-floaters-surface[\s\S]*?settings-wallpaper-floaters-blur/u);
  assert.match(workbench, /body\.setAttribute\("data-lfaa-dialog-motion-effect", settings\.general\.dialogMotionEffect/u);
  assert.match(sharedThemeStyles, /data-lfaa-dialog-motion-effect="fluid"[\s\S]*?data-lfaa-dialog-motion-effect="fade"[\s\S]*?data-lfaa-dialog-motion-effect="lift"[\s\S]*?data-lfaa-dialog-motion-effect="none"/u);
  assert.match(sharedThemeStyles, /\.ant-modal-root\.lfaa-dialog-motion--fluid[\s\S]*?\.ant-modal-root\.lfaa-dialog-motion--fade[\s\S]*?\.ant-modal-root\.lfaa-dialog-motion--lift[\s\S]*?\.ant-modal-root\.lfaa-dialog-motion--none/u);
  assert.match(sharedThemeStyles, /\.ant-popover\.ant-zoom-big-enter[^\{]*:has\(\.ant-popconfirm\)[\s\S]*?var\(--lfaa-dialog-motion-enter\)/u);
  assert.match(sharedThemeStyles, /data-lfaa-reduced-motion="on"\]\s+\.ant-popover\.ant-zoom-big-enter[^\{]*:has\(\.ant-popconfirm\)[\s\S]*?lfaa-dialog-reduced-in/u);
  assert.match(sharedThemeStyles, /data-lfaa-reduced-motion="system"\]\s+\.ant-popover\.ant-zoom-big-leave[^\{]*:has\(\.ant-popconfirm\)[\s\S]*?lfaa-dialog-reduced-out/u);
  assert.match(settings, /统一控制应用对话框、确认弹窗和确认气泡/u);
  assert.doesNotMatch(workbenchStyles, /:is\([^)]*\.ant-modal-content/u);
  assert.doesNotMatch(pluginModalStyles, /\.plugin-manager-(?:install|detail)-modal \.ant-modal-content\s*\{[^}]*border-radius:/u);
  assert.doesNotMatch(aiWorkModalStyles, /\.ai-work-chat__(?:writing-review|feedback|branch)-modal \.ant-modal-content\s*\{/u);
  assert.doesNotMatch(writingModalStyles, /\.writing-(?:book-skills|catalog-panel)__modal \.ant-modal-content\s*\{[^}]*border-radius:/u);
  assert.match(sharedThemeStyles, /@media \(max-width: 520px\)[\s\S]*?\.ant-modal-root \.ant-modal\s*\{[^}]*max-width:\s*min\(calc\(100vw - 16px\), calc\(100% - 16px\)\);[^}]*max-height:\s*calc\(100dvh - 16px\);/u);
  assert.match(settings, /弹窗玻璃表面的底色透明度/u);
  assert.match(settings, /壁纸上的弹窗表面模糊强度/u);
});

test("账户凭据提醒的今日暂停按账户和本地日期隔离，不影响首次配置暂停", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key)
    } }
  });
  try {
    const { isCredentialReminderSnoozedToday, isSetupReminderSnoozedToday, setCredentialReminderSnoozedToday } = await import("../../../packages/client/ui-settings-general/src/setup-reminder.ts");
    assert.equal(setCredentialReminderSnoozedToday("user-a", "2026-10-18"), true);
    assert.equal(isCredentialReminderSnoozedToday("user-a", "2026-10-18"), true);
    assert.equal(isCredentialReminderSnoozedToday("user-a", "2026-10-19"), false);
    assert.equal(isCredentialReminderSnoozedToday("user-b", "2026-10-18"), false);
    assert.equal(isSetupReminderSnoozedToday("user-a", "2026-10-18"), false);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete globalThis.window;
  }
});

test("刷新首帧不使用浏览器默认白底，工作区仅回用同一路由的内置图片提示", () => {
  assert.match(htmlEntry, /html,\s*body\s*\{[^}]*background-color:\s*#f3f5f8;[^}]*scrollbar-gutter:\s*stable;/su);
  assert.match(htmlEntry, /preference = cachedPreference === "dark" \|\| cachedPreference === "light" \|\| cachedPreference === "system" \? cachedPreference : "system"/u);
  assert.match(htmlEntry, /safeRoute && safeBackground/u);
  assert.match(htmlEntry, /lfaa\.appearance-canvas-bootstrap\.v2/u);
  assert.match(htmlEntry, /html\[data-lfaa-bootstrap-canvas="true"\]:not\(:has\(\.workbench-shell\)\) body/u);
  assert.match(htmlEntry, /document\.documentElement\.dataset\.lfaaBootstrapCanvas\s*=\s*"true"/u);
  assert.match(htmlEntry, /setProperty\("--lfaa-bootstrap-canvas-image"/u);
  assert.match(authStyles, /::view-transition-new\(lfaa-auth-scene\)/u);
});

test("登录页沿用安全外观缓存中的设置且保留不透明居中卡片", () => {
  assert.match(authView, /默认登录名：<code>admin<\/code>　默认密码：<code>123456<\/code>/u);
  assert.doesNotMatch(authView, /首次初始化|创建超级管理员并进入/u);
  assert.doesNotMatch(renderer, /initializeAdmin|loadSetupStatus|requiresSetup/u);
  assert.match(authView, /useMemo\(\(\) => getCachedLoginAppearance\(username\), \[username\]\)/u);
  assert.match(authView, /resolveLoginAppearance\(loginAppearance, systemDark\)/u);
  assert.match(authView, /applyAppearanceThemeBootstrap\(loginAppearance\.theme, resolvedLoginAppearance\.theme\)/u);
  assert.match(authView, /data-theme=\{resolvedLoginAppearance\.theme\}/u);
  assert.match(authView, /appearanceTextFontStacks\[resolvedLoginAppearance\.fonts\.interface\]/u);
  assert.match(authView, /settings-background-overlay[\s\S]*resolvedLoginAppearance\.overlay/u);
  assert.match(loginAppearance, /appearance\.backgrounds\.login/u);
  assert.match(loginAppearance, /modeStyles/u);
  assert.match(loginAppearance, /legacyLoginBackgroundStorageKey/u);
  assert.match(workbench, /cacheLoginAppearance\(user\.username, initialSettings\.appearance\)/u);
  assert.match(workbench, /cacheLoginAppearance\(user\.username, result\.settings\.appearance\)/u);
  assert.match(settings, /if \(category === "appearance"\) cacheLoginAppearance\(user\.username, result\.settings\.appearance\)/u);
  assert.match(settings, /登录页（当前设备）/u);
  assert.match(authStyles, /\.auth-page \.auth-page__split-layout\s*\{[^}]*width:\s*min\(460px, 100%\);/su);
  assert.match(authStyles, /\.auth-page \.auth-page__form-panel\s*\{[^}]*backdrop-filter:\s*none;/su);
  assert.match(authStyles, /linear-gradient\(var\(--settings-background-overlay/u);
  assert.match(authStyles, /\.auth-page\[data-theme="dark"\] \.auth-page__form-panel/u);
  assert.match(authStyles, /--color-text-primary:\s*#e5e5e5/u);
  assert.doesNotMatch(settings, /默认账户安全提醒/u, "凭据提醒状态由程序管理，不在设置中心提供提醒开关");
  assert.match(settings, /登录用户名/u);
});
