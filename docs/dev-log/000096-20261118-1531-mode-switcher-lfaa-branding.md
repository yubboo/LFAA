# 000096-20261118-1531-mode-switcher-lfaa-branding

- 时间：2026-11-18 15:31:00 +08:00
- 任务：将左上角工作区模式切换器品牌名更新为 `lfaa` 与 `lfaa Agent`，并禁止标题换行

## 变更文件

- `M` [locales.ts](file:///e:/lfaa/packages/ui/layout/client/locales.ts)
  - 新增 `chatModeTitle: "lfaa"` 与 `codexModeTitle: "lfaa Agent"`（中英文字典同步）。
- `M` [NavigationSidebar.tsx](file:///e:/lfaa/packages/ui/layout/client/components/NavigationSidebar.tsx)
  - 左上角模式切换按钮与弹出菜单改为读取 `locale.chatModeTitle` / `locale.codexModeTitle`。
- `M` [NavigationSidebar.module.css](file:///e:/lfaa/packages/ui/layout/client/components/NavigationSidebar.module.css)
  - 为 `.modeTrigger` 添加 `white-space: nowrap`，防止模式名称在窄栏内折行。
- `M` [WorkbenchShell.tsx](file:///e:/lfaa/packages/ui/layout/client/components/WorkbenchShell.tsx)
  - 欢迎标识 `.welcomeLabel` 同步使用 `locale.chatModeTitle` / `locale.codexModeTitle`。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`542ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`）：
  - 左上角切换按钮单行显示 `lfaa`，打开工作区模式菜单正常展示 `lfaa`（`创建、学习和探索`）与 `lfaa Agent`（`构建、调试和发布`）。
  - 控制台报错 `0` 条，网络请求失败 `0` 个。
