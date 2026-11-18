# Dev Log 000072 — 移除输入栏冗余「配置模型 / 规则」按钮并将模型与推理选择器右移至语音/发送按钮旁

- **编号**：000072
- **时间**：2026-11-18 11:50:12 +08:00
- **任务名**：`relocate-composer-model-picker`
- **状态**：已完成修改、单元测试、类型检查、构建与内置浏览器实测验收

---

## 1. 界面调整内容

1. **移除底栏冗余「配置模型 / 规则」按钮**：因模型选择器内部已有 `配置模型卡片...` 跳转入口且右侧上下文栏保留快速配置按钮，从 [ChatWorkspace.tsx](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.tsx) 底部 `.controls` 移除了多余的跳转按钮并清理无用 `IconSettings` 导入。
2. **右移模型与推理选择器至右侧操作区**：在 [ChatWorkspace.module.css](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.module.css) 新增 `.rightCluster`，将 `<ModelReasoningPicker />` 移至 `<ComposerRightActions />`（语音/发送按钮）正左侧，并将 [ModelReasoningPicker.tsx](file:///e:/lfaa/packages/core/chat/client/components/ModelReasoningPicker.tsx) 内 3 个 `PopoverCard` 锚点统一改为 `placement="top-end"` 右对齐向上展开。

---

## 2. 实际变更清单

- [ChatWorkspace.tsx](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.tsx)：移除 `配置模型 / 规则` 按钮并将 `<ModelReasoningPicker />` 移入 `.rightCluster`。
- [ChatWorkspace.module.css](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.module.css)：新增 `.rightCluster` 右侧紧凑组合样式。
- [ModelReasoningPicker.tsx](file:///e:/lfaa/packages/core/chat/client/components/ModelReasoningPicker.tsx)：浮窗定位统一为 `top-end`。

---

## 3. 验证记录

| 检查项 | 命令 / 方式 | 结果 |
| --- | --- | --- |
| 全部单元测试 | `pnpm exec tsx --test` 覆盖全部 11 个测试文件 | **42/42 通过**（`duration_ms 2639.9713`） |
| TypeScript 类型检查 | `pnpm run typecheck`（13 个工程） | **exit code 0** |
| Web 生产构建 | `pnpm run build`（`vite build`） | **exit code 0**（`✓ built in 514ms`） |
| 内置浏览器实测 | `browser` 子代理访问 `http://127.0.0.1:5173/`（`1440x900`） | **通过**（控制台 error = 0，网络失败 = 0） |

- 实测核验（`browser` 子代理 `3a378245-f8a6-419e-b7a1-f8f5868c51b0`）：确认 `配置模型 / 规则` 按钮数 `= 0`，`deepseek-flash 高` 选择器位于 `语音输入`/`发送` 正左侧且 `选择模型`/`选择推理强度` 弹窗严格右对齐向上展开无裁剪，最终截图见 [final_step_6.png](file:///C:/Users/Administrator/.gemini/antigravity/brain/6802e411-f569-44da-8e24-b1a6955c35fb/browser_evidence/3a378245-f8a6-419e-b7a1-f8f5868c51b0/final_step_6.png)。
- Web 服务 `pnpm lfaa web`（`task-1760`）持续运行在 `http://127.0.0.1:5173/`。
