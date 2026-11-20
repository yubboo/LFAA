# 写接口要求 JSON，插件流式安装改为 POST

- 日期：2026-11-20 22:04 +08:00。
- 用户视角。插件中心的「添加插件」流程不变（输入来源 → 实时日志 → 成功/失败提示），但底层请求已从 `GET` 改成 `POST`；任何绕过界面直接调接口的脚本，若继续用 `GET /api/plugins/add/stream?spec=...` 会收到 `405`（提示「流式安装只接受 POST」），需改为 `POST` + JSON 请求体 `{"spec": "..."}`。
- 写接口统一要求 `Content-Type: application/json`：非只读方法只要携带请求体，就必须声明 JSON，否则返回 `415`；无请求体的动作型接口（启停、中止、刷新等）不受影响。页面内所有既有请求已使用 JSON，无需用户操作。
- 安全收益：安装这类非幂等操作不再能被图片/链接等 GET 请求触发；所有写入口统一走 JSON 解析路径，表单/纯文本编码无法绕过。
- 验证。`check`／`lint`／`typecheck`／`build`／`test`（264 项全部通过）／`probe:loader` 全绿；真实浏览器实测插件安装失败路径、GET 405、文本写 415、JSON 写 200 均符合预期。文档已更新：`docs/architecture/local-api-auth.md`。
