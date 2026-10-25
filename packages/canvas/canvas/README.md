# \`lfaa-canvas\`

LFAA 系统级无限画布项目、节点、连线、视口与项目素材的唯一业务数据 Owner。画布不是独立 App：同一套画布引擎由所有 App 共用，但数据按**账户 + App 作用域**隔离。通用 Workflow 定义、运行记录和 AI 生成能力不归本包；本包只持有用户可编辑的画布文档及素材二进制，当前不实现真实 AI 生成节点、即梦 CLI、语音、全景或知识库联动。

- **权威归属：** 项目 JSON 与项目素材文件、画布格式（\`lfaa-canvas-project\` / \`formatVersion 2\` 含 \`applicationId\`）、节点/连线/视口/素材边界、\`expectedUpdatedAt\` 并发语义、账户与 App 隔离路径全部由本包决定。控制器只做协议适配，客户端只做展示与交互。
- **公开合同：** 包入口 \`src/index.ts\` 导出 \`CanvasService\`、读写函数、\`CanvasConflictError\`、\`CANVAS_LIMITS\`、\`CANVAS_NODE_TYPE_PATTERN\` 与类型；Cordis 服务名 \`lfaaCanvas\`，由 \`apply(ctx)\` 通过 \`ctx.provide\` 注册。\`list(userId, applicationId?)\` 省略 App 时枚举已登记 App（画布首页用），其余方法都要求显式 \`applicationId\`。
- **运行位置：** Control Plane（Node）。不进入浏览器入口。
- **数据位置：** 当前 \`LFAA_DATA_DIR\` 业务根下 \`/users/<账户 SHA-256>/projects/canvas/<applicationId>/<项目 UUID>/project.json\`，素材位于同项目 \`assets/<素材 UUID>\`。\`applicationId\` 必须来自 \`lfaa-util-values\` 的 \`APPLICATION_IDS\`；非法 App 明确拒绝。账户、Provider、会话与 SQLite 留在 LFAA Home。
- **旧数据：** 上一轮 v1 的 \`projects/canvas/<项目 UUID>/\` 未对用户发布，本包**不读取也不迁移**；\`list\` 全部 App 时只枚举 \`APPLICATION_IDS\` 同名目录，旧 UUID 目录与未知目录会被忽略。
- **安全与一致性：** 只接受已认证账户与服务端校验的 UUID/App ID；项目/素材 ID 不接受任意路径；逐级拒绝符号链接或类型不符的存储路径；账户 + App 隔离由目录结构保证，跨 App 读/写/删除返回 \`null\` 或 \`false\`，不能串数据；JSON 使用 \`atomicWrite\`、素材使用 \`atomicWriteBytes\` 原子替换并在写入后回读校验；账户画布根使用现有私有目录保护；同一项目的写入用 \`expectedUpdatedAt\` 阻止覆盖并发修改，冲突抛 \`CanvasConflictError\`；删除素材前检查画布节点引用。
- **边界：** 每账户每 App 最多 100 个项目、项目 JSON 单文件 4 MiB；每项目最多 200 个节点、400 条连线、100 个素材、项目素材合计 512 MiB；节点文本 20,000 字符、节点数据 64 KiB；坐标绝对值 ≤100,000，节点宽高 120–800，缩放 0.05–8；图片单文件 16 MiB、视频单文件 64 MiB；文件头必须与 MIME（PNG/JPEG/WebP/MP4/WebM）匹配；读取素材支持 Range 并返回真实大小与不可满足标记。节点 \`type\` 从固定四种放宽为 \`^[a-z][a-z0-9._-]{0,63}$\` 的 App 可扩展标识，为后续 App 节点注册留缝；\`data\` 仍是有界 JSON，\`data.assetId\` 存在时必须引用项目内素材。
- **设置与权限：** 不新增独立设置或权限模式；认证由 \`lfaa-authorization\` 中间件负责，数据访问以当前登录账户 + 路由 App 为唯一边界。素材上传大小/类型边界来自本包 \`CANVAS_LIMITS\`，不复制其他包的默认值。
- **启用状态：** 源码实现已完成（App 作用域项目 CRUD、素材上传/读取/删除、边界与路径安全）。Bundle 装配、路由、客户端画布首页/工作区由 Lead 按当轮合同接入；在装配与实页验收完成前不得宣称用户可用。
- **验证：** \`pnpm --filter lfaa-canvas run build\`；回归 \`cd apps/cli && node --import tsx --import ./register-package-loader.mjs --import ./tests/isolated-test-environment.mjs --test tests/canvas-owner.test.mjs\`。
