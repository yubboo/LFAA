# LFAA SDK Client

`LfaaClient` 通过既有认证 `/api/ai/*` API 提交/跟随任务、续问、回答澄清、停止、读取审批、决定审批、归档及分页读会话。浏览器发送当前登录 Cookie；Node 调用方显式提供当前登录认证头，SDK 不登录、不获取或保存用户密钥。

```ts
import { LfaaClient } from "lfaa-sdk-client";
const client = new LfaaClient({ apiUrl: "http://127.0.0.1:3000/api/" });
const { run } = await client.submit({ appId: "workspace", sessionId: null, content: "查询当前可用节点" });
for await (const event of client.events(run.id)) console.log(event.event);
```

写请求不自动重试；断开事件订阅只取消读取，停止运行必须显式调用 cancel。JSON 响应最多 8 MiB，事件帧最多 1 MiB，reader 在退出时取消/释放；无 SSE done 时报告中断。服务端继续负责权限、参数和账户隔离，不提供自动批准。

构建输出为根 `dist/packages/sdk/sdk-client/`。真实认证 Web API 已经隔离回归；不是 DSH stdio SessionProvider 的二进制兼容客户端。
