/** Settings / Profile / Theme modular shell regression contract. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=(p)=>fs.readFileSync(p,"utf8");
const root=read("packages/app-shell/src/AgentWorkbench.tsx");
const left=read("packages/app-shell/src/workbench/left/view/LeftSidebarRegion.tsx");
const profile=read("packages/app-shell/src/workbench/left/view/ProfileBar.tsx");
const overlays=read("packages/app-shell/src/workbench/shell/view/WorkbenchOverlays.tsx");
const overlaysCss=read("packages/app-shell/src/workbench/shell/styles/WorkbenchOverlays.module.css");
const themeController=read("packages/app-shell/src/workbench/shell/logic/useWorkbenchThemeController.ts");
const chromeController=read("packages/app-shell/src/workbench/shell/logic/useWorkbenchChromeController.ts");
const shellView=read("packages/app-shell/src/workbench/shell/view/WorkbenchShell.tsx");
const settingsSurface=read("packages/app-shell/src/workbench/settings/view/SettingsSurface.tsx");
const aiController=read("packages/app-shell/src/workbench/settings/logic/useAiSettingsController.ts");
const aiMappings=read("packages/app-shell/src/workbench/settings/logic/settings-view-models.ts");
const settings=read("packages/ui/src/features/settings/SettingsPage.tsx");
const aiPanel=read("packages/ui/src/features/settings/ai/AiSettingsPanel.tsx");
const themeMenu=read("packages/ui/src/features/appearance/ThemeModeMenu.tsx");
const settingsCss=read("packages/ui/src/features/settings/settings.css");
const workbenchTypes=read("packages/ui/src/workbench/workbench-layout.types.ts");

test("Settings is independent Surface module",()=>{assert.match(root,/settingsSurface\.surface==="settings"/);assert.match(root,/<SettingsSurface/);assert.match(settingsSurface,/<SettingsPage/);assert.doesNotMatch(root,/<SettingsPage/);});

test("profile focus overlay owns blur and reuses ProfileBar via explicit variant",()=>{assert.match(overlays,/profileMenuOpen/);assert.match(overlays,/<UserMenu/);assert.match(overlays,/<ProfileBar variant="overlay"/);assert.match(overlaysCss,/backdrop-filter:blur\(4px\)/);assert.match(overlaysCss,/width:calc\(var\(--agent-left-live-width,15rem\) - 1\.25rem\)/);assert.match(profile,/variant\?: "sidebar" \| "overlay"/);});

test("theme supports system/light/dark and system listener is owned by theme controller",()=>{for(const token of ["system","light","dark"])assert.ok(themeMenu.includes(`"${token}"`));assert.match(themeController,/prefers-color-scheme: dark/);assert.match(themeController,/addEventListener\("change"/);});

test("left profile keeps update then theme actions",()=>{const refresh=profile.indexOf('name="refresh"');const theme=profile.indexOf('name={themeIcon}');assert.ok(refresh>=0&&theme>refresh);assert.match(left,/<ProfileBar/);});

test("Settings left nav remains resizable and shared width comes from shell controller",()=>{assert.match(settings,/<ResizableWorkbench/);assert.match(settings,/storageKey=\{SETTINGS_LAYOUT_KEY\}/);assert.match(settings,/leftLimits=\{layout\.left\}/);assert.match(settings,/snapCaptureRatio=\{layout\.snapCaptureRatio\}/);assert.match(settings,/snapHysteresis=\{layout\.snapHysteresis\}/);assert.match(settings,/ResizeObserver/);assert.doesNotMatch(settingsCss,/grid-template-columns:17rem|grid-template-columns:12rem/);assert.match(chromeController,/leftPaneWidth/);assert.match(shellView,/leftWidth=\{chrome\.leftPaneWidth\}/);assert.match(settingsSurface,/leftPaneWidth=\{leftPaneWidth\}/);assert.doesNotMatch(settings,/useState\([^\n]*leftWidth/);});

test("ResizableWorkbench supports single-sided Surface",()=>{assert.match(workbenchTypes,/right\?: ReactNode/);});

test("AI provider capability projection lives in settings mapping/controller, not root",()=>{assert.match(aiMappings,/buildAiProviderViews/);assert.match(aiMappings,/auth\.hostCapability\?hostCapabilities\[auth\.hostCapability\]/);assert.doesNotMatch(root,/buildAiProviderViews|auth\.hostCapability/);assert.match(aiController,/connectSubscription/);assert.match(settingsSurface,/onConnectAiSubscription=\{ai\.connectSubscription\}/);assert.match(aiPanel,/登录 ChatGPT 并保存账户/);assert.match(aiPanel,/LFAA 不保存 Token/);});

test("API Key and subscription contracts remain intact",()=>{assert.match(aiPanel,/!secret\.trim\(\) \|\| !selectedModelId/);assert.match(aiPanel,/isSubscription \? \(/);assert.match(aiPanel,/activeAuthView\?\.secretLabel/);assert.doesNotMatch(aiPanel,/fetch\s*\(|https?:\/\//);});

test("active model is explicit and never inferred from account order",()=>{assert.match(aiController,/snapshot\.activeModel/);assert.doesNotMatch(aiController,/accounts\.find\(\(account\) => Boolean\(account\.selectedModelId\)\)/);assert.match(settingsSurface,/activeAiModel=\{ai\.snapshot\.activeModel\}/);assert.match(aiPanel,/设为当前模型/);});
