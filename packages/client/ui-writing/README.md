# lfaa-client-ui-writing

Web/Desktop 共用的写作管理面板。`normal/WritingWorkspace` 负责作品目录、大纲/章节编辑、修订和导入导出；`normal/WritingBookInfo` 展示当前作品、章节及保存说明，复用 `normal/WritingBookSkillsPanel` 管理作品写作方法。工作区组合归 `client/ui-workspace`。

作品和写作方法经 Client Connection 的认证 API 读取/保存，真实归属、并发校验和事务归 `document/writing` 等原 Owner；Client 不另建作品或权限。面板不提供 App 专属 Agent 会话、模型配置或工作模式，执行归共享 `/work` 与原 Agent Loop。原作品角色配置和服务端方法保留，不迁移或重置偏好。

模块在 `src/client/index.ts` 可撤销登记，公开写作编辑器及作品信息入口；依赖由 package.json 声明，不在浏览器运行数据库、Shell 或节点执行器。沿用工作台 Appearance 的主题、颜色、字体/字号、对比度、壁纸、遮罩/模糊和减少动态效果，目录/编辑器/侧栏使用已有容器布局。

构建只输出根 `dist/packages/client/ui-writing/`。本包当前不是模板生成或动态应用运行时。实际检查与未验收范围见 [合同](../../../docs/PROMPTS.md#lfaa-application-panels-templates-20261016)。

普通写作的中心编辑器复用 `ui-primitives/LightRays`，其 `appearance.advanced.writingLightRaysEnabled` 由设置中心和写作工具栏共用；工具栏通过 Client Connection 保存 `appearance`，不另建本地偏好。光线层尊重 Appearance 强调色、遮罩透明度和减少动态效果设置，不读取作品内容。
