/**
 * 文件：AiSettingsPage.tsx
 * 作用：LFAA AI 服务配置的可复用图形界面基线。
 * 负责：Provider 选择、认证方式与厂商配置字段展示。
 * 不负责：网络请求、Secret 保存、Provider 业务判断、宿主桥。
 * 状态归属：仅拥有当前认证 Tab 和草稿 UI 状态；业务真值由外部 Controller 注入。
 * 对外接口：AiSettingsPage。
 * 关联文件：ai-settings.types.ts、ai-settings.css、@lfaa/app-shell。
 * 修改注意事项：禁止出现厂商 API URL / fetch；厂商差异必须来自 ViewModel。
 */
import { useMemo, useState } from "react";
import type { AiSettingsPageProps } from "./ai-settings.types";
import "./ai-settings.css";

export function AiSettingsPage({ providers, selectedProviderId, onSelectProvider, onClose }: AiSettingsPageProps) {
  const selected = useMemo(() => providers.find((item) => item.id === selectedProviderId) ?? providers[0], [providers, selectedProviderId]);
  const [authByProvider, setAuthByProvider] = useState<Record<string, string>>({});
  if (!selected) return null;
  const activeAuth = authByProvider[selected.id] ?? selected.authMethods[0]?.id ?? "";

  return (
    <section className="ai-settings-page" aria-label="AI 服务设置">
      <header className="ai-settings-header">
        <div><small>设置 / AI 服务</small><h1>模型与账户</h1><p>Provider 以插件方式接入；界面只消费配置描述，不包含厂商业务。</p></div>
        <button type="button" className="ai-settings-close" onClick={onClose}>返回工作台</button>
      </header>

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
          {selected.authMethods.find((item) => item.id === activeAuth)?.description ? <p className="ai-auth-help">{selected.authMethods.find((item) => item.id === activeAuth)?.description}</p> : null}
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
          <p>后续 Desktop / Linux 直接复用本页；CLI 复用同一 Provider Registry，不复制业务。</p>
        </aside>
      </div>
    </section>
  );
}
