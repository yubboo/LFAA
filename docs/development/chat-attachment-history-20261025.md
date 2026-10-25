# LFAA-CHAT-ATTACHMENT-HISTORY-20261025

用户要求修复发送后图片偶尔从消息气泡消失。唯一 Owner 为 Session JSONL 展示投影，入口 `/work` 经 Session API 读取近期缓存与历史分页；附件字节仍归 Attachment Owner，认证和账户隔离保持。无新增设置，使用原有外观令牌及存储位置，不写真实用户偏好。允许修改展示字段投影、直接回归和包 README；不修改模型、权限或图片存储，不重写真实历史。

单批验收：即时返回、普通列表、近期缓存、缓存内较早页与进程重启均保留附件 ID/名称；定向回归、Host 类型/构建和 workspace Gate。UI 渲染代码不变，实页验收可用时使用隔离服务检查，未测范围据实记录。

根因：repository.ts 的 displayMessageFields 漏了 attachments_json，近期缓存和缓存内分页丢弃附件引用；Session 同步展示列表也有独立白名单漏项。原始 JSONL 消息记录已保存附件引用，无需迁移图片或改写用户数据。

## 实施及证据

- `E:/lfaa1/lfaa/packages/session/session-persistence-jsonl/src/repository.ts`：展示字段保留附件引用，覆盖近期投影与缓存内旧页；`E:/lfaa1/lfaa/packages/core/session/src/sessions.ts`：同步展示读取保留相同字段。
- `E:/lfaa1/lfaa/apps/cli/tests/session-kernel-persistence.test.mjs`：新增隔离 60 轮附件引用回归，验证即时返回、首屏缓存、进程重启、较早页、同步列表与跨账户拒绝；测试夹具仅有 ID/名称，无真实图片/用户数据，finally 清理隔离目录。
- `E:/lfaa1/lfaa/packages/session/session-persistence-jsonl/README.md`、`E:/lfaa1/lfaa/packages/core/session/README.md`：说明展示引用与字节 Owner 边界；`E:/lfaa1/lfaa/docs/PROMPTS.md` 更新索引；`E:/lfaa1/lfaa/docs/development/chat-attachment-history-20261025.md` 为本合同。
- 实际验证：新增定向用例 1/1；`node --test apps/cli/tests/session-kernel-persistence.test.mjs apps/cli/tests/session-cache.test.mjs` 15/15；`pnpm.cmd exec tsc --noEmit -p tsconfig.host.json` 通过；`pnpm.cmd run build:control-plane` 通过，产物根 dist/apps/control-plane；`pnpm.cmd run check:workspace` 215 包通过；目标文件 diff --check 通过。无独立 workspace-preflight/quality/release 命令。
- 性能：沿用既有 128 页/16 MiB 和正文缓存预算，仅增加小型附件引用字段，没有图片字节、订阅、请求或计时器。现有 4000 消息回归实测 20 页全链重扫 0 次，P50 1.950ms、P95 2.893ms；不等同于浏览器帧时间。
- 设置：无新增或修改；保留原存储目录与 UI 外观映射，权限、认证及账户隔离不变。
- 阻碍：`pnpm.cmd run build:web` 失败于既有/并行工作 `packages/client/ui-layout/src/Workbench.tsx` 第 58/86 行找不到 CanvasWorkspace.js，以及第 902 行 user 参数类型错误；未修改这些无关内容。正式指纹检查返回 web stale，无法启动符合最新源码要求的完整 Web；本轮未做浏览器图片显示/设备验收、真实 Provider 图像请求或原用户会话数据核对，也未重启真实 3000 服务。
- 恢复边界：原 JSONL 若已保存附件引用，重载后可由修复投影保留；从未保存引用或已删除的附件不由本补丁猜测恢复。
- 最终状态复核：工作区持续存在其他源码变动，最后 `runtime-build-state web` 返回 `["host","web"]`；前述 Host 构建是本轮实际成功结果，但当前整体运行树已再次过期，不能声称运行服务加载了修复。
