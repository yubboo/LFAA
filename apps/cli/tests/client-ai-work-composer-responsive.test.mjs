/**
 * 功能：锁定 AI Work 提问框响应、悬停提示避让、操作栏排布与插入光标可见性。
 * 作用：防止 TextArea 撑出聊天列或被 Tooltip 遮盖，关联选择器随容器排布，并保证光标跟随主题文字颜色。
 * 关联文件：packages/client/ui-chat/src/AiWorkChat.tsx、AiUsageFooter.tsx 与 ai-work-chat.css。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chatStyles = readFileSync(new URL("../../../packages/client/ui-chat/src/ai-work-chat.css", import.meta.url), "utf8");
const chatSource = readFileSync(new URL("../../../packages/client/ui-chat/src/AiWorkChat.tsx", import.meta.url), "utf8");
const usageFooterSource = readFileSync(new URL("../../../packages/client/ui-chat/src/AiUsageFooter.tsx", import.meta.url), "utf8");
const projectPickerSource = readFileSync(new URL("../../../packages/client/ui-chat/src/WorkspaceProjectPicker.tsx", import.meta.url), "utf8");
const composerRule = chatStyles.match(/^\.ai-work-chat__composer\s*\{([^}]*)\}/mu)?.[1] ?? "";
const composerFocusRule = chatStyles.match(/^\.ai-work-chat__composer:focus-within\s*\{([^}]*)\}/mu)?.[1] ?? "";
const composerInputRule = chatStyles.match(/^\.ai-work-chat__composer \.ant-input(?:\.[\w-]+)*\s*\{([^}]*)\}/mu)?.[1] ?? "";
const messageStageRule = chatStyles.match(/^\.ai-work-chat__message-stage\s*\{([^}]*)\}/mu)?.[1] ?? "";
const messageListRule = chatStyles.match(/^\.ai-work-chat__message-list\s*\{([^}]*)\}/mu)?.[1] ?? "";
const anchorRule = chatStyles.match(/^\.ai-work-chat__anchors\s*\{([^}]*)\}/mu)?.[1] ?? "";

test("项目与会话用量在后台读取期间保留稳定且真实的状态", () => {
  assert.match(projectPickerSource, /projectListStatus === "loading" \? unresolvedProjectTitle/u);
  assert.match(chatSource, /setSessionUsageLoadState\("ready"\)[\s\S]*?setSessionUsageLoadState\("error"\)/u);
  assert.match(chatSource, /usageLoadState=\{sessionUsageLoadState\}/u);
  assert.match(usageFooterSource, /usageLoadState === "loading" \? "正在读取会话用量…"/u);
  assert.match(usageFooterSource, /usageLoadState === "error" \? "会话用量读取失败"/u);
  assert.match(usageFooterSource, /hasAssistantMessage \? "Provider 未返回用量"/u);
  assert.match(chatStyles, /\.ai-work-chat__usage-footer\s*\{[^}]*min-height:\s*25px/u);
});

test("模型按钮显示当前模型和真实推理档位，悬浮提示只显示动作与已配置快捷键", () => {
  assert.match(chatSource, /accountLoadState === "ready" \? effectiveAiAccount\(accounts\) : undefined/u);
  assert.match(chatSource, /\[activeModel\.name, composerReasoningLabel\]/u);
  assert.match(chatSource, /aria-busy=\{accountLoadState === "loading" \|\| modelBusy\}/u);
  assert.match(chatSource, /const composerReasoningLabel = activeModel\?\.thinkingSource === "provider-model-catalog"[\s\S]*?reasoningModeLabel\(activeReasoningMode\)/u);
  assert.match(chatSource, /const composerModelLabel = activeAccount[\s\S]*?\[activeModel\.name, composerReasoningLabel\]/u);
  assert.match(chatSource, /<span className="ai-work-chat__composer-control-label">\{composerModelLabel\}<\/span>/u);
  assert.match(chatSource, /title=\{modelPickerTooltipTitle\}/u);
  assert.match(chatSource, /<span>选择推理强度<\/span>\{modelPickerShortcutLabel \? <kbd>\{modelPickerShortcutLabel\}<\/kbd>/u);
  assert.match(chatSource, /settings\.shortcuts\.openModelPicker\.filter\(Boolean\)\.join\(" \/ "\)/u);
  assert.doesNotMatch(chatSource.match(/const modelPickerTooltipTitle = ([\s\S]*?)\n  const modelPickerContent/u)?.[1] ?? "", /displayName|providerId|model\.id|modelId/u);
  assert.match(chatSource, /shortcutMatches\(event, chord\)/u);
  assert.match(chatSource, /window\.addEventListener\("keydown", handleModelPickerShortcut\)[\s\S]*?window\.removeEventListener\("keydown", handleModelPickerShortcut\)/u);
  assert.doesNotMatch(chatSource, /ai-work-chat__model-version-tag/u);
  assert.match(chatStyles, /\.ai-work-chat__composer-control--model\.ant-btn\s*\{[^}]*width:\s*auto/u);
  assert.match(chatStyles, /\.ai-work-chat__composer-control--model \.ai-work-chat__composer-control-label\s*\{[^}]*display:\s*block/u);
});

test("窄中间栏的提问框及 TextArea 随容器收缩，不由隐式 Grid 最小宽度撑开", () => {
  assert.match(composerRule, /min-width:\s*0\s*;/u);
  assert.match(composerRule, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/u);
  assert.match(composerInputRule, /width:\s*100%\s*;/u);
  assert.match(composerInputRule, /min-width:\s*0\s*;/u);
});

test("AI Work 消息从顶部稳定向下排列，展开记录不会在消息间补出空白", () => {
  assert.match(messageListRule, /min-height:\s*100%/u);
  assert.match(messageListRule, /justify-content:\s*flex-start/u);
  assert.doesNotMatch(messageListRule, /justify-content:\s*flex-end/u);
  assert.match(chatSource, /onClickCapture=\{handleResponseProcessClickCapture\}/u);
  assert.match(chatSource, /if \(!details\.open && responseProcessDetailsRef\.current\.size === 0\) responseProcessUserScrolledRef\.current = false/u);
  assert.match(chatSource, /responseProcessDetailsRef\.current\.size === 0[\s\S]*?updateResponseProcessFollowState/u);
});

test("AI Work 输入光标跟随当前文字颜色，避免浅色背景上不可见", () => {
  assert.match(composerInputRule, /caret-color:\s*var\(--we-caret-color,\s*currentColor\)\s*;/u);
  assert.doesNotMatch(composerInputRule, /caret-color:\s*currentColor\s*!important/u);
});

test("输入框交互边框与外观设置驱动的毛玻璃背景使用独立图层", () => {
  const composerSurfaceRule = chatStyles.match(/^\.ai-work-chat__composer::before\s*\{([^}]*)\}/mu)?.[1] ?? "";
  const composerGlassRule = chatStyles.match(/body\[data-we-wallpaper\]\[data-we-glass-chat\][^\n]*\.ai-work-chat__composer::before\s*\{([^}]*)\}/u)?.[1] ?? "";

  assert.match(composerRule, /isolation:\s*isolate\s*;/u);
  assert.match(composerRule, /background:\s*transparent\s*;/u);
  assert.match(composerRule, /backdrop-filter:\s*none\s*;/u);
  assert.match(composerSurfaceRule, /backdrop-filter:\s*blur\(var\(--settings-glass-blur\)\)\s*;/u);
  assert.match(composerSurfaceRule, /background:\s*color-mix\(in srgb, var\(--color-surface\) 94%, transparent\)\s*;/u);
  assert.match(composerGlassRule, /backdrop-filter:\s*blur\(var\(--settings-wallpaper-chat-blur, var\(--settings-glass-blur\)\)\)/u);
  assert.match(composerFocusRule, /border-color:/u);
  assert.doesNotMatch(composerFocusRule, /backdrop-filter|background(?:-color|-image)?:/u);
});

test("中屏输入区悬停不触发卡片变化、无阴影且空闲时不虚化操作", () => {
  const controlRule = chatStyles.match(/^\.ai-work-chat__composer-control\.ant-btn\s*\{([^}]*)\}/mu)?.[1] ?? "";
  const submitRule = chatStyles.match(/^\.ai-work-chat__composer-submit\.ant-btn\s*\{([^}]*)\}/mu)?.[1] ?? "";
  const outputBlurTransitionRule = chatStyles.match(/\.workbench-shell\[data-ai-work-output-focus-blur="true"\] \.ai-work-chat \.ai-work-chat__messages,[\s\S]*?\{\s*transition:\s*filter[^}]*\}/u)?.[0] ?? "";
  const outputBlurIdleRule = chatStyles.match(/\.workbench-shell\[data-ai-work-output-focus-blur="true"\] \.ai-work-chat\[data-output-idle="true"\] \.ai-work-chat__messages,[\s\S]*?\{[^}]*filter:\s*blur/u)?.[0] ?? "";

  assert.match(composerRule, /box-shadow:\s*none\s*;/u);
  assert.match(composerRule, /transition:\s*border-color 200ms cubic-bezier\(\.2,\.8,\.2,1\)/u);
  assert.doesNotMatch(chatStyles, /^\.ai-work-chat__composer:hover\s*\{/mu);
  assert.doesNotMatch(composerFocusRule, /box-shadow:/u);
  assert.doesNotMatch(composerFocusRule, /(?:display|position|width|height|min-width|max-width|padding|margin|transform|inset|top|left|right|bottom)\s*:/u);
  assert.match(controlRule, /transition:\s*background-color 200ms cubic-bezier\(\.2,\.8,\.2,1\)/u);
  assert.match(submitRule, /transition:\s*background-color 200ms cubic-bezier\(\.2,\.8,\.2,1\)/u);
  assert.doesNotMatch(outputBlurTransitionRule, /composer-(?:context|actions)/u);
  assert.doesNotMatch(outputBlurIdleRule, /composer-(?:context|actions)/u);
  assert.match(chatStyles, /\.workbench-shell\[data-reduced-motion="on"\] \.ai-work-chat__composer-control/u);
  assert.match(chatStyles, /\.workbench-shell\[data-reduced-motion="on"\] \.ai-work-chat__composer-submit/u);
  assert.match(chatStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.ai-work-chat__composer-control\.ant-btn[\s\S]*transition-duration:\s*0ms/u);
});

test("窄聊天列为正文增加容器比例留白，锚点仍固定在消息舞台左侧", () => {
  assert.match(messageStageRule, /position:\s*relative\s*;/u);
  assert.match(messageListRule, /padding:\s*22px\s+clamp\(20px,\s*3%,\s*32px\)\s+12px\s*;/u);
  assert.match(anchorRule, /left:\s*0\s*;/u);
});

test("模型缺失提示文案简洁，窄容器内操作另起说明行并跳转到 AI 与模型配置", () => {
  assert.match(chatSource, /className="ai-work-chat__provider-setup-alert"[\s\S]*message="尚未配置大模型"[\s\S]*description=\{<Button className="ai-work-chat__provider-setup-action" size="small" onClick=\{\(\) => onOpenSettings\("ai"\)\}>去配置模型<\/Button>\}/u);
  assert.doesNotMatch(chatSource, /配置后即可开始使用小鱼智能体/u);
  assert.match(chatStyles, /\.ai-work-chat__provider-setup-alert\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/u);
  assert.match(chatStyles, /\.ai-work-chat__provider-setup-action\s*\{[^}]*max-width:\s*100%/u);
});

test("应用和能力选择放进紧凑的更多菜单，权限与模型操作继续可见", () => {
  const leftGroupStart = chatSource.indexOf('aria-label="添加、权限与更多操作"');
  const rightGroupStart = chatSource.indexOf('aria-label="模型、推理与发送"');
  const permissionControl = chatSource.indexOf("ai-work-chat__composer-control--permission", leftGroupStart);
  const moreControl = chatSource.indexOf("ai-work-chat__composer-control--more", leftGroupStart);
  const moreContentStart = chatSource.indexOf("const composerMoreContent");
  const actionsRule = chatStyles.match(/^\.ai-work-chat__composer-actions\s*\{([^}]*)\}/mu)?.[1] ?? "";

  assert.ok(leftGroupStart >= 0 && rightGroupStart > leftGroupStart);
  assert.ok(permissionControl > leftGroupStart && moreControl > permissionControl && moreControl < rightGroupStart);
  assert.ok(moreContentStart >= 0 && moreContentStart < leftGroupStart);
  assert.ok(chatSource.includes('composerMoreSection === "applications" ? "关联应用" : "Skill / 提示词 / 专家"'));
  assert.match(chatSource, /overlayClassName="ai-work-chat__more-overlay"/u);
  assert.match(actionsRule, /flex-wrap:\s*wrap\s*;/u);
  assert.match(chatSource, /aria-description="关联只提供参考，小鱼按目标决定是否加载。"/u);
});

test("更多菜单采用纵向操作行，选择面板限制最大宽高并跟随视口滚动", () => {
  assert.match(chatStyles, /\.ai-work-chat__more-menu\s*\{[^}]*display:\s*grid/u);
  assert.match(chatStyles, /\.ai-work-chat__more-menu-item\s*\{[^}]*grid-template-columns:\s*20px\s+minmax\(0,\s*1fr\)\s+auto\s+14px/u);
  assert.match(chatStyles, /\.workbench-shell \.ai-work-chat__more-overlay \.ant-popover-inner\s*\{[^}]*max-height:\s*min\(420px,\s*calc\(100dvh - 24px\)\)/u);
  assert.match(chatStyles, /\.ai-work-chat__more-menu-picker > \.ant-select\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/u);
  assert.match(chatStyles, /data-we-glass-floaters[^\n]*ai-work-chat__more-overlay \.ant-popover-inner/u);
  assert.match(chatStyles, /data-background-image="true"[^\n]*ai-work-chat__more-overlay/u);
  assert.ok(chatStyles.includes('.workbench-shell[data-reduced-motion="on"] .ai-work-chat__more-overlay'));
  assert.doesNotMatch(chatStyles, /@container ai-work-composer/u);
  assert.doesNotMatch(composerRule, /container:\s*ai-work-composer/u);
});

test("聊天列不超过 620px 时使用紧凑图标工具栏，发送操作保持在容器内", () => {
  const compactRule = chatStyles.match(/@container ai-work-chat \(max-width: 620px\)\s*\{([\s\S]*?)^\}/mu)?.[1] ?? "";

  assert.match(chatStyles, /^\.ai-work-chat\s*\{[^}]*container-type:\s*inline-size[^}]*container-name:\s*ai-work-chat/mu);
  assert.ok(compactRule.length > 0);
  assert.match(compactRule, /\.ai-work-chat__project-trigger-label\s*\{\s*display:\s*none;/u);
  assert.match(compactRule, /\.ai-work-chat__composer-control-label,[\s\S]*?display:\s*none;/u);
  assert.match(compactRule, /\.ai-work-chat__composer-control\.ant-btn\s*\{[^}]*width:\s*30px[^}]*flex:\s*0\s+0\s+30px/u);
  assert.match(compactRule, /\.ai-work-chat__composer-actions\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*max-content minmax\(0, 1fr\)/u);
  assert.match(compactRule, /\.ai-work-chat__composer-actions-group--right\s*\{[^}]*min-width:\s*0[^}]*justify-content:\s*flex-end/u);
  assert.match(compactRule, /\.ai-work-chat__composer-control--model\.ant-btn\s*\{[^}]*min-width:\s*84px[^}]*max-width:\s*min\(30cqi, 148px\)/u);
  assert.match(chatSource, /Tooltip trigger=\{\["hover"\]\} placement="top" title=\{applicationNameFor\(appId\)\}>\s*<span className="ai-work-chat__composer-app" aria-label=/u);
  assert.match(chatSource, /className="ai-work-chat__composer-control ai-work-chat__composer-control--permission"[^>]*aria-label=/u);
  assert.match(chatSource, /<Tooltip trigger=\{\["hover", "focus"\]\} placement="top" title="关联应用、Skill、提示词和专家" open=\{composerMoreTooltipOpen && !composerMoreOpen\} onOpenChange=\{setComposerMoreTooltipOpen\}>\s*<Button className="ai-work-chat__composer-control ai-work-chat__composer-control--more"[^>]*aria-label="更多输入操作"/u);
  assert.match(chatSource, /className="ai-work-chat__composer-control ai-work-chat__composer-control--model"[^>]*aria-label=\{activeAccount \? `当前模型/u);
  assert.match(compactRule, /\.ai-work-chat__composer-control--model \.ai-work-chat__composer-control-label\s*\{[^}]*display:\s*block/u);
  assert.match(projectPickerSource, /Tooltip trigger=\{\["hover", "focus"\]\} placement="top" title=\{disabled \? undefined : selected\?\.path \?\? unresolvedProjectDescription\}>\s*<Button className="ai-work-chat__project-trigger"[^>]*aria-label=/u);
});

test("极窄嵌入聊天列将两组图标分行，模型发送组不超出可用宽度", () => {
  const narrowRule = chatStyles.match(/@container ai-work-chat \(max-width: 320px\)\s*\{([\s\S]*?)^\}/mu)?.[1] ?? "";
  assert.ok(narrowRule.length > 0);
  assert.match(narrowRule, /\.ai-work-chat__composer-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/u);
  assert.match(narrowRule, /\.ai-work-chat__composer-actions-group--right\s*\{[^}]*grid-column:\s*1/u);
});

test("输入操作与用量指标为鼠标和键盘提供真实状态提示，点击详情仍由原 Popover/Dropdown 处理", () => {
  const actionsStart = chatSource.indexOf('aria-label="添加、权限与更多操作"');
  const actionsEnd = chatSource.indexOf("</form>", actionsStart);
  const composerActions = chatSource.slice(actionsStart, actionsEnd);
  const composerTooltipPlacements = [...composerActions.matchAll(/<Tooltip\b[^>]*placement="([^"]+)"/gu)].map(([, placement]) => placement);

  assert.ok(actionsStart >= 0 && actionsEnd > actionsStart);
  assert.ok(composerTooltipPlacements.length > 0);
  assert.ok(composerTooltipPlacements.every((placement) => placement === "top"), `输入栏提示应统一显示在上方，实际位置：${composerTooltipPlacements.join(", ")}`);
  assert.match(composerActions, /Tooltip trigger=\{\["hover", "focus"\]\} placement="top" title=\{attachmentError \?\? "添加图片或文本附件（最多 4 个，单个不超过 8 MiB）"\}/u);
  assert.ok(composerActions.includes("open={permissionMenuOpen}"));
  assert.ok(composerActions.includes("setPermissionTooltipOpen(false)"));
  assert.ok(composerActions.includes("setPermissionMenuOpen(open)"));
  assert.match(composerActions, /Tooltip trigger=\{\["hover", "focus"\]\} placement="top" title=\{`更改权限 · 当前为\$\{permissionModeLabels\[settings\.permissions\.mode\]\}`\} open=\{permissionTooltipOpen && !permissionMenuOpen\} onOpenChange=\{setPermissionTooltipOpen\}/u);
  assert.match(composerActions, /onOpenChange=\{\(open\) => \{\s*if \(open\) setComposerMoreTooltipOpen\(false\);\s*setComposerMoreOpen\(open\)/u);
  assert.match(composerActions, /Tooltip trigger=\{\["hover", "focus"\]\} placement="top" title="关联应用、Skill、提示词和专家" open=\{composerMoreTooltipOpen && !composerMoreOpen\} onOpenChange=\{setComposerMoreTooltipOpen\}/u);
  assert.match(composerActions, /Tooltip trigger=\{\["hover", "focus"\]\} placement="top" title=\{modelPickerTooltipTitle\} open=\{modelPickerTooltipOpen && !modelPickerOpen\} onOpenChange=\{setModelPickerTooltipOpen\}/u);
  assert.match(composerActions, /Tooltip trigger=\{\["hover", "focus"\]\} placement="top" title=\{!settings\.aiRuntime\.voiceInputEnabled/u);
  assert.match(chatSource, /settings\.general\.sendShortcut === "enter" \? "发送消息 · Enter" : "发送消息 · Ctrl\+Enter"/u);
  assert.match(composerActions, /Tooltip trigger=\{\["hover", "focus"\]\} placement="top" title=\{settings\.general\.sendShortcut === "enter"/u);
  assert.match(usageFooterSource, /Tooltip trigger=\{\["hover", "focus"\]\} placement="top" overlayClassName="ai-work-chat__usage-tooltip-overlay" getPopupContainer=\{usageTooltipContainer\} title=\{`会话 Token 用量/u);
  assert.match(usageFooterSource, /Tooltip trigger=\{\["hover", "focus"\]\} placement="top" overlayClassName="ai-work-chat__usage-tooltip-overlay" getPopupContainer=\{usageTooltipContainer\} title=\{`\$\{contextTooltipText\(contextUsage\)\}/u);
  assert.match(usageFooterSource, /function contextTooltipText\(context: AiContextUsage \| null\)/u);
  assert.match(usageFooterSource, /Popover trigger="click"/u);
  assert.match(chatSource, /menu=\{\{[\s\S]*?onClick: \(\{ key \}\) => selectPermissionMode/u);
  assert.doesNotMatch(usageFooterSource, /ai-work-chat__usage-trigger[^\n]*title=/u);
});
