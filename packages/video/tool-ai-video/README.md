# `lfaa-video-tool-ai-video`

把 AI 漫剧项目操作接入 LFAA 已有的大模型 Agent Loop。九个核心管理工具分别用于列项目、分页读取内容、新建、更新、删除、生成镜头图片、创建视频任务、查询任务/保存成片和取消排队任务；只声明 `aivideo` 应用范围，工具运行时再由 Agent Loop 按当前 App 过滤，不依赖可选插件开关，并通过统一 Permission Owner 处理写入、计费生成和任务取消风险。

本包不调用第二个文本模型、不实现关键词流程、不持有权限或账户凭据，也不直接访问文件路径。项目读写只调用 `lfaa-video-ai-video`，并复用本机项目 JSON、账户隔离和更新时间并发检查；图片/视频生成只调用对应 AI Video Owner，由 Settings 选定 Provider 账户/模型，并把结果状态保存到项目。工具读取使用有界分页，数组写入为整组替换。

Agent 取消会传递到 Provider HTTP 请求；已经创建且返回真实 ID 的异步任务仍先保存回本机项目，避免丢失服务商受理记录。工具只返回真实任务状态和本机素材 ID，不提供本机绝对路径或 Provider 临时 URL。构建输出写入仓库根目录 `dist/packages/video/tool-ai-video/`。
