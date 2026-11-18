# 000104-20261118-1609-hover-card-cross-row-and-unread-halo

- 时间：2026-11-18 16:09:00 +08:00
- 任务：修复跨会话行连续悬停时悬浮卡片偶发不显示的问题，并为侧栏未读圆点统一添加蓝色光环样式

## 变更文件

- `M` [session-menu-store.ts](file:///e:/lfaa/packages/core/chat/client/session-menu-store.ts)
  - 新增 `pendingSessionId` 追踪正在等待弹出的行 ID，防止旧行的 `onRowLeave(A)` 误清掉新悬停行 `B` 的 `openTimer`；优化同卡片悬停跳过与跨行切换延迟（`65ms` / `110ms`）。
- `M` [SessionOverlays.tsx](file:///e:/lfaa/packages/core/chat/client/components/SessionOverlays.tsx)
  - 在全局 `pointermove` 监听中区分指针仍在目标区域内时调用 `onCardEnter()` 取消关闭计时，仅当移出目标区域时才调用 `onRowLeave`。
- `M` [SidebarSectionList.module.css](file:///e:/lfaa/packages/ui/layout/client/components/SidebarSectionList.module.css)
  - 为侧栏 `.unreadDot` 添加 `margin-left: auto` 右侧对齐与 `box-shadow: 0 0 0 3.5px rgb(59 130 246 / 0.2)` 蓝色光环效果，与悬浮卡片内的未读圆点保持统一。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`480ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`）：
  - 连续从第 1 行（`火星的气候特点`）→ 第 2 行（`木星的气候特点`）→ 第 3 行（`你好`）跨行移动悬停，`[data-session-hover-card]` 均稳定切换显示，无丢帧或漏弹。
  - 将 `你好` 设为未读后，侧栏行右侧显示带蓝色光环的 `[aria-label="未读"]` 圆点，悬停卡片同步展示蓝点光环与 `未读` 行；标为已读后正常消退。
  - 控制台报错 `0` 条，网络请求失败 `0` 个（`50/50` 成功）。
