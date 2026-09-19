/**
 * 文件：AiSettingsPanel.tsx
 * 作用：Settings Surface 内的 AI Provider 真实配置面板。
 * 负责：Provider/认证选择、Secret 瞬时输入、连接测试、模型选择、账户保存/删除交互。
 * 不负责：厂商 HTTP、Secret 持久化、credentialRef、Provider 业务判断。
 * 状态归属：只拥有未保存表单与本次探测结果；账户真值由外部 Props 注入。
 * 对外接口：AiSettingsPanel。
 * 关联文件：ai-settings.types.ts、ai-settings.css、../SettingsPage.tsx。
 * 修改注意事项：Secret 不得进入 localStorage/sessionStorage/URL/日志；保存成功后立即清空输入框。
 */
import { useEffect, useMemo, useState } from "react";
import type { AiSettingsDraftInput, AiSettingsPageProps, AiSettingsProbeView } from "./ai-settings.types";
import "./ai-settings.css";

export type AiSettingsPanelProps = Omit<AiSettingsPageProps, "onClose">;

function initialSettings(fields: AiSettingsPanelProps["providers"][number]["fields"]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.id, field.defaultValue ?? ""]));
}

export function AiSettingsPanel(props: AiSettingsPanelProps) {
  const selected = useMemo(() => props.providers.find((item) => item.id === props.selectedProviderId) ?? props.providers[0], [props.providers, props.selectedProviderId]);
  const [authByProvider, setAuthByProvider] = useState<Record<string, string>>({});
  const [settingsByProvider, setSettingsByProvider] = useState<Record<string, Record<string, string>>>({});
  const [displayName, setDisplayName] = useState("");
  const [secret, setSecret] = useState("");
  const [probe, setProbe] = useState<AiSettingsProbeView | null>(null);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [accountModels, setAccountModels] = useState<Record<string, readonly AiSettingsProbeView["models"][number][]>>({});
  const [busy, setBusy] = useState<"probe" | "save" | "account" | null>(null);
  const [error, setError] = useState("");

  const activeAuth = selected ? authByProvider[selected.id] ?? selected.authMethods[0]?.id ?? "" : "";
  const activeAuthView = selected?.authMethods.find((item) => item.id === activeAuth);
  const currentSettings = selected ? settingsByProvider[selected.id] ?? initialSettings(selected.fields) : {};
  const providerAccounts = selected ? props.accounts.filter((account) => account.providerId === selected.id) : [];

  useEffect(() => {
    setProbe(null);
    setSelectedModelId("");
    setSecret("");
    setError("");
    setDisplayName(selected?.name ?? "");
  }, [selected?.id, activeAuth]);

  if (!selected) return null;

  const setField = (fieldId: string, value: string) => setSettingsByProvider((current) => ({
    ...current,
    [selected.id]: { ...(current[selected.id] ?? initialSettings(selected.fields)), [fieldId]: value },
  }));

  const draft = (): AiSettingsDraftInput => ({
    providerId: selected.id,
    displayName: displayName.trim() || selected.name,
    authMethodId: activeAuth,
    settings: currentSettings,
    selectedModelId: selectedModelId || null,
  });

  const runProbe = async () => {
    setBusy("probe"); setError("");
    try {
      const result = await props.onProbe(draft(), secret);
      setProbe(result);
      if (!selectedModelId && result.models[0]) setSelectedModelId(result.models[0].id);
    } catch (value) { setError(value instanceof Error ? value.message : "连接测试失败。"); }
    finally { setBusy(null); }
  };

  const save = async () => {
    setBusy("save"); setError("");
    try {
      const result = await props.onSave(draft(), secret);
      setProbe(result);
      setSecret("");
    } catch (value) { setError(value instanceof Error ? value.message : "保存账户失败。"); }
    finally { setBusy(null); }
  };

  return (
    <div className="ai-settings-panel-root">
      <div className="ai-provider-grid" role="list" aria-label="AI Provider">
        {props.providers.map((provider) => (
          <button key={provider.id} type="button" role="listitem" className={`ai-provider-card${provider.id === selected.id ? " is-active" : ""}`} onClick={() => props.onSelectProvider(provider.id)}>
            <span className="ai-provider-mark">{provider.name.slice(0, 1).toUpperCase()}</span>
            <span><strong>{provider.name}</strong><small>{provider.description}</small></span>
          </button>
        ))}
      </div>

      <div className="ai-settings-detail ai-settings-detail--runtime">
        <div className="ai-settings-panel">
          <div className="ai-settings-panel__title"><div><small>当前 Provider</small><h2>{selected.name}</h2></div><span>{selected.authMethods.length} 种认证</span></div>
          <div className="ai-auth-tabs">
            {selected.authMethods.map((auth) => (
              <button key={auth.id} type="button" className={auth.id === activeAuth ? "is-active" : ""} onClick={() => setAuthByProvider((value) => ({ ...value, [selected.id]: auth.id }))}>{auth.label}</button>
            ))}
          </div>
          {activeAuthView?.description ? <p className="ai-auth-help">{activeAuthView.description}</p> : null}
          {!activeAuthView?.available ? <div className="ai-runtime-notice is-warn"><strong>暂未接入</strong><span>{activeAuthView?.unavailableReason ?? "当前宿主不支持此认证方式。"}</span></div> : null}

          <div className="ai-config-fields">
            <label className="ai-config-field"><span>账户名称</span><input type="text" value={displayName} onChange={(event)=>setDisplayName(event.target.value)} placeholder={selected.name} /></label>
            {selected.fields.map((field) => (
              <label key={field.id} className="ai-config-field">
                <span>{field.label}{field.required ? <b>*</b> : null}</span>
                {field.kind === "select" ? (
                  <select value={currentSettings[field.id] ?? field.defaultValue ?? ""} onChange={(event)=>setField(field.id,event.target.value)}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                ) : <input type="text" value={currentSettings[field.id] ?? ""} onChange={(event)=>setField(field.id,event.target.value)} placeholder={field.placeholder} />}
                {field.help ? <small>{field.help}</small> : null}
              </label>
            ))}
            {activeAuthView?.secretLabel ? <label className="ai-config-field ai-config-field--secret"><span>{activeAuthView.secretLabel}*</span><input type="password" autoComplete="off" spellCheck={false} value={secret} onChange={(event)=>setSecret(event.target.value)} placeholder={`输入 ${activeAuthView.secretLabel}`} /></label> : null}
            <label className="ai-config-field"><span>模型 ID（可选）</span><input type="text" value={selectedModelId} onChange={(event)=>setSelectedModelId(event.target.value)} placeholder="可先手工填写；连接成功后可从模型列表选择" /><small>没有稳定模型目录接口的 Provider 使用此值；能自动发现模型时也可先留空。</small></label>
          </div>

          {probe ? <div className={`ai-runtime-notice ${probe.status === "connected" ? "is-ok" : "is-warn"}`}><strong>{probe.status === "connected" ? "连接成功" : "未自动验证"}</strong><span>{probe.message}</span>{probe.resolvedBaseUrl ? <small>{probe.resolvedBaseUrl}</small> : null}</div> : null}
          {probe?.models.length ? <label className="ai-model-select"><span>模型</span><select value={selectedModelId} onChange={(event)=>setSelectedModelId(event.target.value)}>{probe.models.map((model)=><option key={model.id} value={model.id}>{model.name ? `${model.name} · ${model.id}` : model.id}</option>)}</select></label> : null}
          {error ? <div className="ai-runtime-error" role="alert">{error}</div> : null}

          <div className="ai-runtime-actions">
            <button type="button" disabled={!props.hostAvailable || !activeAuthView?.available || busy !== null} onClick={()=>void runProbe()}>{busy === "probe" ? "测试中…" : "测试连接"}</button>
            <button className="is-primary" type="button" disabled={!props.hostAvailable || !activeAuthView?.available || busy !== null || !secret.trim()} onClick={()=>void save()}>{busy === "save" ? "保存中…" : "保存账户"}</button>
          </div>
          <p className="ai-secret-note">凭证只发送到本机 LFAA Host；不会写入浏览器存储。{props.secretPersistence === "os-credential-store" ? " Windows 下保存到 Credential Manager。" : props.secretPersistence === "memory" ? " 当前宿主仅内存保存，重启后需重新录入。" : " Host 尚未连接。"}</p>
        </div>

        <aside className="ai-settings-side ai-account-list">
          <div className="ai-account-list__head"><h3>已保存账户</h3><span>{providerAccounts.length}</span></div>
          {providerAccounts.length === 0 ? <p className="ai-account-empty">当前 Provider 还没有保存账户。</p> : providerAccounts.map((account)=>{
            const models = accountModels[account.id] ?? [];
            return <article className="ai-account-card" key={account.id}>
              <div><strong>{account.displayName}</strong><small>{account.verificationStatus === "connected" ? "已验证" : "未自动验证"}{account.selectedModelId ? ` · ${account.selectedModelId}` : ""}</small></div>
              {models.length ? <label className="ai-account-model"><span>当前模型</span><select value={account.selectedModelId ?? ""} onChange={async(event)=>{const modelId=event.target.value;setBusy("account");setError("");try{await props.onSelectAccountModel(account.id,modelId);}catch(value){setError(value instanceof Error?value.message:"模型切换失败。");}finally{setBusy(null);}}}><option value="">未选择</option>{models.map((model)=><option key={model.id} value={model.id}>{model.name ? `${model.name} · ${model.id}` : model.id}</option>)}</select></label> : null}
              <div className="ai-account-actions">
                <button type="button" disabled={busy!==null} onClick={async()=>{setBusy("account");setError("");try{const result=await props.onReprobe(account.id);setProbe(result);setAccountModels((current)=>({...current,[account.id]:result.models}));if(result.models[0])setSelectedModelId(account.selectedModelId ?? result.models[0].id);}catch(value){setError(value instanceof Error?value.message:"重新测试失败。");}finally{setBusy(null);}}}>重测</button>
                <button type="button" disabled={busy!==null} onClick={async()=>{setBusy("account");setError("");try{await props.onDeleteAccount(account.id);setAccountModels((current)=>{const next={...current};delete next[account.id];return next;});}catch(value){setError(value instanceof Error?value.message:"删除账户失败。");}finally{setBusy(null);}}}>删除</button>
              </div>
            </article>;
          })}
        </aside>
      </div>
    </div>
  );
}
