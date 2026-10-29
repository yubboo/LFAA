# `lfaa-video-ai-video`

AI 漫剧项目、创作画布、媒体库、时间线与白模导演台的唯一 Owner。创作画布与通用 Workflow 定义、运行记录分开；项目文件保存剧本、角色/场景档案、镜头和连线、Provider 任务、媒体清单、时间线片段与 3D 白模/相机参数。镜头连接允许环路，因为这些是创作关系，不是执行 DAG。

每个项目位于当前 `LFAA_DATA_DIR` 业务根 `/users/<账户 SHA-256>/projects/aivideo/<项目 UUID>/project.json`，只接受已认证账户和服务端校验的 UUID，不接受客户端路径。首次业务根为 `<LFAA_HOME>/data`，由设置中心“项目与存储”统一选择；账户、AI Provider、会话与 SQLite 留在 LFAA Home。新根保存后重启 LFAA，使控制端与本机 Daemon 统一采用所选 Data 根。业务根切换只保留旧根并创建新业务分类；项目迁移只处理游戏、Writing 与 AI Video 受管目录，不复制账户/控制数据。项目 JSON 通过现有 `atomicWrite` 原子替换，目录使用现有私有目录保护，写操作复用控制端写锁。当前格式版本为 7，兼容读取 v1–v6，旧项目新增字段采用安全默认值。共享 Canvas adapter 把同一 Owner 项目映射成剧本、档案、镜头、时间线、导演台与媒体节点；画布视口/节点布局也保存在该项目，不创建通用 Canvas 副本。每账户最多 20 个项目、项目 JSON 合计最多 4 MiB；每项目最多 64 个镜头、128 条连线、24 个角色、24 个场景和 100,000 个剧本字符；每个镜头最多关联 8 个角色和 1 个场景。更新要求匹配服务端 `updatedAt`，防止覆盖并发修改。

静帧镜头图像由设置中心在远程 OpenAI/豆包 Provider、火山方舟 Agent Plan 与 LFAA 本地模型间选择；本地路径调用 `lfaa-llm-local-runtime` 的已登记 MOSS-Image 原生 Diffusers 适配器。远程图像可按 Provider 官方参考图字段传入本机角色/场景档案；Agent Plan 只允许套餐目录中登记的 Seedream 图像能力模型。首发 MOSS 适配只支持文字/布局提示，遇到参考图时明确拒绝，不静默改用远程服务。视频同样支持远程火山方舟按量 API、Agent Plan 专属视频端点与 LFAA 本地 MiniMax-H3 FL2VA 模型；Agent Plan 只允许 Large/Max 档位目录中的 Seedance 模型。远程任务按账户原 Provider 路由并保存真实服务商 ID/状态，按固定来源下载成片；本地任务由受管本机模型进程生成，状态由 AI Video Owner 持有，取消会终止模型执行。两种模式成功后都通过同一项目素材事务校验并保存到项目 `assets/`；仅本机模型的已提交输出另镜像到 `Data/output/<账户 SHA-256>/`，不取代项目素材副本。

角色/场景参考图支持认证上传、读取、替换和删除，限定 PNG/JPEG/WebP、单张 3 MiB、边长 8192 像素和总像素 2000 万；复用 Settings 既有文件头/尺寸解析。媒体库支持 PNG/JPEG/WebP、MP4/WebM、MP3/WAV/OGG 导入；项目 `assets/` 仍是编辑权威副本，经过 AI Video 校验的用户上传素材会原子镜像到账户隔离的 `Data/input/<账户 SHA-256>/`，作为本机可访问的输入素材副本；AI Video 推理仍从项目 Owner 读取已校验素材。JSON 保存素材 ID/MIME/大小/名称/来源；认证读取支持 Range 流，删除前检查角色、场景、镜头及时间线引用。账户项目素材最多 2048 个文件、合计 2 GiB、单素材 128 MiB；图片上限 16 MiB。Input/Output 镜像由用户按本机文件系统管理，不随项目删除自动清理。时间线有视频、音频、字幕轨，单轨不重叠、最多 256 个片段、最长 300 秒。浏览器按 MediaRecorder 的真实能力导出 MP4/WebM，限制 128 MiB，音轨源文件合计最多 32 MiB，成片回写项目媒体库；浏览器/远程 Provider 结果不自动进入本机 `output/`。

系统文件管理通过 `ai-video-controller` 的只读 FileMount 展示同一媒体清单，并把下载流委派给本 Owner；不会复制 `assets/` 或开放其任意目录写操作。

白模导演台在同一项目保存最多 32 个角色/方块几何体及相机位置、角度、焦距和比例；共享工作区用 Canvas 透视投影绘制场景，白模取景可保存为镜头参考。手机设备取景只在用户点击后启动 `getUserMedia`，切页、隐藏窗口或卸载时停止设备轨道，拍摄帧通过认证 Owner 写入镜头素材。无法访问相机时显示真实错误。`expert.aivideo-director` 是由模型选择的 App-scoped 领域员工；工具由 `packages/video/tool-ai-video` 负责，读取/写入覆盖布局、时间线、导演台和素材元数据，所有写入/计费操作沿用统一 Permission Owner。通用 `canvas_*` 不对漫剧 Agent 暴露。旧版 `storyboards.json` 在分项写入并回读验证后原子改名为迁移恢复副本。构建输出位于仓库根 `dist/packages/video/ai-video/`。
