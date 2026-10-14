# LFAA Client Connection

此包提供已认证控制端 API 和 AI Work SSE 消费协议，不持有模型、Session 或权限业务规则。

`file-manager-location.ts` 将设置中心已保存的本机目录映射到 data 或本机卷来源，通过账户限定的路由历史把浏览目标交给文件页；不把路径当成权限、不在 URL 放入绝对路径，也不读取磁盘。文件页消费目标后移除临时历史字段，后续目录恢复继续使用原有账户缓存。

AI 漫剧项目列表会在交给工作区前校验服务端返回的项目列表与全部资源限制；缺少或包含无效限制值时以 `ai_video_contract_mismatch` 报错，避免旧版控制端响应进入新版 UI。

AI 回复使用一份 `content` 和可选 `parts` 正文范围；`delta` 携带分段 ID/起点，`presentation` 同步阶段及最终答案范围。帧合并仅合并同一消息的同一分段，非正文事件先冲刷待处理文本。`appendAiTextDelta` 更新同一消息投影；活动的 `contentOffset`、问题和实际审批答案只用于展示。重新订阅的原子快照恢复当前正文与范围，旧服务没有范围时保持兼容。

订阅继续沿用原取消信号、帧回调撤销和非正文事件顺序；不另建连接、计时器或存储，不传输 Provider 隐藏推理。协议回归见 `apps/cli/tests/ai-work-response-timeline.test.mjs` 与 `ai-work-sse-lifecycle.test.mjs`。
