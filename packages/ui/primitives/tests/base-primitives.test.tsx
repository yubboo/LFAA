// 验证基于 @base-ui/react 封装的 5 个通用交互原语（DropdownMenu / UiSwitch / UiSelect / UiTabs / UiTooltip）在 SSR 下渲染正常、无障碍属性完整。
import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

const {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  UiSwitch,
  UiSelect,
  UiTabs,
  UiTooltip,
} = await import("../client/index");

test("DropdownMenu 渲染触发按钮并挂载 aria-haspopup 属性", () => {
  const markup = renderToStaticMarkup(
    <DropdownMenu trigger={<button type="button">更多选项</button>}>
      <DropdownMenuCheckboxItem label="设备栏" checked onCheckedChange={() => {}} />
      <DropdownMenuSeparator />
      <DropdownMenuItem label="打开外链" />
    </DropdownMenu>,
  );
  assert.match(markup, /更多选项/u);
  assert.match(markup, /aria-haspopup="menu"/u);
});

test("UiSwitch 输出 switch 角色与 aria-checked 状态", () => {
  const markup = renderToStaticMarkup(
    <UiSwitch checked onCheckedChange={() => {}} ariaLabel="开启自动保存" />,
  );
  assert.match(markup, /role="switch"/u);
  assert.match(markup, /aria-checked="true"/u);
  assert.match(markup, /aria-label="开启自动保存"/u);
});

test("UiSelect 渲染当前选中标签与无障碍名称", () => {
  const markup = renderToStaticMarkup(
    <UiSelect
      value="dark"
      onValueChange={() => {}}
      ariaLabel="主题选择"
      options={[
        { value: "dark", label: "深色模式" },
        { value: "light", label: "浅色模式" },
      ]}
    />,
  );
  assert.match(markup, /深色模式/u);
  assert.match(markup, /aria-label="主题选择"/u);
});

test("UiTabs 渲染标签列表与激活状态", () => {
  const markup = renderToStaticMarkup(
    <UiTabs
      value="console"
      onValueChange={() => {}}
      ariaLabel="调试面板切换"
      items={[
        { value: "console", label: "控制台" },
        { value: "network", label: "网络" },
      ]}
    />,
  );
  assert.match(markup, /role="tablist"/u);
  assert.match(markup, /role="tab"/u);
  assert.match(markup, /控制台/u);
  assert.match(markup, /网络/u);
});

test("UiTooltip 包裹触发元素且不破坏子节点渲染", () => {
  const markup = renderToStaticMarkup(
    <UiTooltip content="刷新当前页面">
      <button type="button">刷新</button>
    </UiTooltip>,
  );
  assert.match(markup, /刷新/u);
});
