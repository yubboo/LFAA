# Settings packages

“项目与存储”的日志/Writing/漫剧位置由 `settings/src/project-storage.ts` 保存，Configuration Domain 的 v54 配置域负责持久化；旧 SQLite 独立表退役与当前配置域不是同一清单。设置页可把已保存位置交给统一文件页浏览，未保存草稿不会作为生效位置；本机磁盘访问仍要求服务端实时超级管理员与完全访问，账户私有内容由原 App Owner 管理。

账户设置类型/默认值权威位于 `util/values/src/settings-contract.ts`，客户端与服务端克隆后消费。`settings/src/validation.ts` 拥有十个分类的严格写入 schema，HTTP 层重导出同一对象；服务直接保存也校验未知/非法值。旧快捷键新增项仍按共享默认值补全，读归一化保留旧记录兼容，不重置偏好。`appearance.updateSurfaceOpacity` 70–100% 校验与控件/类型一致。AI 漫剧图像使用 `aiRuntime.imageGenerationAccountId` / `imageGenerationModelId`；视频使用独立的 `videoGenerationAccountId` / `videoGenerationModelId`，以及 `videoGenerationDurationSeconds`、`videoGenerationRatio`、`videoGenerationResolution`、`videoGenerationGenerateAudio`、`videoGenerationWatermark`。视频默认账号/模型为空，5 秒、自适应、720p、关闭音频、保留水印。服务商仍决定具体模型支持的参数组合。AI Key 由 Settings/Credentials Owner 加密持有，只给已登记的 `lfaa-ai-video` 服务端消费者读取。

账户设置分类和应用/模式偏好由 Settings API 与 Storage Domain 校验，按账户保存在 `<LFAA_HOME>/users/<账户 SHA-256>/settings/settings.json`。写入使用同目录原子替换；应用启动时会把 v47 SQLite 中的旧设置/偏好逐账户迁移并读回校验。Provider 密文、数据库、凭据与会话留在 Home；游戏、环境、日志、备份以及 Writing/工作流/知识等业务文件位于设置中心统一选择的 `LFAA_DATA_DIR` 根。Minecraft/SteamCMD 默认目录与节点覆盖继续由 SQLite 关系配置 Owner 管理。

## AI 模型思考能力

`settings/src/service.ts` 是 Provider 模型目录、模型能力和 AI 账户 `reasoning_mode` 的权威 Owner。模型目录能力解析在 `settings/src/model-capabilities.ts`：只接受 Provider 返回的思考参数、明确支持值和默认值；过滤 `none`、`off`、`disabled`，不从品牌或模型 ID 推导能力。没有可验证档位时，账户使用 `default`，请求省略思考参数并遵循 Provider 默认行为。

保存模型目录时保留来源标记，账户查询、切换模型和 Agent Runtime 都从该目录解析同一组档位。账户参数写入前由 Settings Owner 校验；Agent Runtime 只发送当前模型目录明确支持的值。Provider 凭据仍由服务端加密保存，不随目录元数据返回客户端。

已保存账户的官方目录刷新与模型推理测试分开：刷新只读取并保存当前目录，保留原模型和思考设置；真实测试单独请求当前所选模型，可能产生 Provider 用量。

## 个性化设置

`personalization` 是账户级设置分类，由 `settings/src/service.ts` 提供默认值、读取归一化和持久化。`memoryEnabled` 与 `memoryFromToolChats` 均默认关闭；Agent Loop 只读取这两个权威设置决定记忆读取和生成资格。记忆正文由独立 `lfaa-conversation-memory` Owner 保存，不能并入此设置 JSON、工具审批授权或 Markdown 知识库。

## AI Work 空闲虚化设置

`appearance.advanced.aiWorkOutputFocusBlurEnabled`、`aiWorkOutputFocusBlurIdleSeconds` 与 `aiWorkOutputFocusBlurPercent` 随账户外观设置保存。空闲时长默认 60 秒（1 分钟），服务端限制为 60–3600 秒且必须是 60 的整数倍；强度使用 0–100% 百分比，由共享 Client 同时映射为 0–8px 模糊半径和回复不透明度，100% 完全淡出。读取旧账户时只补缺失或不符合新分钟粒度的空闲时长默认值，保留其他外观设置。

`appearance.wallpaperEngine.projectId` 是 Wallpaper Engine 插件项目标识，由 Settings Owner 按不透明字符串保存：允许空字符串，或最多 180 个 ASCII 字母、数字、下划线与连字符。API 外观 Schema 与该设置归一化规则保持一致；保存外观时不能要求此 ID 必须是 UUID 或固定长度十六进制字符串。

## 游戏运行环境存储

`project_storage_locations` 增加运行环境、下载缓存和临时位置，默认分别为当前数据根的 environments/cache/tmp。旧 API 缺失新字段时保留现值；历史环境位置继续发现，不自动搬迁。节点覆盖由同一 Settings Owner 保存，默认根据节点自己的数据根推导；同一控制端的本机节点未设覆盖时共用本机设置。控制端路径不能套用到其他节点。设置中心提供保存、节点覆盖和已保存位置的文件管理跳转。
