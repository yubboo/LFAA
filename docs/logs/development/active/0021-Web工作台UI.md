# #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.3
- **状态：** active
- **关键词：** Web、Vite、React、三栏、Codex、ChatGPT、Resize、自动吸附、最小宽度
- **当前文件：** `docs/logs/development/active/0021-Web工作台UI.md`

## 当前结论

工作台继续采用 Codex / ChatGPT 类黑白灰生产力工具风格。

侧栏吸附语义改为：

```text
正常拖动
→ 到达该侧栏 min
→ 立即自动吸附到 0 / collapsed 预览
→ 不等待松手
```

不再使用独立的 `96px` 收起阈值。

反向拖回时使用小迟滞：

```text
min + 24px
```

才重新展开，避免指针在最小宽度附近抖动造成反复开合。

## 最新变更

### #21.3 最小宽度自动吸附

修复 #21.2 的吸附行为：

1. 删除 `snapThreshold=96` 语义；
2. 左栏到达 `leftLimits.min` 时立即吸附收起；
3. 右栏到达 `rightLimits.min` 时立即吸附收起；
4. 吸附发生在 Pointer Move，不再等待 Pointer Up；
5. Pointer Move 仍通过 `requestAnimationFrame` 合并；
6. 自动吸附使用约 150ms 短动画；
7. 反向展开增加 24px hysteresis，避免 min 附近反复闪动；
8. Pointer Up 只提交最终状态，不再负责判断是否应该收起；
9. 最大宽度和中央最小宽度保护保持不变。

## 影响范围

- `packages/ui/src/workbench/ResizableWorkbench.tsx`
- `packages/ui/src/workbench/workbench-layout.types.ts`
- `packages/ui/src/workbench/workbench.css`
- `packages/app-shell/src/AgentWorkbench.tsx`
- `docs/standards/UI_LAYOUT.md`
- `docs/testing/WEB_UI_TEST.md`
- `docs/prompts/active/0021-Web工作台UI.md`

## 验证结果

- Governance / Import / Development Log / Docs Structure Check：PASS；
- 变更 TS/TSX 语法转译检查：PASS；
- 源码确认：旧逻辑确实在 `finishDrag` / Pointer Up 才判断 `< 96px`；
- 新逻辑已改为 Pointer Move 到 min 即自动吸附；
- Windows 实机拖拽手感仍由用户机器做最终体验验证。

## 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 | superseded | `archive/0021-00-Web工作台初始实现.md` |
| #21.1 | superseded | `archive/0021-01-Web启动入口调整.md` |
| #21.2 | superseded | `archive/0021-02-黑白工作台重构.md` |
| #21.3 | active | `active/0021-Web工作台UI.md` |
