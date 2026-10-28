# \`lfaa-api-canvas-controller\`

系统级无限画布的认证 API 适配层。控制器只解析有界请求、校验协议字段，并以当前登录账户 + 路由 App 委派 \`lfaa-canvas\`（项目/素材）与 \`lfaa-canvas-generation\`（图片/视频生成编排）；不持有画布文件、素材、Provider 协议或第二条业务规则。

- **路由：** 全部要求登录（\`requireAuthentication\`）。
  - \`GET /canvas/projects\` → 当前账户全部 App 的画布摘要 \`{ projects }\`（画布首页）
  - \`GET /apps/:applicationId/canvas/projects\` → 该 App 摘要
  - \`POST /apps/:applicationId/canvas/projects\` body \`{ title }\` → 201 \`{ project }\`
  - \`GET /apps/:applicationId/canvas/projects/:projectId\` → \`{ project }\`，不存在 404
  - \`PUT /apps/:applicationId/canvas/projects/:projectId\` body \`{ expectedUpdatedAt, project }\` → \`{ project }\`，过期 409
  - \`DELETE /apps/:applicationId/canvas/projects/:projectId\` → 204
  - \`POST /apps/:applicationId/canvas/projects/:projectId/assets?expectedUpdatedAt=&name=\`（\`express.raw\`，PNG/JPEG/WebP/MP4/WebM/MP3/WAV/OGG）→ 201 \`{ project }\`
  - \`GET /apps/:applicationId/canvas/projects/:projectId/assets/:assetId\` → 二进制，支持 Range 与 416，\`Cache-Control: private, no-store\`（音频沿用同一读取路径）
  - \`DELETE /apps/:applicationId/canvas/projects/:projectId/assets/:assetId?expectedUpdatedAt=\` → \`{ project }\`
  - \`POST /apps/:applicationId/canvas/projects/:projectId/generate/image\` body \`{ expectedUpdatedAt, nodeId?, prompt, aspectRatio?, referenceAssetIds?, modelTarget?: { accountId, modelId } }\` → 200 \`{ project, asset }\`；可选目标仅作用于本次请求，由生成 Owner 校验当前账户目录；失败不写可见结果
  - \`POST /apps/:applicationId/canvas/projects/:projectId/generate/video\` body \`{ expectedUpdatedAt, nodeId?, prompt, durationSeconds?, aspectRatio?, referenceAssetIds? }\` → 200 \`{ project }\`，节点 \`data.generation\` 写入 \`running\` 与 \`taskId\`
  - \`POST /apps/:applicationId/canvas/projects/:projectId/generation/:nodeId/refresh\` → 200 \`{ project }\`；只有服务商返回成功并下载到真实成片才落素材并置 \`succeeded\`
  - \`POST /apps/:applicationId/canvas/projects/:projectId/generation/:nodeId/cancel\` → 200 \`{ project }\`；取消排队任务并置 \`failed\`，不登记成片
- **生成错误映射：** 认证失败 401；未配置账户/模型/密钥、参数无效、参考素材越界 → 400 \`canvas_generation_invalid\`；项目/节点不存在 → 404 \`canvas_not_found\`；\`expectedUpdatedAt\` 冲突 → 409 \`canvas_conflict\`；Provider/服务商真实失败 → 422 \`canvas_generation_failed\`；本机视频模型未接通 → 501 \`canvas_generation_unsupported\`，不返回演示结果。画布图片使用远程 Provider，不受 AI 漫剧本机生图模式影响。客户端断开时中止真实请求（\`AbortController\`），不缓存假成功。
- **校验：** Joi 校验 body/query/path 并 \`unknown(false)\`；\`applicationId\` 只接受 \`APPLICATION_IDS\`；标题、节点、连线、视口、素材列表、节点类型标识与素材 MIME 上限取自 \`lfaa-canvas\` 的 \`CANVAS_LIMITS\`/\`CANVAS_NODE_TYPE_PATTERN\`；生成提示词长度、参考图数量与比例枚举取自 \`lfaa-canvas-generation\` 的 \`CANVAS_GENERATION_LIMITS\`/\`CANVAS_IMAGE_ASPECT_RATIOS\`/\`CANVAS_VIDEO_ASPECT_RATIOS\`，不复制第二套默认值。未知字段、无效 UUID、超界坐标/尺寸、错误 MIME 文件头、引用缺失素材均由 Owner 拒绝并映射为 400；并发冲突映射 409。
- **账户与 App 边界：** 账户来自认证会话，App 来自路径参数；路由参数只用于定位该账户该 App 自己的项目，不接受本机路径。跨 App 读写按不存在处理（404），不能串数据。读取素材按登录账户 + App + 项目素材清单授权，并设置流关闭清理；生成的账户/模型来自设置中心，参考图只允许本项目素材。
- **装配：** \`inject ["apiGateway", "lfaaCanvas", "lfaaCanvasGeneration"]\`，在 \`apply(ctx)\` 中通过 \`ctx.apiGateway.register\` 登记，由 Web App Bundle 装配；Web 与桌面复用同一 API。Bundle 装配完成前不得宣称路由已对用户可用。
- **验证：** \`pnpm --filter lfaa-api-canvas-controller run build\`；生成编排的校验/未配置/失败路径由 \`apps/cli/tests/canvas-generation.test.mjs\` 用注入的假生成函数回归（不访问真实网络）；接口冒烟由 Lead 在装配后按 Web Profile 执行。
