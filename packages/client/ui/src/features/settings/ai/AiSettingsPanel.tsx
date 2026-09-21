/**
 * 文件：AiSettingsPanel.tsx
 * 作用：Settings Surface 内的 AI Provider 真实配置面板。
 * 负责：Provider/认证选择、Secret 瞬时输入、官方模型目录、模型能力配置、账户保存/重测/删除交互。
 * 不负责：厂商 HTTP、Secret 持久化、credentialRef、Provider 业务判断。
 * 状态归属：只拥有未保存表单、本次探测结果与临时模型配置；账户真值由外部 Props 注入。
 * 对外接口：AiSettingsPanel。
 * 关联文件：ai-settings.types.ts、ai-settings.css、packages/client/app-shell/src/workbench/settings/view/SettingsPage.tsx。
 * 修改注意事项：模型 ID 与配置字段必须来自 Host 的官方 Capability；禁止 UI 写厂商模型白名单或参数分支。
 */
import { useEffect, useMemo, useState } from "react";
import type {
  AiSettingsDraftInput,
  AiSettingsModelSettingValue,
  AiSettingsModelView,
  AiSettingsPageProps,
  AiSettingsProbeView,
} from "./ai-settings.types";
import "./ai-settings.css";

export type AiSettingsPanelProps = Omit<AiSettingsPageProps, "onClose">;

type ModelSettings = Readonly<Record<string, AiSettingsModelSettingValue>>;

function initialSettings(fields: AiSettingsPanelProps["providers"][number]["fields"]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.id, field.defaultValue ?? ""]));
}

function defaultModelSettings(model: AiSettingsModelView | undefined): Record<string, AiSettingsModelSettingValue> {
  return Object.fromEntries((model?.capabilities?.settings ?? []).flatMap((field) => field.defaultValue === undefined ? [] : [[field.id, field.defaultValue]]));
}

function numberLabel(value: number | undefined): string | null {
  if (value === undefined) return null;
  return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 2)}M` : value >= 1_000 ? `${Math.round(value / 1_000)}K` : String(value);
}

function ModelCapabilityEditor({ model, values, onChange }: { model: AiSettingsModelView | undefined; values: ModelSettings; onChange(next: Record<string, AiSettingsModelSettingValue>): void }) {
  if (!model) return null;
  const capabilities = model.capabilities;
  const context = numberLabel(model.contextWindow ?? capabilities?.contextWindow);
  const output = numberLabel(model.maxOutputTokens ?? capabilities?.maxOutputTokens);
  return (
    <section className="ai-model-capability" aria-label="模型官方配置">
      <div className="ai-model-capability__head">
        <div><strong>模型配置</strong><small>{model.id}</small></div>
        <div className="ai-model-badges">{context ? <span>上下文 {context}</span> : null}{output ? <span>输出 {output}</span> : null}</div>
      </div>
      {capabilities ? (
        <>
          {capabilities.settings.length ? <div className="ai-model-settings-grid">{capabilities.settings.map((field) => {
            const current = values[field.id] ?? field.defaultValue;
            return <label key={field.id} className="ai-config-field">
              <span>{field.label}<small className="ai-request-path">{field.requestPath}</small></span>
              {field.kind === "select" ? (
                <select value={typeof current === "string" ? current : ""} onChange={(event) => onChange({ ...values, [field.id]: event.target.value })}>
                  {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : field.kind === "boolean" ? (
                <select value={current === true ? "true" : "false"} onChange={(event) => onChange({ ...values, [field.id]: event.target.value === "true" })}>
                  <option value="true">开启</option><option value="false">关闭</option>
                </select>
              ) : (
                <input type="number" min={field.min} max={field.max} step={field.step ?? 1} value={typeof current === "number" ? current : ""} onChange={(event) => onChange({ ...values, [field.id]: Number(event.target.value) })} />
              )}
              {field.help ? <small>{field.help}</small> : null}
            </label>;
          })}</div> : <p className="ai-model-capability__empty">该模型暂无需要用户配置的官方参数。</p>}
          <div className="ai-model-source"><span>能力来源：{capabilities.source.label}</span><span>核对：{capabilities.source.checkedAt}</span></div>
          {capabilities.notes?.map((note) => <p className="ai-model-note" key={note}>{note}</p>)}
        </>
      ) : <p className="ai-model-capability__empty">该模型 ID 来自官方目录；当前没有足够官方资料确认额外参数，因此不展示猜测配置。</p>}
    </section>
  );
}


function formatReset(unixSeconds: number | undefined): string | null {
  if (!unixSeconds) return null;
  const date = new Date(unixSeconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

function UsagePanel({ usage, usageState = "idle", usageError, selectedModelId }: { usage: import("./ai-settings.types").AiSettingsUsageView | undefined; usageState?: "idle" | "loading" | "ready" | "error"; usageError?: string; selectedModelId: string | null }) {
  if (usageState === "loading") return <div className="ai-usage-card is-loading"><strong>余额 / 额度</strong><small>正在读取 Provider 官方状态…</small></div>;
  if (usageState === "error") return <div className="ai-usage-card is-unavailable"><strong>余额 / 额度</strong><small>读取失败：{usageError || "官方接口暂时不可用。"}</small><p className="ai-usage-message">可点击“刷新额度”重试；模型账户本身仍可继续使用。</p></div>;
  if (!usage) return <div className="ai-usage-card is-unavailable"><strong>余额 / 额度</strong><small>尚未读取官方状态。</small></div>;
  const scopeLabel = usage.scope === "codex-work" ? "Codex / Work" : usage.scope === "provider-plan" ? "套餐" : "API";
  const modelQuota = selectedModelId ? usage.modelQuotas?.find((item) => item.model === selectedModelId) : undefined;
  return (
    <section className={`ai-usage-card ${usage.status === "available" ? "is-ok" : "is-unavailable"}`} aria-label="官方余额与额度">
      <div className="ai-usage-card__head">
        <div><strong>官方余额 / 额度</strong><small>{scopeLabel}{usage.planType ? ` · ${usage.planType}` : ""}</small></div>
        <span>{usage.status === "available" ? "实时" : "官方未提供"}</span>
      </div>
      {usage.balances?.length ? <div className="ai-usage-balances">{usage.balances.map((balance) => <div key={balance.currency}><b>{balance.total} {balance.currency}</b><small>{balance.toppedUp !== undefined ? `充值 ${balance.toppedUp}` : ""}{balance.granted !== undefined ? ` · 赠金 ${balance.granted}` : ""}</small></div>)}</div> : null}
      {usage.rateLimits?.length ? <div className="ai-usage-limits">{usage.rateLimits.map((limit) => {
        const reset = formatReset(limit.resetsAt);
        return <div key={limit.id}><span>{limit.label || limit.id}</span><b>{Math.max(0, Math.min(100, limit.usedPercent)).toFixed(0)}% 已用</b>{reset ? <small>重置：{reset}</small> : null}</div>;
      })}</div> : null}
      {modelQuota ? <div className="ai-usage-quota"><span>{modelQuota.model}</span>{modelQuota.requestLimit !== undefined ? <small>请求上限 {modelQuota.requestLimit}/{modelQuota.requestLimitPeriodSec ?? "?"}s</small> : null}{modelQuota.tokenLimit !== undefined ? <small>Token 上限 {modelQuota.tokenLimit}/{modelQuota.tokenLimitPeriodSec ?? "?"}s</small> : null}</div> : null}
      {usage.tokenUsage?.lifetimeTokens !== undefined && usage.tokenUsage.lifetimeTokens !== null ? <p className="ai-usage-token">累计 Token 活动：{usage.tokenUsage.lifetimeTokens.toLocaleString()}</p> : null}
      {usage.resetCreditsAvailable !== undefined && usage.resetCreditsAvailable !== null ? <p className="ai-usage-token">可用额度重置：{usage.resetCreditsAvailable}</p> : null}
      <p className="ai-usage-message">{usage.message}</p>
      <div className="ai-model-source"><span>来源：{usage.source.label}</span><span>核对：{usage.source.checkedAt}</span></div>
    </section>
  );
}

export function AiSettingsPanel(props: AiSettingsPanelProps) {
  const selected = useMemo(() => props.providers.find((item) => item.id === props.selectedProviderId) ?? props.providers[0], [props.providers, props.selectedProviderId]);
  const [authByProvider, setAuthByProvider] = useState<Record<string, string>>({});
  const [settingsByProvider, setSettingsByProvider] = useState<Record<string, Record<string, string>>>({});
  const [displayName, setDisplayName] = useState("");
  const [secret, setSecret] = useState("");
  const [probe, setProbe] = useState<AiSettingsProbeView | null>(null);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [modelSettings, setModelSettings] = useState<Record<string, AiSettingsModelSettingValue>>({});
  const [accountModelSettings, setAccountModelSettings] = useState<Record<string, Record<string, AiSettingsModelSettingValue>>>({});
  const [busy, setBusy] = useState<"probe" | "save" | "connect" | "account" | null>(null);
  const [error, setError] = useState("");

  const activeAuth = selected ? authByProvider[selected.id] ?? selected.authMethods[0]?.id ?? "" : "";
  const activeAuthView = selected?.authMethods.find((item) => item.id === activeAuth);
  const currentSettings = selected ? settingsByProvider[selected.id] ?? initialSettings(selected.fields) : {};
  const providerAccounts = selected ? props.accounts.filter((account) => account.providerId === selected.id) : [];
  const selectedModel = probe?.models.find((model) => model.id === selectedModelId);
  const isSubscription = activeAuthView?.kind === "subscription";
  const activeAccount = props.activeModel ? props.accounts.find((account) => account.id === props.activeModel?.accountId) : undefined;

  useEffect(() => {
    setProbe(null); setSelectedModelId(""); setModelSettings({}); setSecret(""); setError(""); setDisplayName(selected?.name ?? "");
  }, [selected?.id, activeAuth]);

  useEffect(() => {
    if (!selectedModel) return;
    setModelSettings(defaultModelSettings(selectedModel));
  }, [selectedModel?.id]);

  if (!selected) return null;

  const setField = (fieldId: string, value: string) => setSettingsByProvider((current) => ({ ...current, [selected.id]: { ...(current[selected.id] ?? initialSettings(selected.fields)), [fieldId]: value } }));

  const draft = (): AiSettingsDraftInput => ({
    providerId: selected.id,
    displayName: displayName.trim() || selected.name,
    authMethodId: activeAuth,
    settings: currentSettings,
    selectedModelId: selectedModelId || null,
    modelSettings,
  });

  const runProbe = async () => {
    setBusy("probe"); setError("");
    try {
      const result = await props.onProbe(draft(), secret);
      setProbe(result);
      const nextModel = result.models.find((model) => model.id === selectedModelId) ?? result.models[0];
      setSelectedModelId(nextModel?.id ?? "");
      setModelSettings(defaultModelSettings(nextModel));
    } catch (value) { setError(value instanceof Error ? value.message : "连接测试失败。"); }
    finally { setBusy(null); }
  };

  const save = async () => {
    setBusy("save"); setError("");
    try {
      const result = await props.onSave(draft(), secret);
      setProbe(result); setSecret("");
    } catch (value) { setError(value instanceof Error ? value.message : "保存账户失败。"); }
    finally { setBusy(null); }
  };

  const connectSubscription = async () => {
    setBusy("connect"); setError("");
    try {
      const result = await props.onConnectSubscription(draft());
      setProbe(result);
      const nextModel = result.models.find((model) => model.id === selectedModelId) ?? result.models[0];
      setSelectedModelId(nextModel?.id ?? "");
      setModelSettings(defaultModelSettings(nextModel));
    } catch (value) { setError(value instanceof Error ? value.message : "ChatGPT 登录失败。"); }
    finally { setBusy(null); }
  };

  return (
    <div className="ai-settings-panel-root">
      <div className="ai-active-model-summary">
        <div><small>当前 Agent 模型</small><strong>{props.activeModel ? props.activeModel.modelId : "尚未选择"}</strong></div>
        <span>{activeAccount ? `${activeAccount.displayName} · ${activeAccount.providerId}` : "保存账户后可设为当前模型"}</span>
      </div>
      <div className="ai-provider-grid" role="list" aria-label="AI Provider">
        {props.providers.map((provider) => <button key={provider.id} type="button" role="listitem" className={`ai-provider-card${provider.id === selected.id ? " is-active" : ""}`} onClick={() => props.onSelectProvider(provider.id)}><span className="ai-provider-mark">{provider.name.slice(0, 1).toUpperCase()}</span><span><strong>{provider.name}</strong><small>{provider.description}</small></span></button>)}
      </div>

      <div className="ai-settings-detail ai-settings-detail--runtime">
        <div className="ai-settings-panel">
          <div className="ai-settings-panel__title"><div><small>当前 Provider</small><h2>{selected.name}</h2></div><span>{selected.authMethods.length} 种认证</span></div>
          <div className="ai-auth-tabs">{selected.authMethods.map((auth) => <button key={auth.id} type="button" className={auth.id === activeAuth ? "is-active" : ""} onClick={() => setAuthByProvider((value) => ({ ...value, [selected.id]: auth.id }))}>{auth.label}</button>)}</div>
          {activeAuthView?.description ? <p className="ai-auth-help">{activeAuthView.description}</p> : null}
          {!activeAuthView?.available ? <div className="ai-runtime-notice is-warn"><strong>暂未接入</strong><span>{activeAuthView?.unavailableReason ?? "当前宿主不支持此认证方式。"}</span></div> : null}

          <div className="ai-config-fields">
            <label className="ai-config-field"><span>账户名称</span><input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={selected.name} /></label>
            {selected.fields.map((field) => <label key={field.id} className="ai-config-field"><span>{field.label}{field.required ? <b>*</b> : null}</span>{field.kind === "select" ? <select value={currentSettings[field.id] ?? field.defaultValue ?? ""} onChange={(event) => setField(field.id, event.target.value)}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type="text" value={currentSettings[field.id] ?? ""} onChange={(event) => setField(field.id, event.target.value)} placeholder={field.placeholder} />}{field.help ? <small>{field.help}</small> : null}</label>)}
            {activeAuthView?.secretLabel ? <label className="ai-config-field ai-config-field--secret"><span>{activeAuthView.secretLabel}*</span><input type="password" autoComplete="off" spellCheck={false} value={secret} onChange={(event) => setSecret(event.target.value)} placeholder={`输入 ${activeAuthView.secretLabel}`} /></label> : null}
          </div>

          {probe ? <div className={`ai-runtime-notice ${probe.status === "connected" ? "is-ok" : "is-warn"}`}><strong>{probe.status === "connected" ? "连接成功" : "官方目录"}</strong><span>{probe.message}</span>{probe.resolvedBaseUrl ? <small>{probe.resolvedBaseUrl}</small> : null}</div> : null}
          {probe?.models.length ? <label className="ai-model-select"><span>官方模型</span><select value={selectedModelId} onChange={(event) => { const model = probe.models.find((item) => item.id === event.target.value); setSelectedModelId(event.target.value); setModelSettings(defaultModelSettings(model)); }}>{probe.models.map((model) => <option key={model.id} value={model.id}>{model.name ? `${model.name} · ${model.id}` : model.id}</option>)}</select><small>{selectedModel?.discoverySource ? `模型 ID 来源：${selectedModel.discoverySource.label}` : "模型 ID 来自 Provider 官方目录。"}</small></label> : null}
          {probe?.manualModelEntry ? <label className="ai-model-select"><span>模型 ID</span><input type="text" value={selectedModelId} onChange={(event) => { setSelectedModelId(event.target.value.trim()); setModelSettings({}); }} placeholder="输入 Provider 官方模型 ID" /><small>当前 Provider 无可查询模型目录；保存时 Core 仍会重新校验连接配置。</small></label> : null}
          <ModelCapabilityEditor model={selectedModel} values={modelSettings} onChange={setModelSettings} />
          {error ? <div className="ai-runtime-error" role="alert">{error}</div> : null}

          <div className="ai-runtime-actions">
            {isSubscription ? (
              <button className="is-primary" type="button" disabled={!props.hostAvailable || !activeAuthView?.available || busy !== null} onClick={() => void connectSubscription()}>{busy === "connect" ? "正在准备 / 等待 OpenAI 登录…" : "登录 ChatGPT 并保存账户"}</button>
            ) : (
              <>
                <button type="button" disabled={!props.hostAvailable || !activeAuthView?.available || busy !== null} onClick={() => void runProbe()}>{busy === "probe" ? "测试中…" : "测试连接 / 获取模型"}</button>
                <button className="is-primary" type="button" disabled={!props.hostAvailable || !activeAuthView?.available || busy !== null || !secret.trim() || !selectedModelId} onClick={() => void save()}>{busy === "save" ? "保存本地配置…" : "保存账户"}</button>
              </>
            )}
          </div>
          <p className="ai-secret-note">{isSubscription ? "ChatGPT 登录与 Token 生命周期由 OpenAI 官方运行组件管理；LFAA 按需准备该组件，不要求单独安装 CLI，也不读取或保存 OAuth Token。删除此项目账户只解除 LFAA 关联。" : <>凭证只发送到本机 LFAA Host；不会写入浏览器存储。{props.secretPersistence === "os-credential-store" ? " Windows 下由 Rust Secret Broker 写入 Credential Manager。" : props.secretPersistence === "memory" ? " 当前宿主仅内存保存，重启后需重新录入。" : " Host 尚未连接。"}</>}</p>
        </div>

        <aside className="ai-settings-side ai-account-list">
          <div className="ai-account-list__head"><h3>已保存账户</h3><span>{providerAccounts.length}</span></div>
          {providerAccounts.length === 0 ? <p className="ai-account-empty">当前 Provider 还没有保存账户。</p> : providerAccounts.map((account) => {
            const models = account.modelCatalog;
            const model = models.find((item) => item.id === account.selectedModelId);
            const values = accountModelSettings[account.id] ?? { ...account.modelSettings };
            const isActive = props.activeModel?.accountId === account.id && props.activeModel.modelId === account.selectedModelId;
            return <article className={`ai-account-card${isActive ? " is-active-model" : ""}`} key={account.id}>
              <div><strong>{account.displayName}{isActive ? <em className="ai-active-model-badge">当前模型</em> : null}</strong><small>{account.verificationStatus === "connected" ? "已验证" : account.verificationStatus === "error" ? "验证失败" : "未自动验证"}{account.selectedModelId ? ` · ${account.selectedModelId}` : ""}</small></div>
              {models.length ? <label className="ai-account-model"><span>当前模型</span><select value={account.selectedModelId ?? ""} onChange={async (event) => { const modelId = event.target.value; const nextModel = models.find((item) => item.id === modelId); const nextSettings = defaultModelSettings(nextModel); setAccountModelSettings((current) => ({ ...current, [account.id]: nextSettings })); setBusy("account"); setError(""); try { await props.onSelectAccountModel(account.id, modelId, nextSettings); } catch (value) { setError(value instanceof Error ? value.message : "模型切换失败。"); } finally { setBusy(null); } }}><option value="">未选择</option>{models.map((item) => <option key={item.id} value={item.id}>{item.name ? `${item.name} · ${item.id}` : item.id}</option>)}</select></label> : null}
              {model ? <ModelCapabilityEditor model={model} values={values} onChange={(next) => setAccountModelSettings((current) => ({ ...current, [account.id]: next }))} /> : null}
              <UsagePanel usage={account.usage} usageState={account.usageState} usageError={account.usageError} selectedModelId={account.selectedModelId} />
              {!models.length ? <p className="ai-account-empty">该账户还没有模型目录快照；点击“重测”刷新。</p> : null}
              <div className="ai-account-actions">
                {model?.capabilities?.settings.length ? <button type="button" disabled={busy !== null} onClick={async () => { setBusy("account"); setError(""); try { await props.onSelectAccountModel(account.id, model.id, values); } catch (value) { setError(value instanceof Error ? value.message : "模型配置保存失败。"); } finally { setBusy(null); } }}>保存模型配置</button> : null}
                {account.selectedModelId && !isActive ? <button className="is-primary" type="button" disabled={busy !== null} onClick={async () => { setBusy("account"); setError(""); try { await props.onActivateAccountModel(account.id); } catch (value) { setError(value instanceof Error ? value.message : "设置当前模型失败。"); } finally { setBusy(null); } }}>设为当前模型</button> : null}
                <button type="button" disabled={busy !== null} onClick={async () => { setBusy("account"); setError(""); try { await props.onRefreshUsage(account.id); } catch (value) { setError(value instanceof Error ? value.message : "额度刷新失败。"); } finally { setBusy(null); } }}>刷新额度</button>
                <button type="button" disabled={busy !== null} onClick={async () => { setBusy("account"); setError(""); try { const result = await props.onReprobe(account.id); setProbe(result); const currentModel = result.models.find((item) => item.id === account.selectedModelId) ?? result.models[0]; setSelectedModelId(currentModel?.id ?? ""); setAccountModelSettings((current) => ({ ...current, [account.id]: Object.keys(account.modelSettings).length ? { ...account.modelSettings } : defaultModelSettings(currentModel) })); } catch (value) { setError(value instanceof Error ? value.message : "重新测试失败。"); } finally { setBusy(null); } }}>重测</button>
                <button type="button" disabled={busy !== null} onClick={async () => { setBusy("account"); setError(""); try { await props.onDeleteAccount(account.id); setAccountModelSettings((current) => { const next = { ...current }; delete next[account.id]; return next; }); } catch (value) { setError(value instanceof Error ? value.message : "删除账户失败。"); } finally { setBusy(null); } }}>删除</button>
              </div>
            </article>;
          })}
        </aside>
      </div>
    </div>
  );
}
