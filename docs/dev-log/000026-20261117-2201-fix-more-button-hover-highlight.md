# DEV-000026｜修复移入项目行时 `···` 按钮误加高亮底色的问题

- 任务编号：000026
- 开始时间：2026-11-17 22:00:16 +08:00
- 完成时间：2026-11-17 22:02:00 +08:00
- 类型：fix
- 状态：完成（Cordis 单元测试 5/5、`typecheck`、`build` 与内置浏览器视觉核查通过）
- 审批级别及批准证据：A0；负责人截图红框指出鼠标仅停留在项目名称区域时 `···` 按钮不应出现方框高亮背景
- 关联 Issue/PR/Commit：无

## 本轮目标与非目标

- 目标：在 `NavigationGroups.tsx` 将 `···` 按钮的 `.rowActionBtnActive` 激活类名绑定从 `isHighlighted`（包含 `isCardOpen`）缩小为仅在 `isMenuOpen` 为真时生效，避免整行悬停触发信息卡时给 `···` 额外套上按钮激活底色。
- 不在范围：尚未批准的 A1 跨包重构（`@lfaa/ui-theme` 等）。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `packages/ui/layout/client/components/NavigationGroups.tsx` | 将 `···` 按钮激活类从 `isHighlighted` 改为 `isMenuOpen`，仅点击弹出操作菜单时保持激活高亮，悬停本身由 `:hover` 控制 |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-BpG9scTR.css`、`apps/web/dist/assets/index-B9qH8K-8.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000026-20261117-2201-fix-more-button-hover-highlight.md` | 记录高亮逻辑修复与核查结果 |
| 新增文件 | `docs/updata-log/000026-20261117-2201-fix-more-button-hover-highlight.md` | 记录移除悬停项目名称时 `···` 误高亮的效果优化 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts` | 通过 | 5/5 用例通过 |
| `pnpm run typecheck` | 通过 | 4 个子项目 0 错误 |
| `pnpm run build` | 通过 | Vite 8.3.8 转换 6620 个模块，输出 `dist/assets/index-BpG9scTR.css` 与 `dist/assets/index-B9qH8K-8.js`，耗时 `840ms` |
| 内置浏览器视觉核查（`http://127.0.0.1:5173/`，`1440×900`） | 通过 | 0 条控制台/页面错误；点击 `···` 打开菜单时 `aria-expanded="true"` 且带 `_rowActionBtnActive` 高亮；关闭菜单并仅悬停 `app1` 左侧名称时信息卡正常弹出，同时 `···` 类名仅 `_rowActionBtn`（`aria-expanded="false"`）且截图中无多余方框底色 |

## 风险、回滚与遗留问题

- 风险：无。
- 回滚办法：在 `NavigationGroups.tsx` 恢复原高亮条件并重新构建即可。
- 遗留问题：上轮提出的 A1 跨包架构拆分方案（`@lfaa/ui-theme` 等）待负责人确认后实施。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：悬停项目行不再误触发 `···` 按钮高亮框，已同步新增同编号 `updata-log`。
