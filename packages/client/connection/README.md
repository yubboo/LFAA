# LFAA Client Connection

此包提供已认证控制端 API 和 AI Work SSE 消费协议，不持有模型、Session 或权限业务规则。

插件清单、搜索和来源检查读取可接收 `AbortSignal`；切换页面或放弃检查时可取消未完成读取。插件启用、停用、卸载与安装不经本包调用写路由，管理页面把用户明确目标交给现有 AI Work/Permission 链。

`file-manager-location.ts` 将设置中心已保存的本机目录映射到 data 或本机卷来源，通过账户限定的路由历史把浏览目标交给文件页；不把路径当成权限、不在 URL 放入绝对路径，也不读取磁盘。文件页消费目标后移除临时历史字段，后续目录恢复继续使用原有账户缓存。

AI 漫剧项目列表会在交给工作区前校验服务端返回的项目列表与全部资源限制；缺少或包含无效限制值时以 `ai_video_contract_mismatch` 报错，避免旧版控制端响应进入新版 UI。

AI 回复使用一份 `content` 和可选 `parts` 正文范围；`delta` 携带分段 ID/起点，`presentation` 同步阶段及最终答案范围。帧合并仅合并同一消息的同一分段，非正文事件先冲刷待处理文本。`appendAiTextDelta` 更新同一消息投影；活动的 `contentOffset`、问题和实际审批答案只用于展示。重新订阅的原子快照恢复当前正文与范围，旧服务没有范围时保持兼容。

订阅继续沿用原取消信号、帧回调撤销和非正文事件顺序；不另建连接、计时器或存储，不传输 Provider 隐藏推理。协议回归见 `apps/cli/tests/ai-work-response-timeline.test.mjs` 与 `ai-work-sse-lifecycle.test.mjs`。

`loadAiMessages()` 接收可选 AbortSignal，并将它传给已认证请求，使聊天切换后可取消过期的首屏读取。

`loadAiSessions()` 支持显式 App 筛选并接收可选 AbortSignal；小鱼共享工作区按当前账户读取跨 App 会话列表，在离开工作模式或切换账户时取消过期请求。

`loadAiExtensions()` 支持可选 AbortSignal；共享工作区退出或账户切换时取消自身目录请求，其他调用方的默认并发读取仍使用原请求合并合同。普通应用面板不为展示 Agent 资源而读取此目录。

Minecraft 默认核心设置通过 `loadMinecraftCoreNames()` 读取认证后的本地核心名称合同；实时版本和构建仍使用 `loadMinecraftCores()`，避免展示偏好等待外部来源。

2026-10-14：Files locations 与真实 entries 分开；总根设置增加 Owner 返回的默认/推荐/选择类型与显式推荐动作。移除独立项目/节点环境根的写入调用，保留统一派生位置读取。服务器未返回推荐合同不得猜测路径。

## 小鱼共享工作入口（2026-10-14）

提供可选关联、真实 Skill 摘要和原 Session/API 类型；新请求仅传引用，关联不启用能力或改权限。

构建只写仓库根 dist/packages/client/connection/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

Profile 插件新增 installManagedPlugin/removeManagedPlugin，调用受认证的显式安装与卸载 API，传入已检查或当前记录的固定版本，返回 Owner 实际结果；不创建 AI 会话或在客户端执行安装规则。
