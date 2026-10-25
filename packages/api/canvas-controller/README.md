# \`lfaa-api-canvas-controller\`

系统级无限画布的认证 API 适配层。控制器只解析有界请求、校验协议字段并以当前登录账户 + 路由 App 委派 \`lfaa-canvas\` 服务；不持有画布文件、素材或第二条业务规则。

- **路由：** 全部要求登录（\`requireAuthentication\`）。
  - \`GET /canvas/projects\` → 当前账户全部 App 的画布摘要 \`{ projects }\`（画布首页）
  - \`GET /apps/:applicationId/canvas/projects\` → 该 App 摘要
  - \`POST /apps/:applicationId/canvas/projects\` body \`{ title }\` → 201 \`{ project }\`
  - \`GET /apps/:applicationId/canvas/projects/:projectId\` → \`{ project }\`，不存在 404
  - \`PUT /apps/:applicationId/canvas/projects/:projectId\` body \`{ expectedUpdatedAt, project }\` → \`{ project }\`，过期 409
  - \`DELETE /apps/:applicationId/canvas/projects/:projectId\` → 204
  - \`POST /apps/:applicationId/canvas/projects/:projectId/assets?expectedUpdatedAt=&name=\`（\`express.raw\`，PNG/JPEG/WebP/MP4/WebM）→ 201 \`{ project }\`
  - \`GET /apps/:applicationId/canvas/projects/:projectId/assets/:assetId\` → 二进制，支持 Range 与 416，\`Cache-Control: private, no-store\`
  - \`DELETE /apps/:applicationId/canvas/projects/:projectId/assets/:assetId?expectedUpdatedAt=\` → \`{ project }\`
- **校验：** Joi 校验 body/query/path 并 \`unknown(false)\`；\`applicationId\` 只接受 \`APPLICATION_IDS\`，非法值 400；标题、节点、连线、视口、素材列表与节点类型标识上限取自 \`lfaa-canvas\` 的 \`CANVAS_LIMITS\`/\`CANVAS_NODE_TYPE_PATTERN\`，不复制第二套默认值。未知字段、无效 UUID、超界坐标/尺寸、错误 MIME 文件头、引用缺失素材均由 Owner 拒绝并映射为 400；并发冲突映射 409。
- **账户与 App 边界：** 账户来自认证会话，App 来自路径参数；路由参数只用于定位该账户该 App 自己的项目，不接受本机路径。跨 App 读写按不存在处理（404），不能串数据。读取素材按登录账户 + App + 项目素材清单授权，并设置流关闭清理。
- **装配：** \`inject ["apiGateway", "lfaaCanvas"]\`，在 \`apply(ctx)\` 中通过 \`ctx.apiGateway.register\` 登记，由 Web App Bundle 装配；Web 与桌面复用同一 API。Bundle 装配完成前不得宣称路由已对用户可用。
- **验证：** \`pnpm --filter lfaa-api-canvas-controller run build\`；接口冒烟由 Lead 在装配后按 Web Profile 执行。
