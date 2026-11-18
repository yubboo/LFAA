# DEV-000024｜有项目时隐藏左二项目列表底部的“本地工作区项目”提示

- 任务编号：000024
- 开始时间：2026-11-17 21:47:50 +08:00
- 完成时间：2026-11-17 21:56:00 +08:00
- 类型：fix
- 状态：完成（Cordis 单元测试 5/5、`typecheck`、`build` 与内置浏览器视觉实测通过）
- 审批级别及批准证据：A0；负责人截图红框指出已有项目时左二列表下方不应继续显示“本地工作区项目”说明文案
- 关联 Issue/PR/Commit：无

## 本轮目标与非目标

- 目标：在 `NavigationGroups.tsx` 移除 `projects.length > 0` 时附加的 `footerNote: locale.localProject`，让已有项目列表保持干净整洁。
- 不在范围：尚未批准的 `@lfaa/ui-theme` 等 A1 跨包拆分调整（待负责人回复上条架构拆包计划后单独实施）。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `packages/ui/layout/client/components/NavigationGroups.tsx` | 移除 `projects` 分组中的 `footerNote: locale.localProject`，已有项目时不再在列表末尾展示多余提示 |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-BpG9scTR.css`、`apps/web/dist/assets/index-DIYqEU3x.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000024-20261117-2155-hide-project-list-footer-note.md` | 记录本轮 UI 精简修改与验证结果 |
| 新增文件 | `docs/updata-log/000024-20261117-2155-hide-project-list-footer-note.md` | 记录左二项目列表底部不再显示“本地工作区项目”文案 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts` | 通过 | 5/5 用例通过 |
| `pnpm run typecheck` | 通过 | 4 个子项目 0 错误 |
| `pnpm run build` | 通过 | Vite 8.3.8 转换 6620 个模块，输出 `dist/assets/index-BpG9scTR.css` 与 `dist/assets/index-DIYqEU3x.js`，耗时 `860ms` |
| 内置浏览器实测（`http://127.0.0.1:5173/`，`1440×900`） | 通过 | HTTP 200，0 条控制台/页面错误；左二“项目”列表展示 `app1`、`app`，已彻底移除下方“本地工作区项目”文案 |

## 风险、回滚与遗留问题

- 风险：无。
- 回滚办法：在 `NavigationGroups.tsx` 恢复 `footerNote: locale.localProject` 并重新构建即可。
- 遗留问题：上轮提出的 A1 跨包架构拆分方案（`@lfaa/ui-theme` 等）待负责人确认后实施。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：左二已有项目列表底部更加精简整洁，已同步新增同编号 `updata-log`。
