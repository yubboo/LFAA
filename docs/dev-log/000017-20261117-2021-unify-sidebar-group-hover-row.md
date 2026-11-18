# DEV-000017｜统一左二栏分组标题悬停底色铺满整行

- 任务编号：000017
- 开始时间：2026-11-17 20:20:38 +08:00
- 完成时间：2026-11-17 20:21:55 +08:00
- 类型：fix
- 状态：完成（`typecheck`、`build` 与内置浏览器悬停实测均已通过）
- 审批级别及批准证据：A0；负责人上传对比截图指出“项目”行悬停底色未铺满右侧工具区，要求与“置顶”行保持整行一致
- 关联 Issue/PR/Commit：无

## 本轮目标与非目标

- 目标：
  - 将可折叠分组的悬停高亮背景从左侧 `.groupHeadingButton` 移至整行容器 `.headingRow:has(> .groupHeadingButton):hover`，使带右侧工具按钮（`项目排序` / `新建项目`）的“项目”分组行悬停时与“置顶”“最近”分组一样铺满整行宽度。
  - 调整右侧 `.projectTools` 边距与 `.toolButton:hover` 背景层级，在整行底色内保留独立工具按钮悬浮反馈。
- 不在范围：更改静态设置分组标题（`.sectionTitle`）的交互。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `packages/ui/layout/client/components/SidebarSectionList.module.css` | 为 `.headingRow` 添加圆角与过渡，并通过 `.headingRow:has(> .groupHeadingButton):hover` 铺满整行悬停底色 |
| 修改文件 | `packages/ui/layout/client/components/NavigationGroups.module.css` | 调整 `.projectTools` 右边距与 `.toolButton` 尺寸及悬停反馈色（`var(--color-menu-hover)`） |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-DJXGMsP2.css`、`apps/web/dist/assets/index-CelkvGw3.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000017-20261117-2021-unify-sidebar-group-hover-row.md` | 记录修复文件、验证与悬停实测结果 |
| 新增文件 | `docs/updata-log/000017-20261117-2021-unify-sidebar-group-hover-row.md` | 记录左二分组标题悬停高亮统一优化 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm run typecheck` | 通过 | `apps/cli`、`apps/web`、`@lfaa/ui-layout`、`@lfaa/workspace` 全部通过 |
| `pnpm run build` | 通过 | Vite 8.3.8 转换 6613 个模块，耗时 `829ms` |
| 内置浏览器实测（`http://127.0.0.1:5173/`，`1440×900`） | 通过 | HTTP 200，0 条控制台/页面错误；`置顶` 行与 `项目` 行 `.headingRow` 宽度同为 `245.64px`（与 `新聊天` `245.61px` 一致），悬停 `项目` 时高亮底色完整覆盖包含右侧 `项目排序` 与 `新建项目` 按钮在内的整行区域 |

## 风险、回滚与遗留问题

- 风险：无。
- 回滚办法：恢复本轮修改的 2 个 CSS 文件与 `apps/web/dist/` 后重新执行 `pnpm run build`，并删除本轮两份日志。
- 遗留问题：无。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：统一了左二栏分组行悬停高亮宽度，已新增同编号 `updata-log`。
