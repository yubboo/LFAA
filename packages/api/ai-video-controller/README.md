# `lfaa-api-ai-video-controller`

提供认证后的 AI 漫剧项目列表、创建、更新、删除、镜头图片/视频生成、任务查询/排队取消、参考图管理、媒体库读取/上传/删除、项目导出保存和镜头取景图片上传。更新合同校验剧本、角色/场景档案、镜头、连线、时间线及白模相机数据；控制器只解析有界请求并委派 `lfaa-video-ai-video`，不直接持有创作文件或模型密钥。

更新使用 `expectedUpdatedAt` 做并发冲突检查。服务端按当前认证用户读写账户隔离的画布文档。路由由 Web App Bundle 装配，Web 与桌面复用同一 API。

图片和视频生成只在用户明确点击或 Agent Tool 经统一 Permission Owner 执行后发生。图片参考由 AI Video Owner 从项目本机素材读取并交由 LLM Provider 组装服务商协议；视频任务 ID/状态与下载后的 MP4 由 AI Video Owner 保存。参考图、媒体文件和导出结果的真实性/配额由 Owner 校验；上传为有界原始二进制请求并受并发上限保护；媒体读取按登录账户与项目素材引用授权，支持 Range 流。本控制器不接受客户端文件路径或任意 Provider URL，也不提供 ComfyUI 执行器。浏览器编码器与设备相机需按实际环境验收。

控制器还将当前认证账户的 AI 漫剧项目媒体注册为 `SystemFileLibrary` 只读挂载：项目与媒体清单仍由 `lfaa-video-ai-video` 返回，媒体下载委派回同一 Owner 的认证流；文件管理不扫描账户目录、不改媒体、不会创建第二份素材。
