# web

## 作用

Web 客户端：复用 React UI 与 Agent Client，通过 HTTP/SSE/WebSocket 接入 Runtime。

## 边界

- 必须遵守根目录 `ARCHITECTURE.md`。
- 不得绕过 Agent Protocol / Tool Runtime / Permission。
- 当前 v0.0.1 仅建立骨架，不提前实现业务。
