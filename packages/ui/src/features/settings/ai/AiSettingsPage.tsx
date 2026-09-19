/**
 * 文件：AiSettingsPage.tsx
 * 作用：保留旧公开名称的兼容包装；真实 Settings 内容已迁移至 AiSettingsPanel。
 * 负责：向旧调用方提供薄包装。
 * 不负责：独立 Settings 布局；新代码应优先使用 SettingsPage + AiSettingsPanel。
 * 状态归属：无业务状态；内部状态由 AiSettingsPanel 管理。
 * 对外接口：AiSettingsPage。
 * 关联文件：AiSettingsPanel.tsx、../SettingsPage.tsx。
 * 修改注意事项：只做兼容，不在这里继续新增设置业务或厂商逻辑。
 */
import { AiSettingsPanel } from "./AiSettingsPanel";
import type { AiSettingsPageProps } from "./ai-settings.types";

export function AiSettingsPage({ onClose, ...props }: AiSettingsPageProps) {
  return <div className="ai-settings-legacy"><button type="button" onClick={onClose}>返回</button><AiSettingsPanel {...props} /></div>;
}
