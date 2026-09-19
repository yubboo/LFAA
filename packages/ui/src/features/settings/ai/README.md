# AI 设置 UI

`packages/ui/src/features/settings/ai` 是 AI 配置图形界面的唯一主目录，供 Web / Desktop / Linux 图形端复用。

当前包括：

- `AiSettingsPage.tsx`：Provider 选择、认证方式与公开配置字段；
- `ai-settings.types.ts`：纯 ViewModel/Props；
- `ai-settings.css`：Feature 自有视觉。

硬边界：

- 不依赖 `@lfaa/config-system`；
- 不出现厂商 Base URL；
- 不 `fetch` Provider；
- 不持久化 API Key / Token；
- 所有厂商差异由 App Shell / Controller 注入 ViewModel。
