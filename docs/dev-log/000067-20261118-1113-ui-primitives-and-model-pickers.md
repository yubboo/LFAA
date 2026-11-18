# Dev Log 000067 — 创建共享交互原语包 `@lfaa/ui-primitives`，实现模型/推理强度浮窗及卡片式模型配置居中弹窗

- **编号**：000067
- **时间**：2026-11-18 11:13:12 +08:00
- **任务名**：`ui-primitives-and-model-pickers`
- **状态**：已完成实现、单元测试、类型检查、构建与内置浏览器实测验收

---

## 1. 架构与交付目标

1. **新建共享交互 UI 原语包 `packages/ui/primitives`（`@lfaa/ui-primitives`）**：
   - 按 `AGENTS.md` §2 约定抽离真正跨业务包复用的交互原语与动效层，后续任何弹窗/浮层只需集中调整 `ModalDialog` 或 `PopoverCard` 即可全局生效并复用：
     - `ModalDialog`（居中弹窗：Portal 挂载、遮罩点击/`Escape` 关闭、尺寸预设 `sm/md/lg`、统一进场动画预设 `scale/fade/slide-up`、图标头与底部操作栏）；
     - `PopoverCard`（锚点浮窗卡片：`top-start` / `top-end` / `bottom-start` / `bottom-end` 自动定位与外部点击/`Escape` 退出）；
     - `StepSliderPopover`（离散档位圆点滑块浮窗：带渐变进度填充、可点击圆点、键盘左右调节、重设按钮与目标切换入口）。
2. **聊天输入栏模型与推理强度选择器（`ModelReasoningPicker`）**：
   - 替换原底部原生 `<select>` 为复合胶囊控件，支持悬浮/快捷键 `Ctrl+Shift+M` 提示，分别弹出 **选择模型** 列表浮窗与 **选择推理强度** 滑块浮窗（对接 `generalSettings.reasoningLevels` 与持久化状态），并支持两者间一键互跳。
3. **「模型管理」多提供商卡片网格与居中弹窗配置（`ModelProviderGrid` + `ModelProviderModal`）**：
   - 在 `@lfaa/llm` 新增可选 `providerId` 字段精确追踪各提供商配置。
   - 覆盖 OpenAI、DeepSeek、MiniMax、通义千问、火山方舟、智谱、硅基流动、OpenRouter、Gemini兼容、Claude、xAI Grok、本地部署（Ollama/LM Studio）及自定义共 13 张提供商卡片，点击任意卡片通过 `@lfaa/ui-primitives` 的 `ModalDialog` 居中弹窗完成协议选择、Base URL/模型快选、API Key 保存、连接测试、启用或删除。

---

## 2. 实际变更清单

- **新增共享交互包 `packages/ui/primitives`**：
  - [package.json](file:///e:/lfaa/packages/ui/primitives/package.json)、[tsconfig.json](file:///e:/lfaa/packages/ui/primitives/tsconfig.json)、[src/index.ts](file:///e:/lfaa/packages/ui/primitives/src/index.ts)（17 行）
  - [ModalDialog.tsx](file:///e:/lfaa/packages/ui/primitives/client/ModalDialog.tsx)（97 行）与 [ModalDialog.module.css](file:///e:/lfaa/packages/ui/primitives/client/ModalDialog.module.css)（142 行）
  - [PopoverCard.tsx](file:///e:/lfaa/packages/ui/primitives/client/PopoverCard.tsx)（62 行）与 [PopoverCard.module.css](file:///e:/lfaa/packages/ui/primitives/client/PopoverCard.module.css)（42 行）
  - [StepSliderPopover.tsx](file:///e:/lfaa/packages/ui/primitives/client/StepSliderPopover.tsx)（99 行）与 [StepSliderPopover.module.css](file:///e:/lfaa/packages/ui/primitives/client/StepSliderPopover.module.css)（117 行）
  - [client/index.tsx](file:///e:/lfaa/packages/ui/primitives/client/index.tsx)（13 行）、[css-modules.d.ts](file:///e:/lfaa/packages/ui/primitives/client/css-modules.d.ts) 与 [primitives-contract.test.ts](file:///e:/lfaa/packages/ui/primitives/tests/primitives-contract.test.ts)
- **工作区依赖与类型检查挂载**：
  - [package.json](file:///e:/lfaa/package.json)：`typecheck` 脚本纳入 `packages/ui/primitives/tsconfig.json`；[packages/core/chat/package.json](file:///e:/lfaa/packages/core/chat/package.json) 依赖 `@lfaa/ui-primitives`。
- **LLM 服务与聊天界面装配**：
  - [@lfaa/llm types.ts](file:///e:/lfaa/packages/core/llm/src/types.ts)、[index.ts](file:///e:/lfaa/packages/core/llm/src/index.ts)、[http-handler.ts](file:///e:/lfaa/packages/core/llm/src/http-handler.ts)：支持 `providerId` 读写透传。
  - [chat-types.ts](file:///e:/lfaa/packages/core/chat/client/chat-types.ts) 与 [chat-store.ts](file:///e:/lfaa/packages/core/chat/client/chat-store.ts)：增加 `reasoningLevel` 状态持久化与 `providerId` / `activate` 参数支持。
  - [provider-catalog.ts](file:///e:/lfaa/packages/core/chat/client/provider-catalog.ts)（211 行，新增）、[ModelProviderGrid.tsx](file:///e:/lfaa/packages/core/chat/client/components/ModelProviderGrid.tsx)（68 行，新增）、[ModelProviderGrid.module.css](file:///e:/lfaa/packages/core/chat/client/components/ModelProviderGrid.module.css)（199 行，新增）、[ModelProviderModal.tsx](file:///e:/lfaa/packages/core/chat/client/components/ModelProviderModal.tsx)（214 行，新增）。
  - [ModelReasoningPicker.tsx](file:///e:/lfaa/packages/core/chat/client/components/ModelReasoningPicker.tsx)（168 行，新增）与 [ModelReasoningPicker.module.css](file:///e:/lfaa/packages/core/chat/client/components/ModelReasoningPicker.module.css)（163 行，新增）。
  - [AgentSettingsView.tsx](file:///e:/lfaa/packages/core/chat/client/components/AgentSettingsView.tsx)（179 行）、[AgentSettingsView.module.css](file:///e:/lfaa/packages/core/chat/client/components/AgentSettingsView.module.css) 与 [ChatWorkspace.tsx](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.tsx)：接入模型卡片网格+居中弹窗与底部模型/推理选择器。
  - [chat-lifecycle.test.ts](file:///e:/lfaa/packages/core/chat/tests/chat-lifecycle.test.ts)：补充 `MODEL_PROVIDER_CATALOG` 与 `findProfileForProvider` 匹配测试。

---

## 3. 验证记录

| 检查项 | 命令 / 方式 | 结果 |
| --- | --- | --- |
| 全部单元测试 | `pnpm exec tsx --test` 覆盖全部 11 个测试文件 | **41/41 通过**（`duration_ms 6427.055`） |
| TypeScript 类型检查 | `pnpm run typecheck`（13 个工程） | **exit code 0** |
| Web 生产构建 | `pnpm run build`（`vite build`） | **exit code 0**（`✓ built in 1.56s`） |
| 内置浏览器实测 | `browser` 子代理访问 `http://127.0.0.1:5173/`（`1440x900`） | **通过**（控制台 error = 0，网络失败 = 0/50） |

- 实测核验（`browser` 子代理 `69076258-f10c-4fd2-864a-82dedfc8b611`）：
  1. 首页底部输入栏已无原生 `<select>`，实测点击 `选择模型`、`推理强度：高`、滑块档位点（`最低` / `极高` / 重设恢复）、模型互跳与 `配置模型卡片...` 全部丝滑联动。
  2. 设置模型页渲染 4 列共 13 张提供商卡片（`DeepSeek` 带当前使用勾选），实测点击 `通义千问` / `DeepSeek` 弹出居中的 `ModalDialog`，支持 `Escape` 关闭与协议胶囊切换，最终验收截图见 [final_step_24.png](file:///C:/Users/Administrator/.gemini/antigravity/brain/6802e411-f569-44da-8e24-b1a6955c35fb/browser_evidence/69076258-f10c-4fd2-864a-82dedfc8b611/final_step_24.png)。
- Web 服务 `pnpm lfaa web`（`task-1506`）已保持后台持续运行，访问 `http://127.0.0.1:5173/` 即可查看。
