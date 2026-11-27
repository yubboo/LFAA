# ui-measure 片段

所有片段都在页面上下文里跑（`browser_evaluate` 的 expression，或 MCP 的 `evaluate_script` 的 `function`）。
先 `await document.fonts.ready`，再量。

## 1. 四栏一次量全

```js
() => {
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { cls: String(el.className).slice(0, 40), left: +r.left.toFixed(1), right: +r.right.toFixed(1), w: +r.width.toFixed(1) };
  };
  const shell = document.querySelector('[class*="_shell_"]');
  const nodes = [...(shell?.children ?? [])];
  const rail = nodes.find((el) => /_rail_/u.test(el.className));
  const sidebar = nodes.find((el) => /_sidebar_/u.test(el.className));
  const workspace = nodes.find((el) => /_workspace_/u.test(el.className));
  const right = nodes.find((el) => /_rightPane_/u.test(el.className));
  const handles = nodes.filter((el) => /_resizeHandle_/u.test(el.className));
  return {
    viewport: { w: innerWidth, h: innerHeight },
    columns: [rail, sidebar, workspace, right].filter(Boolean).map(rect),
    handles: handles.map(rect),
    // 相邻两栏是否严丝合缝；handle 压边 2px 属设计，单独看
    gap: sidebar && workspace ? +(workspace.getBoundingClientRect().left - sidebar.getBoundingClientRect().right).toFixed(1) : null,
  };
}
```

## 2. 活动行：类型图标 / 标签 / 状态是否同列

```js
() => {
  const rows = [...document.querySelectorAll('[class*="_activity_"] [class*="_row_"]')].slice(0, 8);
  return rows.map((row) => {
    const icon = row.querySelector('svg, img, [class*="_icon_"]');
    const label = [...row.querySelectorAll('span, div')].find((el) => el.textContent?.trim() && !el.querySelector('svg'));
    const ir = icon?.getBoundingClientRect();
    const lr = label?.getBoundingClientRect();
    return {
      text: row.textContent?.trim().slice(0, 24),
      iconLeft: ir ? +ir.left.toFixed(1) : null,
      iconCenterY: ir ? +(ir.top + ir.height / 2).toFixed(1) : null,
      labelLeft: lr ? +lr.left.toFixed(1) : null,
      // 图标中线与标签中线差：> 1px 说明行内没对齐
      dy: ir && lr ? +((ir.top + ir.height / 2) - (lr.top + lr.height / 2)).toFixed(1) : null,
    };
  });
}
```

## 3. 会话列表：父行与子行标题左端

```js
() => {
  const titles = [...document.querySelectorAll('[class*="_session_"] [class*="_title_"]')].slice(0, 12);
  return titles.map((el) => {
    const r = el.getBoundingClientRect();
    return { text: el.textContent?.trim().slice(0, 20), left: +r.left.toFixed(1), paddingLeft: getComputedStyle(el).paddingLeft };
  });
}
```

判定：子行 `left` 必须 ≥ 父行 `left`；倒挂就是缩进写反了（子行应 `padding-left: 2.25rem`）。

## 4. 浮层是否贴住所属栏

```js
() => {
  const panel = document.querySelector('[class*="_popover_"], [role="menu"], [role="dialog"]');
  const rail = document.querySelector('[class*="_rail_"]');
  const sidebar = document.querySelector('[class*="_sidebar_"]');
  const r = panel?.getBoundingClientRect();
  const s = sidebar?.getBoundingClientRect();
  return {
    panel: r ? { left: +r.left.toFixed(1), right: +r.right.toFixed(1), w: +r.width.toFixed(1) } : null,
    sidebar: s ? { left: +s.left.toFixed(1), right: +s.right.toFixed(1) } : null,
    // 期望：左缘 = 栏左缘 + 2，右缘 = 栏右缘 − 12，宽度 ≤ 21.5rem(344px)
    offsetLeft: r && s ? +(r.left - s.left).toFixed(1) : null,
    offsetRight: r && s ? +(s.right - r.right).toFixed(1) : null,
  };
}
```

## 5. 读主题变量，别猜颜色来源

```js
() => {
  const style = getComputedStyle(document.documentElement);
  const names = ['--color-shell', '--color-rail', '--color-panel', '--color-line', '--color-ink', '--color-muted'];
  return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name).trim()]));
}
```

## 6. 多视口复测

```js
// 桌面 → 平板 → 手机：每档量完再切，别在一档里下结论
// browser_set_viewport 之后重新跑片段 1，比较 columns 宽度与 gap
```

判定顺序固定：先看 `gap` 是否为 0（或压边 2），再看各栏 `w` 是否随视口缩放，最后才看文字是否截断（`scrollWidth > clientWidth`）。