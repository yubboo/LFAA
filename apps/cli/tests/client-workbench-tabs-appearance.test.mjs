import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceCss = readFileSync(new URL("../../../packages/client/ui-workspace/src/css/right-menu.css", import.meta.url), "utf8");
const workspaceSource = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");
const browserPanelSource = readFileSync(new URL("../../../packages/client/ui-sidebar-browser/src/BrowserPanel.tsx", import.meta.url), "utf8");

test("工作区当前标签保留中性细边和圆角表面，不绘制蓝色点击焦点外框", () => {
  const selectedItem = workspaceCss.match(/\.module-workbench-tabs--context > \.module-workbench-tab-item\.is-active \{([^}]+)\}/u)?.[1] ?? "";
  const selectedDirectTab = workspaceCss.match(/\.module-workbench-tabs--context > \.module-workbench-tab\[aria-selected="true"\] \{([^}]+)\}/u)?.[1] ?? "";

  assert.match(selectedItem, /background: var\(--color-surface-muted\)/u);
  assert.match(selectedItem, /border-color: var\(--color-border-strong\)/u);
  assert.doesNotMatch(selectedItem, /border-bottom/u);
  assert.match(selectedDirectTab, /background: var\(--color-surface-muted\)/u);
  assert.match(selectedDirectTab, /border-color: var\(--color-border-strong\)/u);
  assert.doesNotMatch(workspaceCss, /\.module-workbench-tab-item:focus-within/u);
  assert.match(workspaceCss, /\.module-workbench-tab-item > \.module-workbench-tab:focus-visible \{ outline-offset: -2px; \}/u);
  assert.match(workspaceCss, /\.module-workbench-tab-close:focus-visible,[\s\S]*?outline: 2px solid var\(--color-focus-ring\)/u);
  assert.doesNotMatch(workspaceCss, /\.module-workbench-tab-item\.is-active > \.module-workbench-tab-close \{ background:/u);
});

test("窄右栏保留标签标题、横向浏览与独立新建入口", () => {
  assert.match(workspaceCss, /\.module-workbench-tabs--context \.module-workbench-tab > span \{ min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; \}/u);
  assert.match(workspaceCss, /\.module-workbench-tabs \{[^}]*scrollbar-width: none/u);
  assert.match(workspaceCss, /\.module-workbench-tabs--context > \.module-workbench-tab-item \{[^}]*max-width: min\(42%, 280px\)[^}]*flex: 0 0 auto/u);
  assert.doesNotMatch(workspaceCss, /\.module-workbench-tabs--context > \.module-workbench-tab-item \{ max-width: 280px; \}/u);
  assert.match(workspaceCss, /@container module-context \(max-width: 340px\)[\s\S]*?\.module-workbench-tabs--context \{ max-width: calc\(100% - 25px\); min-width: 0; gap: 3px; padding-right: 0; overflow-x: auto; overflow-y: hidden; \}/u);
  assert.match(workspaceCss, /\.module-workbench-tabs--context > \.module-workbench-tab-item:only-of-type \{ max-width: 100%; flex: 0 1 auto; \}/u);
});

test("新标签使用浏览器图标并在悬停或键盘聚焦时提供有界真实页面预览", () => {
  assert.match(workspaceSource, /const icon = tab\.kind === "new" \? "browser"/u);
  assert.match(workspaceSource, /trigger=\{\["hover", "focus"\]\}/u);
  assert.match(workspaceSource, /browserAddressForDisplay\(browserUrl!, settings\.browserUse\.showFullUrl, false\)/u);
  assert.match(workspaceSource, /previewRequestId=\{browserTabPreviewRequest\?\.tabId === activeWorkspaceUtilityTabId \? browserTabPreviewRequest\.requestId : undefined\}/u);
  assert.match(browserPanelSource, /360 \/ canvas\.width, 203 \/ canvas\.height/u);
  assert.match(browserPanelSource, /blob\.size > 512 \* 1024/u);
  assert.match(workspaceCss, /\.module-workbench-tab-preview__image \{[^}]*aspect-ratio: 16 \/ 9/u);
  assert.match(workspaceCss, /@media \(max-width: 480px\)[\s\S]*?\.module-workbench-tab-preview-popover \{ position: fixed !important; inset-inline: 12px !important; width: auto !important; transform: none !important; \}/u);
});
