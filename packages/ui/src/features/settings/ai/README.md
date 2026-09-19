# AI 设置 UI

`packages/ui/src/features/settings/ai` 是 AI 配置图形界面的唯一主目录，供 Web / Desktop / Linux 图形端复用。

当前包括：

- `AiSettingsPanel.tsx`：Provider/认证选择、Secret 瞬时输入、连接测试、模型选择、账户保存/重测/删除；
- `AiSettingsPage.tsx`：旧公开名称兼容包装；
- `ai-settings.types.ts`：纯 ViewModel/Props；
- `ai-settings.css`：Feature 自有视觉。

硬边界：

- 不依赖 `@lfaa/config-system`；
- 不出现厂商 Base URL；
- 不 `fetch` Provider；
- 不持久化 API Key / Token；
- 所有厂商差异由 App Shell / Controller 注入 ViewModel。

Secret 只存在于未保存的 React 表单状态；保存后立即清空。UI 不读取 Credential Manager，也不保存浏览器 Storage。
