# UPDATA-000346｜自定义提示音、内置多音色与按事件联动

- 时间：2026-11-22 02:56 +0800。负责人要求：提示音支持上传自定义声音，内置几款不同的提示音，并让提示音与「轮次完成、澄清/待回答、待确认/关键决策」等事件联动。
- 内置音色：新增 5 款 Web Audio 实时合成的不同提示音——默认、清脆、铃音、轻快、双响，另有静音；不依赖外部音频文件。
- 事件联动：通用设置新增 `completionSound`（轮次完成）、`questionSound`（澄清/待回答）、`approvalSound`（待确认/关键决策），旧版 `notificationSound` 作为缺省回退。轮次完成、会话进入待回答、待确认分别使用各自音色；当前会话的审批提示音也使用 `approvalSound`；设置页「测试通知」使用完成提示音。
- 自定义声音：设置页新增「自定义提示音」上传与管理（试听/删除），支持 WAV、MP3、OGG、M4A、WebM、FLAC，最大 2.5MB。Host 新增 `/api/notification-sounds` 列表/上传/读取/删除接口，文件保存在 `~/.lfaa/notification-sounds`，设置值使用 `custom:<uuid>`；删除后仍被引用的事件音自动回退 `default`。
- 设置页：三个事件分别有音色下拉 + 试听；自定义声音列表显示文件名/大小/MIME；上传、删除、错误提示均在页内完成。
- 实测（独立 5174 宿主 + 无头 Edge，真实 Agent 运行）：上传 WAV 并选为完成提示音后，后台会话完成时实际请求自定义音频 1 次、解码 1 次、播放 1 次，并弹出「轮次完成 · LFAA」通知；设置页截图显示「轮次完成提示音 = custom-tone.wav、澄清/待回答 = 铃音、待确认/关键决策 = 双响」及自定义上传列表。截图：`%TEMP%\lfaa-pw\notify\11-custom-sound-settings.png`、`10-custom-sound-completion.png`。
- 收尾：删除测试自定义音与测试会话，完成/问题/审批提示音恢复 default/bell/alert，模型恢复千问 Token Plan，关闭 5174 临时宿主。
- 测试：全仓 `pnpm test` **493 项通过**；`pnpm check` 0 错误 / 4 条既有警告（53 包 / 444 源文件）；`pnpm lint` 435 文件 0 问题；`pnpm typecheck`、`pnpm build` 通过（构建前因并发会话的 `lib/types` 陈旧触发过 TS6305，`tsc -b --force` 后恢复）。
- 说明：5173 的运行中宿主早于自定义提示音接口启动，需重启一次 `pnpm lfaa web`（或桌面端）后新接口才生效。
- 本轮文件：`docs/updata-log/000346-20261122-0256-custom-notification-sounds.md`、`docs/architecture/notifications.md`、`packages/core/settings/src/general-settings.ts`、`packages/core/settings/tests/settings.test.ts`、`packages/core/chat/client/general-settings-client.ts`、`packages/core/chat/client/notification-sounds.ts`、`packages/core/chat/client/notification-sound-api.ts`、`packages/core/chat/client/chat-session-notifier.ts`、`packages/core/chat/client/chat-run-actions.ts`、`packages/core/chat/client/components/NotificationSettingsGroup.tsx`、`packages/core/chat/tests/notifications.test.ts`、`packages/host/web-server/src/handlers-notifications.ts`、`packages/host/web-server/src/runtime.ts`、`packages/host/web-server/src/index.ts`、`packages/host/web-server/tests/notification-sounds.test.ts`、`docs/dev-log/000201-000400.md`。
- Git：保留工作区内此前未提交的改动；未提交或推送。