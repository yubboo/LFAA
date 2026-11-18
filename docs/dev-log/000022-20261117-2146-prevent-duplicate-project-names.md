# DEV-000022｜禁止创建与重命名重复的项目名称（Host + Client 双重校验）

- 任务编号：000022
- 开始时间：2026-11-17 21:38:15 +08:00
- 完成时间：2026-11-17 21:47:00 +08:00
- 类型：fix
- 状态：完成（Cordis 单元测试 5/5、`typecheck`、`build`、Host HTTP 接口实测与内置浏览器实测均已通过）
- 审批级别及批准证据：A0；负责人截图指出左侧项目列表出现同名项目 Bug，要求禁止重复项目名
- 关联 Issue/PR/Commit：无

## 本轮目标与非目标

- 目标：
  1. 在 Host `WorkspaceService` 建立不区分大小写与首尾空格的项目名唯一性校验 `assertUniqueInList`。
  2. 在 `resolveDefaultProjectPath`、`createProject` 与 `updateProject` 均强制校验唯一性：同名或大小写重名时直接抛出明确报错，禁止生成重复项目或创建多余目录；若该项目名已从 LFAA 移除、仅磁盘上保留同名旧目录，新建时仍可按规则递增 `app1 2` 目录后缀。
  3. 在 Client `LocalProjectStore.hasProjectName`、`ProjectDialog` 与 `EditProjectDialog` 补充前置校验：新建输入重名时在弹出“信任此文件夹吗？”之前即时拦截；编辑改名与其他项目冲突时保持弹窗并提示更换名称。
- 不在范围：强制改写用户磁盘上既有的 `~/.lfaa/projects.json`（仅在新建与编辑时拦截新重名）。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `packages/workspace/workspace/src/index.ts` | 新增 `assertUniqueInList`（忽略首尾空格与大小写），在 `resolveDefaultProjectPath`、`createProject`、`updateProject` 强制拦截重复项目名称（共 `324` 行，>300 自检：保持在单个 `WorkspaceService` 内聚，低于 500 拆分上限） |
| 修改文件 | `packages/workspace/workspace/client/local-project-store.ts` | 新增 `hasProjectName(name, excludeProjectId?)` 客户端即时重名判断 |
| 修改文件 | `packages/workspace/workspace/client/locales.ts` | 新增 `projectNameDuplicate` 中英文重名错误提示 |
| 修改文件 | `packages/workspace/workspace/client/components/ProjectDialog.tsx` | 在“创建项目”提交进入信任确认前检查重名并阻止弹出信任框（共 `373` 行，>250 自检：低于 400 上限） |
| 修改文件 | `packages/workspace/workspace/client/components/EditProjectDialog.tsx` | 在“编辑项目”保存前排除自身 ID 检查与其他项目的重名冲突（共 `299` 行，>250 自检：低于 400 上限） |
| 修改文件 | `packages/workspace/workspace/tests/cordis-lifecycle.test.ts` | 更新并发/唯一性用例：验证活跃项目阻断 `APP1`/` app1 ` 重复解析、创建与编辑重命名，移除后磁盘同名残留仍递增 `app1 2` |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-BJjUnFj3.css`、`apps/web/dist/assets/index-CBwi8bwF.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000022-20261117-2146-prevent-duplicate-project-names.md` | 记录重名拦截实现与完整验证证据 |
| 新增文件 | `docs/updata-log/000022-20261117-2146-prevent-duplicate-project-names.md` | 记录修复允许同名项目的问题 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts` | 通过 | 5/5 用例全过（覆盖活跃项目大小写/空格重名拦截、移除后磁盘重名自动顺延及编辑重命名冲突拦截） |
| `pnpm run typecheck` | 通过 | `apps/cli`、`apps/web`、`@lfaa/ui-layout`、`@lfaa/workspace` 0 错误 |
| `pnpm run build` | 通过 | Vite 8.3.8 转换 6617 个模块，输出 `dist/assets/index-BJjUnFj3.css`（`63.77 kB`）与 `dist/assets/index-CBwi8bwF.js`（`368.67 kB`），耗时 `834ms` |
| 内置浏览器 UI 实测（`http://127.0.0.1:5173/`，`1440×900`） | 通过 | 0 条控制台/页面错误；“新建项目”输入 `"APP"` 点击“创建项目”未进入“信任此文件夹吗？”并显示提示“项目名称已存在，请更换其他名称。”；“编辑项目”将 `app1` 改名为 `"app"` 点击“保存”保持弹窗并显示“项目名称已存在，请更换其他名称。”；已有项目 `app1` 与 `app` 完好保留 |
| Host HTTP 接口实测（`POST` / `PATCH` 直连 `127.0.0.1:5173`） | 通过 | `POST /api/workspace/projects`（`name: "app"`）返回 `400` `{"error":"项目名称“app”已存在，请更换其他名称。"}`；`PATCH /api/workspace/projects/:id`（`name: "APP"`）返回 `400` `{"error":"项目名称“APP”已存在，请更换其他名称。"}` |

## 风险、回滚与遗留问题

- 风险：无。
- 回滚办法：回退上述 6 个代码文件的唯一性检查逻辑并重新执行 `pnpm run build` 与重启 `pnpm lfaa web`，删除本轮 `000022` 两份日志。
- 遗留问题：无。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：修复了允许创建/重命名同名项目的 Bug，已同步新增同编号 `updata-log`。
