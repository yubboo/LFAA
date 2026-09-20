/**
 * 文件：ui-contract-check.mjs
 * 作用：检查 LFAA Workbench/UI 的静态交互与模块边界契约。
 * 负责：全域模块化、Shell 快捷键、响应式布局、Resize/Snap、Chat/Work、RuntimeControl、共享 Slider/Effect 等源码级 Gate。
 * 不负责：浏览器像素截图、真实 Provider 请求、TypeScript 完整 workspace 编译或用户主观视觉验收。
 * 状态归属：无运行时状态；每次执行直接读取当前工作树源码。
 * 对外接口：`node scripts/ui-contract-check.mjs`，成功返回 0，失败返回 1。
 * 关联文件：packages/app-shell/src/workbench/**、packages/ui/src/ui-*、test/workbench-module-boundary.test.mjs、scripts/workspace-preflight.mjs。
 * 修改注意事项：模块迁移时应让 Gate 跟随真实 Owner，不能为了通过测试要求实现重新堆回根组件或全局 CSS。
 */
import fs from "node:fs";
import path from "node:path";
const root=process.cwd();const read=(relative)=>fs.readFileSync(path.join(root,relative),"utf8");const fail=(message)=>{console.error(`LFAA UI contract check failed: ${message}`);process.exit(1);};
const rootTsx=read("packages/app-shell/src/AgentWorkbench.tsx");
const chrome=read("packages/app-shell/src/workbench/shell/useWorkbenchChromeController.ts");
const shell=read("packages/app-shell/src/workbench/shell/WorkbenchShell.tsx");
const shellCss=read("packages/app-shell/src/workbench/shell/WorkbenchShell.module.css");
const shellButton=read("packages/app-shell/src/workbench/shell/ShellHeaderButton.tsx");
const rightShellActions=read("packages/app-shell/src/workbench/shell/RightShellActions.tsx");
const shellButtonCss=read("packages/app-shell/src/workbench/shell/ShellHeaderButton.module.css");
const themeCss=read("packages/app-shell/src/workbench/shell/WorkbenchTheme.module.css");
const left=read("packages/app-shell/src/workbench/left/LeftSidebarRegion.tsx");
const center=read("packages/app-shell/src/workbench/center/CenterWorkspaceRegion.tsx");
const header=read("packages/app-shell/src/workbench/center/header/CenterHeader.tsx");
const conversation=read("packages/app-shell/src/workbench/center/conversation/ConversationRegion.tsx");
const conversationCss=read("packages/app-shell/src/workbench/center/conversation/Conversation.module.css");
const composer=read("packages/app-shell/src/workbench/center/composer/ComposerRegion.tsx");
const composerCss=read("packages/app-shell/src/workbench/center/composer/Composer.module.css");
const addMenu=read("packages/app-shell/src/workbench/center/composer/AddCapabilityMenu.tsx");
const permission=read("packages/app-shell/src/workbench/center/composer/PermissionControl.tsx");
const runtimeView=read("packages/app-shell/src/workbench/center/composer/runtime-control/RuntimeControl.tsx");
const runtimeRow=read("packages/app-shell/src/workbench/center/composer/runtime-control/ReasoningControlRow.tsx");
const runtimeController=read("packages/app-shell/src/workbench/center/composer/runtime-control/useRuntimeControlController.ts");
const runtimePicker=read("packages/app-shell/src/workbench/center/composer/runtime-control/RuntimeModelPicker.tsx");
const runtimeCss=read("packages/app-shell/src/workbench/center/composer/runtime-control/RuntimeControl.module.css");
const session=read("packages/app-shell/src/workbench/session/useAgentSessionController.ts");
const globalCss=read("packages/app-shell/src/agent-workbench.css");
const allApp=[rootTsx,chrome,shell,shellButton,rightShellActions,left,center,header,conversation,composer,addMenu,permission,runtimeView,runtimeRow,runtimeController,runtimePicker,session].join("\n");
const layoutConfig=read("packages/ui/src/workbench/workbench-layout.config.ts");const resizeTsx=read("packages/ui/src/workbench/ResizableWorkbench.tsx");const workbenchCss=read("packages/ui/src/workbench/workbench.css");const interactionConfig=read("packages/ui/src/workbench/workbench-interaction.config.ts");
const sharedSliderTsx=read("packages/ui/src/ui-controls/DiscreteSlider.tsx");const sharedSliderCss=read("packages/ui/src/ui-controls/discrete-slider.css");const sharedEffectCss=read("packages/ui/src/ui-effects/effects.css");const sharedEffectHost=read("packages/ui/src/ui-effects/UiEffectHost.tsx");const particleCanvas=read("packages/ui/src/ui-effects/ParticleStreamCanvas.tsx");const sharedEffectRegistry=read("packages/ui/src/ui-effects/registry.ts");const sharedExtensionRegistry=read("packages/ui/src/ui-extension/registry.ts");const animatedDisclosure=read("packages/ui/src/ui-motion/AnimatedDisclosure.tsx");const shortcutHook=read("packages/ui/src/ui-shortcuts/useShortcut.ts");const damped=read("packages/ui/src/ui-resize/damped-motion.ts");const layers=read("packages/ui/src/ui-overlay/layers.css");

// 0. 全域模块化边界。
if(rootTsx.split(/\r?\n/).length>160)fail("AgentWorkbench must stay a thin Composition Root");
for(const token of ["buildAiProviderViews","ResizeObserver","<SettingsPage","<UserMenu",'className="agent-'])if(rootTsx.includes(token))fail(`AgentWorkbench absorbed module implementation: ${token}`);
if(/^\s*\.agent-/m.test(globalCss))fail("agent-workbench.css must remain reset-only; region selectors belong to CSS Modules");
const moduleCssFiles=[];const walkCss=(dir)=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walkCss(file);else if(entry.name.endsWith(".module.css"))moduleCssFiles.push(file);}};walkCss(path.join(root,"packages/app-shell/src/workbench"));
for(const file of moduleCssFiles){const source=fs.readFileSync(file,"utf8");if(source.includes(":global("))fail(`${path.relative(root,file)} must not use :global escape`);if(/\.agent-[\w-]+/.test(source))fail(`${path.relative(root,file)} reaches a legacy global agent class`);}
for(const moduleIndex of ["left/index.ts","center/index.ts","center/header/index.ts","center/conversation/index.ts","center/composer/index.ts","center/composer/runtime-control/index.ts","right/index.ts","terminal/index.ts","shell/index.ts","settings/index.ts","session/index.ts","shared/index.ts"])if(!fs.existsSync(path.join(root,"packages/app-shell/src/workbench",moduleIndex)))fail(`missing public module boundary ${moduleIndex}`);

// 1. Shell Tooltip / shortcuts。
if(/\btitle\s*=/.test(shellButton))fail("ShellHeaderButton must not combine native title with custom tooltip");
if(!shellButton.includes("aria-label="))fail("ShellHeaderButton must keep aria-label");
if(!shellButton.includes('tooltipAlign?: "start" | "center" | "end"'))fail("edge-aware tooltip alignment missing");
if(!/pointer-events:\s*none/.test(shellButtonCss))fail("Shell tooltip must ignore pointer events");
for(const shortcut of ["Ctrl+B","Ctrl+J","Ctrl+Alt+B"])if(!allApp.includes(`shortcut="${shortcut}"`))fail(`missing Shell shortcut ${shortcut}`);

// 2. 容器响应式与唯一几何事实源。
for(const token of ["resolveWorkbenchLayoutMetrics","ResizeObserver","stageRef","leftLimits={layout.left}","rightLimits={layout.right}","bottomLimits={layout.bottom}","minCenterWidth={layout.minCenterWidth}"])if(!(chrome+shell).includes(token))fail(`missing responsive contract ${token}`);
if(/window\.innerWidth\s*</.test(chrome+shell))fail("fixed window width breakpoints must not return");
for(const token of ["WORKBENCH_LAYOUT_TOKENS","ratio:","floor:","ceiling:","desktopNeed","compactNeed","resolveWorkbenchLayoutMetrics"])if(!layoutConfig.includes(token))fail(`missing layout token ${token}`);
for(const token of ['data-layout-mode="compact"','data-layout-mode="mobile"',"--lfaa-overlay-right-width","clamp(15rem, 34%, 20rem)","container-type: inline-size"])if(!workbenchCss.includes(token))fail(`missing workbench responsive CSS ${token}`);
if(/88vw|56vw|420px/.test(workbenchCss))fail("legacy drawer sizing returned");

// 3. 主题 Token 与 Composer 安全区。
for(const token of ["--agent-shell-header-h","--agent-content-max","--agent-composer-max","--agent-composer-bottom-gap","--agent-page-gutter",'data-layout-mode="compact"','data-layout-mode="mobile"'])if(!themeCss.includes(token))fail(`missing theme token ${token}`);
if(!composerCss.includes("max(var(--agent-composer-bottom-gap), env(safe-area-inset-bottom))"))fail("Composer safe-area bottom contract missing");

// 4. 三向吸附 / 阻尼算法保持共享 UI Owner。
for(const token of ["resolveSnapDragFrame({","frame.visualSize","frame.capturedThisFrame","frame.releasedThisFrame","resolveSnapCaptureThreshold(effectiveMin, snapCaptureRatio)","onBottomOpenChange?.(false)"])if(!resizeTsx.includes(token))fail(`missing snap contract ${token}`);
for(const token of ["rawSize <= input.captureThreshold","rawSize >= safeMin + Math.max(0, input.releaseHysteresis)","visualSize: snapped ? 0 : Math.min(safeMax, Math.max(safeMin, rawSize))"])if(!interactionConfig.includes(token))fail(`missing centralized snap state ${token}`);
if(resizeTsx.includes("!drag.snapped && raw <= drag.min"))fail("min size must not directly trigger snap");
if(!damped.includes("stepDampedValue")||!resizeTsx.includes("stepDampedValue"))fail("shared damping owner missing");

// 5. Hover Preview 与正式 Left 共用宽度。
for(const token of ["leftPaneWidth","onLeftWidthChange={chrome.setLeftPaneWidth}",'"--agent-left-preview-width"'])if(!(chrome+shell).includes(token))fail(`missing shared left width ${token}`);
if(!shellCss.includes("var(--agent-left-preview-width"))fail("preview must consume shared left width variable");

// 6. Chat/Work 共用 Session/Runtime。
for(const token of ['agentSurface==="chat"','setAgentSurface','permissionProfileId','<InfiniteCanvas','assistant.completed','runtimeConnected:Boolean(runtimeHost)'])if(!allApp.includes(token))fail(`missing shared Chat/Work runtime ${token}`);
if(allApp.includes("GPT-5.6 Sol"))fail("Workbench must not hard-code a model name");

// 7. 左上切换、Permission、Add Menu、RuntimeControl 各自模块化但行为不丢失。
for(const token of ["一句话直接完成任务","无限画布组织和执行任务","AGENT_PERMISSION_PROFILES","profile.description","工具与技能","浏览器","<RuntimeControl"])if(!allApp.includes(token))fail(`missing Workbench interaction ${token}`);
if(/<select[^>]*value=\{permissionProfileId\}/.test(allApp))fail("permission must remain explanatory popover");
for(const token of ["RuntimeModelPicker","ReasoningControlRow","toggleReasoningBoost","resetReasoning","useDismissibleLayer","onQuickSelectModel","onQuickUpdateModelSetting","quickModels.length === 0","管理模型"])if(!(runtimeView+runtimeRow+runtimeController+runtimePicker+composer).includes(token))fail(`missing RuntimeControl contract ${token}`);
if((runtimeView+runtimeController).includes("modelMenuOpen")||(runtimeView+runtimeController).includes("reasoningMenuOpen"))fail("split runtime popovers must not return");
if(!runtimeCss.includes("contain: layout style"))fail("runtime card containment contract missing");

// 8. Shared UI internals remain outside App Shell。
for(const token of ["setPointerCapture","onPointerMove","onPointerUp",'role="slider"',"ArrowLeft","ArrowRight","Home","End"])if(!sharedSliderTsx.includes(token))fail(`shared slider missing ${token}`);
for(const token of [".lfaa-discrete-slider","--lfaa-slider-progress","prefers-reduced-motion"])if(!sharedSliderCss.includes(token))fail(`slider CSS missing ${token}`);
for(const token of ["requestAnimationFrame","ResizeObserver","devicePixelRatio","prefers-reduced-motion"])if(!particleCanvas.includes(token))fail(`particle Canvas missing ${token}`);
if(/@keyframes|animation:/.test(sharedEffectCss))fail("reasoning particle motion must not return to CSS animation");
for(const source of [sharedEffectRegistry,sharedExtensionRegistry])if(!source.includes("unregisterOwner")||!source.includes("#generation"))fail("UI registry unload/generation missing");
if(allApp.includes("setPointerCapture")||allApp.includes("agent-reasoning-slider__particles"))fail("App Shell reimplemented shared slider/effect internals");

// 9. 动态 reasoning + 强力推理正交 + no-flash queue。
const reasoningControl=read("packages/app-shell/src/reasoning-control.ts");
for(const token of ["resolveReasoningStages","return options.map","label: providerOption.label","providerOption.value"])if(!reasoningControl.includes(token))fail(`reasoning capability contract missing ${token}`);
for(const forbidden of ["REASONING_UI_STAGES","semanticRank","isReasoningDisabledValue","DISABLED_REASONING_VALUES"])if(reasoningControl.includes(forbidden))fail(`reasoning stages must not be synthesized/filtered: ${forbidden}`);
if(!runtimeRow.includes("steps={reasoningStages.map"))fail("Slider steps must come from Provider capability");
if(!runtimeController.includes("Math.min(reasoningStages.length - 1, index)"))fail("dynamic reasoning clamp missing");
const boostToggle=runtimeController.match(/const toggleReasoningBoost = \(\) => \{[\s\S]*?\n  \};/);if(!boostToggle||/commitReasoningIndex|onQuickUpdateModelSetting/.test(boostToggle[0]))fail("strong reasoning must stay orthogonal");
if(!conversationCss.includes("width:min(var(--agent-composer-max),100%)"))fail("conversation/composer horizontal baseline diverged");
if(/translateZ\(0\)|will-change:\s*transform/.test(runtimeCss))fail("Runtime card must not force full-card GPU promotion");
for(const token of ["--lfaa-slider-visual-progress","style.setProperty","setPointerCapture","releasePointerCapture"])if(!sharedSliderTsx.includes(token))fail(`smooth slider contract missing ${token}`);
if(!sharedEffectHost.includes("ParticleStreamCanvas")&&!sharedEffectHost.includes("particle-stream-canvas"))fail("Canvas Effect Host missing");
if(!runtimeRow.includes("active={boostActive}"))fail("particle renderer must activate only with boost");
const commit=runtimeController.match(/const commitReasoningIndex = \(index: number\) => \{[\s\S]*?\n  \};/);if(!commit||!commit[0].includes("reasoningCommitQueueRef")||/setModelControlBusy/.test(commit[0]))fail("reasoning commit queue/no-flash contract broken");
for(const token of ["--lfaa-reasoning-standard-color-1","--lfaa-reasoning-extreme-color-4"])if(!themeCss.includes(token))fail(`reasoning palette token missing ${token}`);

// 10. Disclosure / shortcuts / overlay layer tokens。
if(!runtimePicker.includes("AnimatedDisclosure"))fail("Runtime model picker must use AnimatedDisclosure");
if(!runtimeView.includes("Ctrl+Shift+M"))fail("RuntimeControl shortcut label missing Ctrl+Shift+M");
if(!permission.includes("Ctrl+Shift+P"))fail("PermissionControl shortcut label missing Ctrl+Shift+P");
if(!shortcutHook.includes('window.addEventListener("keydown"'))fail("shared shortcut registry missing");
for(const token of ["--lfaa-layer-popover","--lfaa-layer-tooltip","--lfaa-layer-modal"])if(!layers.includes(token))fail(`overlay layer token missing ${token}`);
if(!runtimeCss.includes("var(--lfaa-layer-tooltip"))fail("Runtime tooltip must consume shared layer token");
if(!animatedDisclosure.includes("lfaa-animated-disclosure"))fail("AnimatedDisclosure stable host missing");

console.log("LFAA UI contract check passed.");
