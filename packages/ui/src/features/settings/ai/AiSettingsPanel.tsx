/**
 * 文件：AiSettingsPanel.tsx
 * 作用：Settings Surface 内的 AI Provider 配置面板。
 * 负责：Provider 选择、认证方式与公开配置字段展示。
 * 不负责：Settings 外壳、网络请求、Secret 保存、Provider 业务判断。
 * 状态归属：仅拥有当前认证 Tab 草稿状态；业务真值由外部 ViewModel 注入。
 * 对外接口：AiSettingsPanel。
 * 关联文件：ai-settings.types.ts、ai-settings.css、../SettingsPage.tsx。
 */
import { useMemo, useState } from "react";
import type { AiSettingsPageProps } from "./ai-settings.types";
import "./ai-settings.css";

export type AiSettingsPanelProps = Omit<AiSettingsPageProps, "onClose">;

export function AiSettingsPanel({ providers, selectedProviderId, onSelectProvider }: AiSettingsPanelProps) {
  const selected = useMemo(() => providers.find((item) => item.id === selectedProviderId) ?? providers[0], [providers, selectedProviderId]);
  const [authByProvider, setAuthByProvider] = useState<Record<string, string>>({});
  if (!selected) return null;
  const activeAuth = authByProvider[selected.id] ?? selected.authMethods[0]?.id ?? "";
  const activeAuthView = selected.authMethods.find((item) => item.id === activeAuth);

  return (
    <div className="ai-settings-panel-root">
      <div className="ai-provider-grid" role="list" aria-label="AI Provider">
        {providers.map((provider) => (
          <button key={provider.id} type="button" role="listitem" className={`ai-provider-card${provider.id === selected.id ? " is-active" : ""}`} onClick={() => onSelectProvider(provider.id)}>
            <span className="ai-provider-mark">{provider.name.slice(0, 1).toUpperCase()}</span>
            <span><strong>{provider.name}</strong><small>{provider.description}</small></span>
          </button>
        ))}
      </div>

      <div className="ai-settings-detail">
        <div className="ai-settings-panel">
          <div className="ai-settings-panel__title"><div><small>当前 Provider</small><h2>{selected.name}</h2></div><span>{selected.authMethods.length} 种认证</span></div>
          <div className="ai-auth-tabs">
            {selected.authMethods.map((auth) => (
              <button key={auth.id} type="button" className={auth.id === activeAuth ? "is-active" : ""} onClick={() => setAuthByProvider((value) => ({ ...value, [selected.id]: auth.id }))}>{auth.label}</button>
            ))}
          </div>
          {activeAuthView?.description ? <p className="ai-auth-help">{activeAuthView.description}</p> : null}
          <div className="ai-config-fields">
            {selected.fields.length === 0 ? <p className="ai-empty-fields">当前认证方式无需额外公开配置字段。</p> : selected.fields.map((field) => (
              <label key={field.id} className="ai-config-field">
                <span>{field.label}{field.required ? <b>*</b> : null}</span>
                {field.kind === "select" ? (
                  <select defaultValue={field.defaultValue}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                ) : <input type="text" defaultValue={field.defaultValue} placeholder={field.placeholder} />}
                {field.help ? <small>{field.help}</small> : null}
              </label>
            ))}
          </div>
          <div className="ai-secret-slot"><span>凭证</span><strong>由宿主 Secret Adapter 提供</strong><small>本 UI 不接收或保存 Secret 明文。</small></div>
        </div>

        <aside className="ai-settings-side">
          <h3>插件边界</h3>
          <dl><div><dt>配置业务</dt><dd>config-system</dd></div><div><dt>图形界面</dt><dd>packages/ui</dd></div><div><dt>宿主桥</dt><dd>apps/web</dd></div></dl>
          <p>后续 Desktop / Linux 直接复用本设置中心；CLI 复用同一 Provider Registry，不复制业务。</p>
        </aside>
      </div>
    </div>
  );
}
