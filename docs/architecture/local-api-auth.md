# 本机接口鉴权

状态：已实施（2026-11-20）。适用于 Web 形态下 `apps/web` 页面与 Host 之间的全部 `/api/*` 请求。

## 背景

Host 接口挂在 Vite 开发服务器的 middleware 上，只监听 `127.0.0.1`。监听回环不等于安全：
浏览器里的任意网页、其他标签页、扩展都能向 `http://127.0.0.1:<port>` 发请求，而其中
`GET /api/plugins/add/stream` 会安装插件（`pnpm add` + 动态装载），`POST /api/llm/profiles`
能改写档案地址并保留旧 API Key。没有鉴权时，这两条都不需要知道任何秘密即可触发。

## 机制

1. `startWeb` 每次启动生成一次性随机令牌（32 字节，hex），只存在于 Host 进程内存。
2. Vite 插件 `lfaa-api-token` 在 `transformIndexHtml` 阶段把令牌写入页面
   `<meta name="lfaa-api-token">`；页面由本机 Host 直接提供，跨源脚本读不到响应正文。
3. 浏览器启动时 `installApiToken()` 包装全局 `fetch` 与 `EventSource`：
   - `fetch`：同源 `/api/*` 请求附加 `x-lfaa-token` 请求头；
   - `EventSource`：追加 `?token=`，因为该 API 无法设置请求头。
4. `lfaa-host-apis` middleware 先调用 `checkApiAuth` 再派发到 `api/gateway`，未通过不进入任何业务处理器。

## 判定规则（fail-closed）

| 条件 | 结果 |
|---|---|
| 路径不是 `/api` 或 `/api/*` | 放行（静态资源、HMR 无副作用） |
| 方法为 `OPTIONS` | 放行（预检不产生副作用） |
| `Origin` 存在且与本机 `Host` 不同源 | `403` |
| `Sec-Fetch-Site: cross-site` | `403` |
| 令牌缺失或不匹配（常量时间比较） | `401` |
| `GET` 且 `?token=` 正确 | 放行（EventSource 专用） |
| 其他方法只认同名请求头 | `401` |

令牌同时存在于请求头与查询串时以请求头为准；查询串方式仅对 `GET` 生效。

## 安装来源加固（同一轮）

安装来源来自浏览器输入，最终作为 `pnpm add` 的参数执行：

- `parseInstallSpec` 拒绝含 `"'`$%&|<>;` 与换行的输入，转成明确的用户错误；
- `pnpm-spawn` 对全部参数做无法引用字符的校验（`"`、`%`、换行、NUL）；
- Windows 下每个参数都加双引号、末尾反斜杠加倍，`&`、`|`、`>` 不再被 `cmd.exe` 解释；
- 由 pnpm 启动时优先改用 `node <pnpm 入口> ...`，完全不经过 shell。

## 边界与不做的事

- **不防同机同权限进程**：同用户进程可以直接读取页面 HTML 拿到令牌，也能直接改 `~/.lfaa`。本机制防的是网页与跨站请求，不是本机进程隔离。
- **不是沙箱**：OS 级隔离见 [sandbox](sandbox.md)，当前仍未实现。
- 开发服务器重建后令牌会变，已打开的页面需要刷新；页面未注入令牌时控制台会给出明确警告。

## 后续

- `GET /api/plugins/add/stream` 仍有副作用，计划改为 `POST` + 一次性确认。
- 写接口尚未强制 `application/json` Content-Type（令牌已挡住跨站，此项属纵深防御）。
- 修改已有档案的 `baseUrl` 时仍会沿用旧 Key，应改为要求重新输入或显式确认。