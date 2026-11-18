# DEV-000029｜为移出项目增加统一二次确认弹窗（覆盖菜单、编辑弹窗与上下文面板三个入口）

- 任务编号：000029
- 开始时间：2026-11-17 22:35:18 +08:00
- 完成时间：2026-11-17 22:43:30 +08:00
- 类型：feat
- 状态：完成（Cordis 单元测试 10/10、`typecheck`、`build` 与内置浏览器桌面/移动端实测通过）
- 审批级别及批准证据：A0；负责人上传确认弹窗参考截图并要求“移出项目，有二次确认的”
- 关联 Issue/PR/Commit：无

## 设计与实现详情

1. **新增统一二次确认弹窗 `RemoveProjectDialog`**：
   - 新增 `packages/workspace/workspace/client/components/RemoveProjectDialog.tsx`（105 行）与 `RemoveProjectDialog.module.css`（142 行）。
   - 采用 `role="alertdialog"`、`aria-modal="true"` 居中液态玻璃卡片，显示标题 `移除 <项目名>?`（英文 `Remove <project>?`）、说明文案“这只会从应用中移除该项目。你电脑上的文件和现有聊天不会被删除。”、右上角关闭按钮 `×`、`取消` 按钮（默认获焦防误触）及柔和暗红警示按钮 `移除项目`（兼容深色与浅色主题变量，执行期间禁用防连点并展示接口错误）。
2. **收敛全部三个移出入口至统一状态机**：
   - 在 `packages/workspace/workspace/client/project-menu-store.ts`（185 行）新增 `removingProjectId` 状态及 `openRemoveConfirm` / `closeRemoveConfirm` 方法，并在模态打开期间屏蔽侧栏行悬停卡片触发。
   - 在 `packages/workspace/workspace/client/components/ProjectOverlays.tsx`（119 行）接入 `RemoveProjectDialog` 挂载：
     1. 项目行 `···` → `移除项目` 菜单点击不再直接调用 `DELETE`，而是打开二次确认弹窗；
     2. `EditProjectDialog.tsx`（281 行）中「移除本地项目」按钮改为触发 `onRequestRemove(project.id)`，确认弹窗以更高层级（`z-index: 115`）叠于编辑弹窗之上，点取消回到编辑页、确认移出则同步关闭编辑与确认弹窗；
     3. 右侧上下文面板 `ProjectContextCard`（`packages/workspace/workspace/client/index.tsx` 第 77-83 行）中「从项目列表移除」同样改为打开二次确认弹窗，确认后由 `onProjectRemoved` 清理选中状态并返回首页。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 新增文件 | `packages/workspace/workspace/client/components/RemoveProjectDialog.tsx` | 实现移出项目二次确认弹窗与确认删除/失败提示逻辑（105 行） |
| 新增文件 | `packages/workspace/workspace/client/components/RemoveProjectDialog.module.css` | 居中液态玻璃弹窗、深浅双色红底警示按钮与自适应排版样式（142 行） |
| 修改文件 | `packages/workspace/workspace/client/locales.ts` | 新增 `removeConfirmPrefix`、`removeConfirmDescription`、`removingProject` 中英文案（162 行） |
| 修改文件 | `packages/workspace/workspace/client/project-menu-store.ts` | 新增 `removingProjectId` 快照字段及 `openRemoveConfirm` / `closeRemoveConfirm` 与弹窗期间防悬停守卫（185 行） |
| 修改文件 | `packages/workspace/workspace/client/components/EditProjectDialog.tsx` | 移除直接删除逻辑，将底部「移除本地项目」切换为触发 `onRequestRemove`（281 行） |
| 修改文件 | `packages/workspace/workspace/client/components/ProjectOverlays.tsx` | 将 `ProjectActionMenu.onRemove` 与 `EditProjectDialog.onRequestRemove` 接入二次确认弹窗并挂载 `RemoveProjectDialog`（119 行） |
| 修改文件 | `packages/workspace/workspace/client/index.tsx` | 将右侧上下文面板 `ProjectContextCard.onRemove` 切换为 `menuStore.openRemoveConfirm`（116 行） |
| 修改文件 | `packages/workspace/workspace/tests/cordis-lifecycle.test.ts` | 补充 `ProjectMenuStore` 二次确认开关状态回归单元测试 |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-CtlN_GGW.css`、`apps/web/dist/assets/index-D5THBtVK.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000029-20261117-2243-remove-project-confirm-dialog.md` | 记录移出项目二次确认弹窗实现、入口收敛与全量验证结果 |
| 新增文件 | `docs/updata-log/000029-20261117-2243-remove-project-confirm-dialog.md` | 记录移出项目前的二次确认保护与文案提示变更 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts packages/workspace/sections/tests/sections-lifecycle.test.ts packages/ui/theme/tests/theme-lifecycle.test.ts` | 通过 | 10/10 用例通过（`tests 10, pass 10, fail 0, duration_ms 841.442`），含新增 `ProjectMenuStore` 二次确认状态测试 |
| `pnpm run typecheck` | 通过 | 6 个子项目 0 错误（`TYPECHECK_EXIT=0`） |
| `pnpm run build` | 通过 | Vite v8.3.8 转换 6634 个模块，输出 `dist/assets/index-CtlN_GGW.css`（72.36 kB）与 `dist/assets/index-D5THBtVK.js`（397.16 kB），耗时 `882ms` |
| 内置浏览器实测（`http://127.0.0.1:5173/`，桌面 `1440×900` + 移动 `390×844`） | 通过 | 0 条控制台/页面错误；使用临时项目 `"temp-remove-test"` 依次实测 3 个入口：（1）菜单 `···` → `移除项目` 弹出 `"移除 temp-remove-test?"` 且未发 `DELETE`，点 `取消` 保留项目；（2）右侧详情面板 `从项目列表移除` 弹出确认弹窗，按 `Escape` 关闭并保留项目；（3）`编辑项目` 内 `移除本地项目` 将确认弹窗叠层开启在编辑弹窗上方，点 `取消` 完整退回编辑弹窗；（4）`390×844` 移动端确认弹窗宽度 `358px` 居中贴合、无横向溢出（`noHorizontalOverflow: true`）；（5）最终点击确认 `移除项目` 发出 `DELETE` 200（`{"removed":true}`）干净移除项目并返回首页，空测试目录已清理 |

## 风险、回滚与遗留问题

- 风险：无。
- 回滚办法：删除 `RemoveProjectDialog.{tsx,module.css}`，还原上述 5 个 TS/TSX 文件改回直接调用 `removeProject` 并重新构建即可。
- 遗留问题：无。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：移出项目全部入口均增加防误删二次确认弹窗，已同步新增同编号 `updata-log`。
