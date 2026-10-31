# 全局文件管理固定在左一图标导航

<a id="lfaa-global-file-manager-pinned-rail-20261031"></a>

## 用户目标与验收

- 将“更多功能”中的“文件管理”移到左一全局图标轨，在设置按钮下方、键盘快捷键和“更多功能”上方使用文件夹图标常驻显示。
- 点击后打开 `/files` 的 LFAA Data 总览，并清除游戏目录来源/返回状态；进入文件页时仍由 File Owner 和既有权限执行真实读取。
- “更多功能”不再重复显示“文件管理”，其他功能搜索和入口保持工作。
- 文件页活动时常驻图标显示选中状态；其他页面进入全局文件管理后状态随路由变化。
- 在内置浏览器真实检查桌面和窄分栏/短屏；检查主入口点击、当前页状态和更多菜单去重。

## Owner、设置与范围

- 左一导航与固定按钮由 `packages/client/ui-sidebar/src/GlobalNavigationRail.tsx` 持有；每个调用方负责通过现有 `onOpenFiles` 回调路由至文件页并重置为全局 Data 根。
- 实际读取、目录与权限仍由 `ui-sidebar-files`、File Owner 和现有 `permissions.mode` 管理；不新增设置，不修改权限或用户偏好。
- 不改变菜单其他项目、应用切换、文件目录列表或全局布局尺寸；不新增 CSS 变量、请求或订阅。

## 分批记录

### 批次 1：常驻入口与调用方回调

- 实施：`GlobalNavigationRail` 主图标区在设置下增加文件夹按钮，`activePage="files"` 时显示选中态；文件管理从“更多功能”分组移除，其他菜单项与搜索保留。应用工作台、文件页、设置、插件管理和 AI 员工办公室共用这一入口；页面调用方清除上次游戏目录来源后打开 Data 总览。
- 回归：`pnpm exec node --import tsx --import ./register-package-loader.mjs --test tests/client-global-navigation-feature-launcher.test.mjs`（`apps/cli`）3/3 通过，覆盖常驻图标/菜单去重、所有全局入口重置 Data 根、短屏弹层滚动；`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过。`lfaa-client-ui-sidebar`、`lfaa-client-ui-settings`、`lfaa-client-ui-plugin-manager`、`lfaa-client-ui-workspace` 包构建及 `pnpm run build:web` 通过（3951 个模块，保留既有大 chunk 提示）。
- 运行：`node scripts/runtime-build-state.mjs web` 返回 `[]`；正式 `pnpm lfaa web` 重启后 `GET /api/health` 为 `status=ok`、`persistence=ready`。本机 Daemon 报告已启动。
- ChatGPT 内置浏览器：从 `/games/minecraft` 点击左一“文件管理”常驻按钮后进入 `/files`，实际存储位置为当前账户 `C:\Users\Administrator\.lfaa\data`，Data 完整分类显示；文件图标处于 `aria-current="page"` / 激活态。在 `/files` 打开“更多功能”，菜单保留 AI 员工办公室、无限画布、插件管理等项，不再包含文件管理。`/files` 在 1280×720 和 760×560 检查；页面无水平溢出（document/body 宽度分别与视口相等），窄屏下文件图标可见且位于键盘/更多按钮上方。视口恢复默认 735×849；最终页面留在 `/files`。两种尺寸截图保留在本轮浏览器验收输出。
- 设置与边界：未新增或修改设置、权限、主题或用户偏好；继续使用现有 `permissions.mode`、Appearance 和 Workbench 布局，文件路径仍由 File Manager Location 与 Files Owner 校验。新增交互只在用户点击时执行一次账户限定的 Data 根定位与既有路由导航；没有增加请求、轮询、订阅或定时器。未测帧时间、实体手机/平板、Electron/WebView。
