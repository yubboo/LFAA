import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const rail = read("../../../packages/client/ui-sidebar/src/GlobalNavigationRail.tsx");
const railCss = read("../../../packages/client/ui-sidebar/src/GlobalNavigationRail.css");
const sidebarReadme = read("../../../packages/client/ui-sidebar/README.md");

test("全局导航固定入口保持精简，低频模块由可搜索功能菜单承载", () => {
  const primary = rail.match(/<div className="module-navigation-rail__primary"[^>]*>([\s\S]*?)<\/div>/u)?.[1];

  assert.ok(primary, "全局主导航区应存在");
  for (const removedEntry of ["AI 员工办公室", "文件管理", "无限画布", "插件", "工具与资源"]) {
    assert.doesNotMatch(primary, new RegExp(`aria-label="${removedEntry}"`, "u"), `${removedEntry} 不应继续占用固定图标位`);
  }
  assert.match(primary, /aria-label="应用"/u);
  assert.match(primary, /aria-label="最近会话"/u);
  assert.match(primary, /aria-label="设置中心"/u);

  for (const item of ["AI 员工办公室", "文件管理", "无限画布", "插件管理"]) {
    assert.match(rail, new RegExp(`title: "${item}"`, "u"), `${item} 应出现在功能菜单中`);
  }
  assert.match(rail, /type="search"/u);
  assert.match(rail, /aria-label="搜索功能"/u);
  assert.match(rail, /includes\(normalizedMenuSearch\)/u, "功能搜索应筛选真实菜单项");
  assert.match(rail, /没有匹配的功能[\s\S]*?清空搜索/u, "空结果应提供清除搜索操作");
  assert.match(rail, /onNavigate\("\/agent-office"\)/u);
  assert.match(rail, /onNavigate\("\/plugin-manager"\)/u);
  assert.match(rail, /featurePageActive/u, "已收纳模块所在页面应反映在更多入口状态上");
});

test("更多功能菜单在短屏内保留搜索区并让功能列表独立滚动", () => {
  const popoverRule = railCss.match(/\.module-navigation-rail__popover--features\s*\{([^}]+)\}/u)?.[1];
  const listRule = railCss.match(/\.module-navigation-rail__feature-list\s*\{([^}]+)\}/u)?.[1];

  assert.ok(popoverRule, "功能菜单应有独立布局规则");
  assert.match(popoverRule, /height:\s*min\(390px,\s*calc\(100%\s*-\s*24px\)\)/u);
  assert.match(popoverRule, /grid-template-rows:\s*auto\s+auto\s+minmax\(0,\s*1fr\)/u);
  assert.match(popoverRule, /width:\s*min\(320px,\s*calc\(100vw\s*-\s*84px\)\)/u);
  assert.ok(listRule, "功能列表应可单独滚动");
  assert.match(listRule, /min-height:\s*0/u);
  assert.match(listRule, /overflow-y:\s*auto/u);
  assert.doesNotMatch(railCss, /display:\s*inline-block/u);
  assert.match(sidebarReadme, /常驻轨只保留首页、应用、工作、最近会话和设置/u);
});
