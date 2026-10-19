# 应用面板分离交付记录

日期：2026-10-16。合同：[LFAA-APPLICATION-PANELS-TEMPLATES-20261016](../PROMPTS.md#lfaa-application-panels-templates-20261016)。

## 当前交付

普通 App 外壳展示“应用面板/应用工具”，不再展示 Agent 能力资源、侧聊及未接入的 Agent 审查/浏览器入口。对话、能力发现、Git 摘要、侧聊继续由共享 `/work` 提供。既有领域服务、数据、工具和三种权限模式保留。

写作的旧 AI 上下文 UI 由普通作品信息替代，保留作品/章节、保存说明和原有作品 Skill 管理；移除 App 专属会话、模型、角色选择和模式切换。保存的作品角色及服务端配置保留，没有数据迁移。写作编辑器原先未消费的能力目录 props 移除，普通应用不再为 Agent 目录额外请求。

用户确认的成果模板、应用面板模板及自定义管理目标已记录于 [模板目标](application-panels-templates.zh.md)，本轮没有实现模板引擎、模板 CRUD 或动态面板运行时。

## 设置与性能

没有新增设置或重置账户偏好。继续使用 `general.navigationLayout/showServiceStatus/showBottomPanelControl/terminalPosition`、原快捷键与保存行为、`plugins.enabled/skillDirectories`、`permissions.mode` 及 Appearance 的主题、颜色、字体字号、对比度、壁纸、遮罩透明度、模糊和减少动态效果映射。面板复用原容器响应式与 Dock/Overlay。

静态工作量：普通面板的能力目录读取从每次挂载 1 次变为 0 次；写作不再接收未使用的目录 props。共享工作目录查询提供取消信号，账户/区域变更和卸载撤销请求；默认调用方仍保留原并发合并。没有新增轮询、全局事件、缓存或计时器。取消和并发读取行为有回归证据，以上请求次数为代码路径核对，未测实际帧时间。采用 React 检查清单核对按需模块、Effect 撤销、稳定依赖和语义控件，未引入新库。

## 验证

- `node --import tsx --test tests/client-requests.test.mjs`（apps/cli）：10/10 通过，包括目录请求取消与默认共享读取互不影响。初次增加 signal 时破坏默认合并，已修正为仅有信号时传入并重新全量通过；初次失败的组合测试进程已终止。
- `node --import tsx --import ./register-package-loader.mjs --test tests/xiaoyu-shared-agent.test.mjs`（apps/cli）：4/4 通过，覆盖旧工作路由、常规路由、账户/会话/关联及节点能力边界。
- `pnpm run typecheck`：Client、Host 通过。
- `pnpm --filter lfaa-client-connection build`、`pnpm --filter lfaa-client-ui-writing build`、`pnpm --filter lfaa-client-ui-workspace build`：通过，产物在根 `dist/packages/client/`。
- `pnpm run build:web`：通过，2261 个模块，输出根 `dist/apps/web/`。
- `pnpm run sync:workspace`、后续 `pnpm run check:workspace`：通过，192 个包。同步包清单与原类型路径映射，无新包。
- `git diff --check`：通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`，Web 无过期项。

## ChatGPT 内置浏览器实页

隔离入口 `http://127.0.0.1:31316` 使用当前源码 Host 与正式 Web 构建；账户和作品只在本轮 `dist/.tmp/application-panel-check-20261016` 内生成，没有访问或改变既有账户/作品。

- `/work`：共享聊天及能力资源、Git 摘要、侧聊入口仍可见。隔离账户没有 Provider，界面准确显示未配置，未发送模型请求。
- `/apps/writing/normal`：空作品信息、新建作品、编辑正文、保存、切换共享工作、返回及刷新恢复通过；正文与 31 字计数恢复。侧栏只显示作品信息、原写作方法管理和保存说明，无旧 App 专属 AI Work 切换。
- `/apps/connectivity/normal`：业务状态与原操作保留，右侧为应用工具，未出现 Agent 能力目录和审查/浏览器占位。未配置联机服务真实显示待配置，未创建线路。
- 目视覆盖原桌面 1309×682、明确覆盖 1300×720 与 760×520；窄短屏作品长标题换行，侧栏/编辑区关键操作可达，未观察到新增横向溢出。现有深色主题、字体、强调色、壁纸及遮罩/模糊映射可见；主题切换与其他外观组合未测。
- 当时的桌面与窄短屏截图只保存在本机忽略目录 `dist/reports/application-panels-20261016/`，未纳入 Git，当前 checkout 不包含图片；已移除失效链接，视口覆盖记录仍见上文。

未验收：真实 Provider/多 Agent 模板任务、模板生成与管理、远程节点、真实桌面安装包、手机、帧时间及全部领域动作。源码和构建通过不代表这些范围通过。

## 逐文件职责（本轮路径）

| 绝对路径 | 职责与本轮改动 |
|---|---|
| `H:/LFAA1/packages/client/ui-workspace/src/ApplicationWorkspace.tsx` | 分开普通面板与 Agent 资源展示，目录按需读取及取消，装配普通作品信息 |
| `H:/LFAA1/packages/client/connection/src/api.ts` | 能力目录支持 AbortSignal，保持默认并发合并 |
| `H:/LFAA1/apps/cli/tests/client-requests.test.mjs` | 目录取消不影响共享读取的回归 |
| `H:/LFAA1/packages/client/ui-writing/src/client/index.ts` | 注册新的普通作品信息模块，移除旧入口 |
| `H:/LFAA1/packages/client/ui-writing/src/normal/WritingWorkspace.tsx` | 删除未消费的能力目录 props/type |
| `H:/LFAA1/packages/client/ui-writing/src/normal/WritingBookInfo.tsx` | 普通作品/章节信息与原作品方法管理组合 |
| `H:/LFAA1/packages/client/ui-writing/src/normal/WritingBookInfo.css` | 作品卡片主题、壁纸与长标题换行 |
| `H:/LFAA1/packages/client/ui-writing/src/normal/WritingBookSkillsPanel.tsx` | 原管理器迁入普通面板目录；业务操作保留 |
| `H:/LFAA1/packages/client/ui-writing/src/normal/WritingBookSkillsPanel.css` | 原管理器样式随组件迁移 |
| `H:/LFAA1/packages/client/ui-writing/src/ai-work/WritingAiContext.tsx` | 删除被替代的旧 App 专属 AI 上下文 |
| `H:/LFAA1/packages/client/ui-writing/src/ai-work/WritingAiContext.css` | 删除旧上下文与模式样式 |
| `H:/LFAA1/packages/client/ui-writing/src/ai-work/WritingBookSkillsPanel.tsx` | 迁移后删除旧位置 |
| `H:/LFAA1/packages/client/ui-writing/src/ai-work/WritingBookSkillsPanel.css` | 迁移后删除旧位置 |
| `H:/LFAA1/packages/client/ui-writing/README.md` | 补充 Client 包边界与当前实现 |
| `H:/LFAA1/packages/client/ui-workspace/README.md` | 面板分离和后续模板范围 |
| `H:/LFAA1/packages/client/connection/README.md` | 可取消目录请求合同 |
| `H:/LFAA1/docs/PROMPTS.md` | 本轮合同和验证记录 |
| `H:/LFAA1/docs/系统总体架构.md` | 产品主线及模板目标/事实区分 |
| `H:/LFAA1/docs/开发计划.md` | 两类模板后续顺序 |
| `H:/LFAA1/docs/development/application-panels-templates.zh.md` | 中文模板目标和验收边界 |
| `H:/LFAA1/docs/development/application-panels-templates.md` | 配对英文入口 |
| `H:/LFAA1/docs/development/application-panels-20261016.md` | 本交付记录 |
| `H:/LFAA1/docs/harness-packages.json` | 生成清单登记新增包 README |
| `H:/LFAA1/docs/harness-packages.md` | 同步生成清单 |
| `H:/LFAA1/tsconfig.client.json` | workspace 同步器重写现有路径映射，无新增包/映射要求 |
| `H:/LFAA1/tsconfig.host.json` | workspace 同步器重写现有路径映射，无新增包/映射要求 |

已有无关工作树改动未回退、暂存、提交或发布。

## 清理

旧 UI 文件已移除，Skills 已迁移。删除已迁空的 `H:/LFAA1/packages/client/ui-writing/src/ai-work` 目录被自动审批审核以 `blocked by policy` 拒绝；保留空目录，不使用其他方式绕过拒绝。清理隔离测试目录 `H:/LFAA1/dist/.tmp/application-panel-check-20261016` 同样被自动审批审核拒绝，仅返回 `blocked by policy`；目录中本轮合成账户与作品暂时保留，不代表用户数据或产品默认数据。单独停止了本轮 PID 4332 的临时服务，验收标签已关闭，视口覆盖已恢复；未重启或停止既有服务。截图保存在根 `dist/reports/application-panels-20261016/` 作为交付证据。
