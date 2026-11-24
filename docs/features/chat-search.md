# 会话全文搜索

状态：**已实施**（2026-11-22）。记录侧栏搜索从「只搜功能与项目」扩展到「会话标题 + 消息正文 + 功能/项目」，以及命中消息的定位与高亮。

## 目标

- 输入关键词即可在本地所有会话（含归档）中搜索标题与消息正文，中英文大小写不敏感。
- 结果区分「会话标题」与「消息内容」，展示带上下文的片段并高亮命中词。
- 点击消息结果打开对应会话、滚动到该消息并短暂描边，避免在大段对话里手动查找。
- 无外部索引、无云端请求；搜索只在本机 Host 内读取会话文件。

## Host

- `searchSessionRecords(records, query, { limit, perSession })`：纯函数，按会话更新时间倒序扫描标题与消息正文，生成 `{ sessionId, sessionTitle, archived, projectId, messageId?, role?, snippet, match }`；默认总上限 20 条、每会话消息命中 3 条，超出标记 `truncated`。片段截取命中位置前后文并补齐省略号，消息正文先压成单行。
- `ChatService.searchSessions(query)`：查询时读取未归档与归档会话记录（`listSessions({ includeArchived: true })` + `getSession`），交给纯函数；查询为空直接返回空结果。
- `GET /api/chat/search?q=...` 返回 `{ results, truncated }`，走本机接口令牌鉴权。
- 当前为按需扫描，不维护全文索引；会话规模继续增长时可在此接口背后替换为本地索引，客户端契约不变。

## Client

- `WorkbenchChatProvider` 新增：
  - `searchChat(query)`：由聊天插件调用 Host 搜索接口。
  - `openSessionMessage(sessionId, messageId?)`：打开会话后请求定位消息。
- 搜索弹层 `SearchDialog`：输入停顿 200ms 后请求会话搜索，与本地导航目标合并成统一键盘列表；分组显示「会话与消息」「功能与项目」，标题/消息/归档状态与片段命中词高亮；`Enter`/方向键可用。
- `ChatClientStore.pendingMessageJump` 保存 `{ sessionId, messageId, nonce }`；`ChatSessionActions` 提供请求/消费方法。
- `ChatWorkspace` 在会话加载后暂停触底跟随（`pauseFollowing`），等待布局稳定后滚动到 `id="chat-message-<messageId>"` 的消息并写入 `data-search-hit`，3.2s 后移除；`ChatWorkspace.module.css` 提供描边与淡入高亮。
- 消息命中结果除消息 id 外附带角色与上下文片段；标题命中只打开会话，不定位消息。

## 实测与限制

- 真实 5174 宿主 + 无头 Edge：搜索「海洋」得到 3 条（标题、消息、归档消息），点击消息结果打开对应会话并把命中用户消息滚动到视口内（rect.top≈175）且显示描边高亮；控制台无报错。截图：`%TEMP%\lfaa-pw\search\01-search-results.png`、`03-jump-visible.png`。
- 单测覆盖标题/正文命中、大小写、片段省略号、每会话上限与截断、空查询与排序。
- 限制：全量文件按需扫描，首次搜索耗时随会话数量线性增长；归档会话会出现在结果中并有「已归档」标记；暂不支持按项目/时间过滤或高亮所有出现位置。