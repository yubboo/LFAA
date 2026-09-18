# #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.2
- **状态：** active
- **关键词：** Web、Vite、React、三栏、Codex、ChatGPT、黑白主题、Resize、Snap
- **当前文件：** `docs/logs/development/active/0021-Web工作台UI.md`

## 当前结论

Web 工作台视觉改为接近 Codex / ChatGPT 的简洁生产力工具风格，不再使用水墨、宣纸、松绿、朱砂等主题元素。

当前结构保持：

```text
左侧导航 / 会话
│
中间工作区 / 对话
│
右侧工具 / .lfaa 资源
```

主题只使用中性色为主：

```text
浅色：白 / 浅灰 / 深灰文字
深色：黑灰 / 深灰 / 浅色文字
```

状态提示允许少量语义色，例如连接成功、刷新、错误。

左右栏必须：

- 支持自由拉伸；
- 有明确最大宽度；
- 桌面模式始终为中央区域保留最小可用宽度；
- 拖动时不立即跳变收起；
- 松开指针后进入吸附区才平滑收起；
- 展开 / 收起使用短动画；
- 继续记住本地宽度和收起状态。

## 最新变更

### #21.2 黑白工作台重构

完成：

1. 移除水墨视觉与宣纸背景；
2. `InkWorkbench` 更名为 `AgentWorkbench`；
3. 采用 Codex / ChatGPT 类黑白灰工作台层级；
4. 新增浅色 / 深色主题切换并保存本地偏好；
5. 左栏默认 288px，最大 640px；
6. 右栏默认 360px，最大 760px；
7. 桌面拖拽时动态限制最大宽度，保护中央工作区；
8. 吸附改为“拖动预览 + 松开吸附”，避免跨阈值瞬间跳变；
9. 分隔条 Pointer Move 继续通过 `requestAnimationFrame` 合并；
10. Vite `.lfaa` 热插拔桥接保持不变。

## 影响范围

- `packages/ui/src/workbench/*`
- `packages/app-shell/src/*`
- `apps/web/src/App.tsx`
- `docs/standards/UI_LAYOUT.md`
- `docs/testing/WEB_UI_TEST.md`
- `docs/prompts/active/0021-Web工作台UI.md`

## 验证结果

- Governance / Import / Development Log / Docs Structure Check：PASS；
- 变更 TS/TSX 语法转译检查：PASS；
- Web TypeScript / Vite build：当前执行环境无法取得 pnpm 11.17.0，未伪造通过；
- Windows 实机 Resize / Snap / Light / Dark：待用户本机验证；
- `.lfaa` 热插拔桥接：不改协议，仅保留现有行为。

## 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 | superseded | `archive/0021-00-Web工作台初始实现.md` |
| #21.1 | superseded | `archive/0021-01-Web启动入口调整.md` |
| #21.2 | active | `active/0021-Web工作台UI.md` |
