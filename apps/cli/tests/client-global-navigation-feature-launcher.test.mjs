import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const rail = read("../../../packages/client/ui-sidebar/src/GlobalNavigationRail.tsx");
const railCss = read("../../../packages/client/ui-sidebar/src/GlobalNavigationRail.css");
const sidebarReadme = read("../../../packages/client/ui-sidebar/README.md");

test("文件管理常驻全局主导航，其他低频模块由可搜索功能菜单承载", () => {
  const primary = rail.match(/<div className="module-navigation-rail__primary"[^>]*>([\s\S]*?)<\/div>/u)?.[1];
  const featureGroups = rail.match(/const featureGroups:[\s\S]*?const normalizedMenuSearch/u)?.[0];

  assert.ok(primary, "全局主导航区应存在");
  for (const removedEntry of ["AI 员工办公室", "无限画布", "插件", "工具与资源"]) {
    assert.doesNotMatch(primary, new RegExp(`aria-label="${removedEntry}"`, "u"), `${removedEntry} 不应继续占用固定图标位`);
  }
  assert.match(primary, /aria-label="应用"/u);
  assert.match(primary, /aria-label="最近会话"/u);
  assert.match(primary, /aria-label="设置中心"/u);
  assert.match(primary, /aria-label="文件管理"[\s\S]*?onOpenFiles\(\)/u, "文件管理固定图标应执行既有全局入口回调");

  assert.ok(featureGroups, "更多功能菜单应继续保留可搜索入口");
  assert.doesNotMatch(featureGroups, /title: "文件管理"/u, "文件管理不应在更多功能里重复显示");
  for (const item of ["AI 员工办公室", "无限画布", "插件管理"]) {
    assert.match(rail, new RegExp(`title: "${item}"`, "u"), `${item} 应出现在功能菜单中`);
  }
  assert.match(rail, /type="search"/u);
  assert.match(rail, /aria-label="搜索功能"/u);
  assert.match(rail, /includes\(normalizedMenuSearch\)/u, "功能搜索应筛选真实菜单项");
  assert.match(rail, /没有匹配的功能[\s\S]*?清空搜索/u, "空结果应提供清除搜索操作");
  assert.match(rail, /onNavigate\("\/agent-office"\)/u);
  assert.match(rail, /onNavigate\("\/plugin-manager"\)/u);
  assert.match(rail, /const featurePageActive = activePage === "office" \|\| activePage === "canvas" \|\| activePage === "plugins"/u, "文件页状态应由常驻图标单独表示");
});

test("所有全局文件入口都清除游戏路径并打开 Data 总览", () => {
  const applicationWorkspace = read("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx");
  const settingsPage = read("../../../packages/client/ui-settings/src/SettingsPage.tsx");
  const pluginManager = read("../../../packages/client/ui-plugin-manager/src/PluginManagerPage.tsx");
  const agentOffice = read("../../../packages/client/ui-workspace/src/AgentOfficePage.tsx");
  const fileManager = read("../../../packages/client/ui-sidebar-files/src/FileManagerPage.tsx");

  for (const [name, source] of [["应用工作台", applicationWorkspace], ["设置中心", settingsPage], ["插件管理", pluginManager], ["AI 员工办公室", agentOffice]]) {
    assert.match(source, /setFileManagerLocation\(user(?:\.id|Id), ""\)/u, `${name} 入口应清除来源目录`);
  }
  assert.match(fileManager, /setFileEntryContext\(\{ userId: user\.id, requestedLocation: null, returnPath: null, returnApp: null \}\)[\s\S]*?selectLocation\(""\)/u);
});

test("全局功能、账户与快捷键浮卡使用左栏最小宽并贴近导航轨底部", () => {
  const popoverRule = railCss.match(/\.module-navigation-rail__popover--features\s*\{([^}]+)\}/u)?.[1];
  const profileRule = railCss.match(/\.module-navigation-rail__popover--profile\s*\{([^}]+)\}/u)?.[1];
  const shortcutsRule = railCss.match(/\.module-navigation-rail__popover--shortcuts\s*\{([^}]+)\}/u)?.[1];
  const sharedPopoverRule = railCss.match(/\.module-navigation-rail__popover\s*\{([^}]+)\}/u)?.[1];
  const listRule = railCss.match(/\.module-navigation-rail__feature-list\s*\{([^}]+)\}/u)?.[1];

  assert.ok(popoverRule, "功能菜单应有独立布局规则");
  assert.ok(profileRule, "个人账户菜单应有独立布局规则");
  assert.ok(shortcutsRule, "快捷键菜单应有独立布局规则");
  assert.ok(sharedPopoverRule, "全局浮卡应有统一底部安全间距");
  assert.match(popoverRule, /top:\s*auto/u, "功能浮卡应取消垂直居中锚点");
  assert.doesNotMatch(popoverRule, /translateY\(-50%\)/u, "功能浮卡不应再通过位移垂直居中");
  assert.match(sharedPopoverRule, /bottom:\s*calc\(84px \+ env\(safe-area-inset-bottom,\s*0px\)\)/u, "其他全局浮卡继续保留原底部安全间距");
  assert.match(popoverRule, /bottom:\s*max\(14px,\s*env\(safe-area-inset-bottom,\s*0px\)\)/u, "功能浮卡底边应贴近导航轨最底部安全留白");
  assert.match(popoverRule, /left:\s*100%/u, "功能浮卡左边缘应贴齐左二栏起点");
  assert.match(popoverRule, /height:\s*min\(390px,\s*calc\(100%\s*-\s*max\(14px,\s*env\(safe-area-inset-bottom,\s*0px\)\)\s*-\s*24px\)\)/u, "短屏高度应同时保留底部安全间距和顶部可见空间");
  assert.match(popoverRule, /grid-template-rows:\s*auto\s+auto\s+minmax\(0,\s*1fr\)/u);
  assert.doesNotMatch(popoverRule, /(^|[;\n])\s*width:/u, "浮卡尺寸应由实际 Workbench 最小栏宽驱动");
  assert.match(popoverRule, /max-width:\s*calc\(100vw\s*-\s*84px\)/u);
  assert.match(profileRule, /top:\s*auto/u, "个人账户浮卡应锚定底部");
  assert.match(profileRule, /left:\s*100%/u, "个人账户浮卡左边缘应贴齐左二栏起点");
  assert.match(profileRule, /bottom:\s*max\(14px,\s*env\(safe-area-inset-bottom,\s*0px\)\)/u, "个人账户浮卡底边应贴近导航轨最底部安全留白");
  assert.match(profileRule, /max-width:\s*calc\(100vw\s*-\s*84px\)/u);
  assert.match(shortcutsRule, /top:\s*auto/u);
  assert.match(shortcutsRule, /left:\s*100%/u, "快捷键浮卡左边缘应贴齐左二栏起点");
  assert.match(shortcutsRule, /bottom:\s*max\(14px,\s*env\(safe-area-inset-bottom,\s*0px\)\)/u, "快捷键浮卡底边应贴近导航轨最底部安全留白");
  assert.match(shortcutsRule, /max-width:\s*calc\(100vw\s*-\s*84px\)/u);
  assert.match(sharedPopoverRule, /max-height:\s*calc\(100%\s*-\s*32px\)/u, "短屏浮卡高度应限制在导航轨内");
  assert.match(sharedPopoverRule, /overflow-y:\s*auto/u, "短屏快捷键内容应可滚动访问");
  assert.ok(listRule, "功能列表应可单独滚动");
  assert.match(listRule, /min-height:\s*0/u);
  assert.match(listRule, /overflow-y:\s*auto/u);
  assert.match(listRule, /scrollbar-gutter:\s*stable/u, "功能列表应为滚动条保留宽度");
  assert.match(rail, /secondaryNavigationMinWidth: number/u);
  assert.match(rail, /POPOVER_SCROLLBAR_RESERVE_PX = 12/u, "导航浮卡应为左二滚动槽留出 12px");
  assert.match(rail, /navigationPopoverContentWidthPx = Math\.max\(1, Math\.round\(secondaryNavigationMinWidth\) - POPOVER_SCROLLBAR_RESERVE_PX\)/u, "浮卡宽度应先从左二最小宽中扣除滚动槽");
  assert.match(rail, /const navigationPopoverWidth = `min\(\$\{navigationPopoverContentWidthPx\}px, calc\(100vw - 84px\)\)`/u, "扣除滚动槽后的浮卡宽度应受视口限制");
  assert.equal([...rail.matchAll(/style=\{\{ width: navigationPopoverWidth \}\}/gu)].length, 3, "功能、账户和快捷键浮卡应共用最小宽度合同");
  const applicationWorkspace = read("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx");
  const settingsPage = read("../../../packages/client/ui-settings/src/SettingsPage.tsx");
  const pluginManager = read("../../../packages/client/ui-plugin-manager/src/PluginManagerPage.tsx");
  const fileManager = read("../../../packages/client/ui-sidebar-files/src/FileManagerPage.tsx");
  const agentOffice = read("../../../packages/client/ui-workspace/src/AgentOfficePage.tsx");
  for (const [name, source, metric] of [
    ["应用工作台", applicationWorkspace, "metrics"],
    ["设置中心", settingsPage, "layout"],
    ["插件管理", pluginManager, "layout"],
    ["文件管理", fileManager, "metrics"],
  ]) {
    assert.match(source, new RegExp(`secondaryNavigationMinWidth=\\{${metric}\\.left\\.min\\}`, "u"), `${name} 应传入其 Workbench 左二栏最小宽度`);
  }
  assert.match(agentOffice, /secondaryNavigationMinWidth=\{WORKBENCH_LAYOUT_TOKENS\.left\.min\.floor\}/u, "没有左二面板的独立页面应读取同一 Workbench 最小宽度令牌");
  assert.doesNotMatch(railCss, /display:\s*inline-block/u);
  assert.match(sidebarReadme, /固定的入口顺序：小鱼智能体、应用、最近会话、设置、文件管理/u);
});
