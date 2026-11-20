# 浏览器设置页恢复完整样式

- 日期：2026-11-20 19:56 +08:00。
- 用户可见变化。设置中心 →「浏览器」页此前只有浏览器默认排版（无卡片、无分割线、按钮无主按钮样式、标题带默认外边距、下拉框透明无边框）；现在与「常规」「存储」设置页一致：标题层级、分组卡片、字段标签、下拉与路径输入、勾选项、粉色主按钮「保存配置」和绿色保存回执都按浅色/深色主题正确显示，窄屏自动收窄不溢出。
- 内容。新增 `packages/core/browser/client/BrowserSettings.module.css`，`BrowserSettingsView.tsx` 改用本模块的类名（`root/title/card/field/fieldLabel/control/checkboxRow/actions/primaryBtn/savedNotice`），不再借用浏览器面板的 `urlInput`，保存逻辑与配置字段保持不变。
- 验证。本机 Edge 实测浅色/深色各一轮并缩放到 640px 复测；`check`／`lint`／`readme:pair`／`typecheck`／`test`（226 项中 223 通过，3 项为既有的本机中文环境英文断言问题，与本次无关）／`build`／`probe:loader` 均通过。
