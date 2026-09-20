/**
 * 文件：PluginSettingsPanel.tsx
 * 作用：LFAA 设置中心的“插件与能力”管理界面。
 * 负责：DSH 风格 inspect → 确认 → 事务安装 → 启用，以及已安装插件启停/移除。
 * 不负责：pnpm、Profile 文件、第三方代码 import、Secret 读取、权限绕过。
 * 状态归属：安装输入与确认状态仅在本 View；Plugin Profile 真值由 Host/PluginManager 持有。
 * 对外接口：PluginSettingsPanel。
 * 关联文件：../contracts/settings.types.ts、../logic/usePluginSettingsController.ts、SettingsPage.tsx。
 * 修改注意事项：这里不执行插件代码，也不把依赖写入 LFAA 根 workspace。
 */
import { useMemo, useState } from "react";
import type {
  PluginSettingsInstalledView,
  PluginSettingsInspectionView,
  PluginSettingsInstallResultView,
  PluginSettingsPanelProps,
} from "../contracts/settings.types";

function CapabilitySummary({ plugin }: { plugin: Pick<PluginSettingsInstalledView, "capabilities" | "credentials"> }) {
  const grouped = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of plugin.capabilities) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [plugin.capabilities]);
  return (
    <div className="lfaa-plugin-capability-summary">
      {grouped.length ? grouped.map(([kind, count]) => <span key={kind}>{kind} · {count}</span>) : <span>未声明能力</span>}
      {plugin.credentials.length ? <span>凭据需求 · {plugin.credentials.length}</span> : null}
    </div>
  );
}

function InstalledCard({ plugin, busy, onToggle, onRemove }: {
  plugin: PluginSettingsInstalledView;
  busy: boolean;
  onToggle: () => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  return (
    <article className="lfaa-plugin-card">
      <div className="lfaa-plugin-card-main">
        <div className="lfaa-plugin-title-row"><strong>{plugin.displayName}</strong><code>{plugin.packageVersion}</code></div>
        <p>{plugin.description || plugin.pluginId}</p>
        <CapabilitySummary plugin={plugin} />
      </div>
      <div className="lfaa-plugin-actions">
        <button type="button" disabled={busy} className={plugin.enabled ? "is-on" : ""} onClick={() => void onToggle()}>{plugin.enabled ? "已启用" : "启用"}</button>
        <button type="button" disabled={busy} className="is-danger-quiet" onClick={() => void onRemove()}>移除</button>
      </div>
    </article>
  );
}

function InspectionCard({ inspection }: { inspection: Extract<PluginSettingsInspectionView, { status: "accepted" }> }) {
  return (
    <div className="lfaa-plugin-inspection">
      <div className="lfaa-plugin-title-row"><strong>{inspection.displayName}</strong><code>{inspection.packageVersion}</code></div>
      <p>{inspection.description || inspection.pluginId}</p>
      <div className="lfaa-plugin-meta-grid">
        <span>来源<strong>{inspection.sourceKind}</strong></span>
        <span>包名<strong>{inspection.packageName}</strong></span>
        <span>Plugin API<strong>v{inspection.pluginApiVersion}</strong></span>
        <span>能力<strong>{inspection.capabilities.length}</strong></span>
      </div>
      <CapabilitySummary plugin={inspection} />
      {inspection.permissions.length ? <div className="lfaa-plugin-notice"><strong>需要的系统能力</strong><p>{inspection.permissions.join(" · ")}</p></div> : null}
      {inspection.credentials.length ? <div className="lfaa-plugin-notice is-secret"><strong>凭据需求</strong><p>{inspection.credentials.map((item) => `${item.displayName}（${item.exposure === "host-mediated" ? "宿主代办" : "隔离进程临时注入"}）`).join(" · ")}</p><small>这里只声明需求；API Key/Token 不会写进插件配置或 Manifest。</small></div> : null}
    </div>
  );
}

export function PluginSettingsPanel(props: PluginSettingsPanelProps) {
  const [spec, setSpec] = useState("");
  const [inspection, setInspection] = useState<PluginSettingsInspectionView | null>(null);
  const [installResult, setInstallResult] = useState<PluginSettingsInstallResultView | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const inspect = async () => {
    setBusy(true); setError(""); setInstallResult(null);
    try { setInspection(await props.onInspectPlugin(spec)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "插件检查失败。"); }
    finally { setBusy(false); }
  };

  const install = async (approvedBuilds?: readonly string[]) => {
    if (!inspection || inspection.status !== "accepted") return;
    const requestId = crypto.randomUUID();
    setBusy(true); setError(""); setActiveRequestId(requestId);
    try {
      const result = await props.onInstallPlugin(spec, requestId, approvedBuilds);
      setInstallResult(result);
      if (result.status === "installed") setInspection(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "插件安装失败。"); }
    finally { setBusy(false); setActiveRequestId(null); }
  };

  return (
    <div className="lfaa-plugin-settings">
      <section className="lfaa-plugin-install-card">
        <div className="lfaa-plugin-install-heading"><div><strong>安装插件</strong><small>支持包名、绝对路径、Git 地址与 .tgz/.tar.gz。先检查，确认后才写入独立 Plugin Profile。</small></div><span>Registry generation {props.registryGeneration}</span></div>
        <div className="lfaa-plugin-spec-row">
          <input value={spec} disabled={!props.hostAvailable || busy} onChange={(event) => { setSpec(event.target.value); setInspection(null); setInstallResult(null); }} placeholder="@lfaa/example-plugin 或 https://github.com/…" aria-label="插件来源" />
          <button type="button" disabled={!props.hostAvailable || busy || !spec.trim()} onClick={() => void inspect()}>检查</button>
        </div>
        {!props.hostAvailable ? <p className="lfaa-plugin-inline-error">当前宿主未连接 Plugin Manager；不会伪造安装结果。</p> : null}
        {inspection?.status === "refused" ? <p className="lfaa-plugin-inline-error">{inspection.reason}</p> : null}
        {inspection?.status === "accepted" ? <><InspectionCard inspection={inspection} /><div className="lfaa-plugin-confirm-row"><span>安装完成后默认保持禁用，确认能力与权限后再启用。</span><button type="button" disabled={busy} onClick={() => void install()}>安装</button></div></> : null}
        {activeRequestId ? <div className="lfaa-plugin-installing"><span>正在执行事务安装…</span><button type="button" onClick={() => void props.onCancelPlugin(activeRequestId)}>取消</button></div> : null}
        {installResult?.status === "installed" ? <div className="lfaa-plugin-success"><strong>插件已安装，当前未启用。</strong><span>{installResult.bundleDisplayName}</span>{installResult.packageName ? <button type="button" onClick={() => void props.onSetPluginEnabled(installResult.packageName!, true)}>立即启用</button> : null}</div> : null}
        {installResult?.status === "failed" ? <div className="lfaa-plugin-inline-error"><strong>安装失败：{installResult.failureKind || "unknown"}</strong><span>{installResult.diagnostic}</span>{installResult.pendingBuilds?.length ? <button type="button" disabled={busy} onClick={() => void install(installResult.pendingBuilds)}>允许这些构建脚本并重试：{installResult.pendingBuilds.join("、")}</button> : null}</div> : null}
        {installResult?.status === "cancelled" ? <p className="lfaa-plugin-inline-error">安装已取消，Profile manifest 与 lockfile 已回滚。</p> : null}
        {error ? <p className="lfaa-plugin-inline-error">{error}</p> : null}
      </section>

      <section className="lfaa-plugin-installed-section">
        <div className="lfaa-plugin-section-heading"><div><h2>已安装</h2><p>启用/禁用只切换 Capability generation；不会在浏览器主进程直接 import 第三方代码。</p></div><span>{props.installed.length} 个</span></div>
        {props.installed.length ? <div className="lfaa-plugin-list">{props.installed.map((plugin) => <InstalledCard key={plugin.packageName} plugin={plugin} busy={busy} onToggle={() => props.onSetPluginEnabled(plugin.packageName, !plugin.enabled)} onRemove={() => props.onRemovePlugin(plugin.packageName)} />)}</div> : <div className="lfaa-settings-empty"><strong>还没有安装 LFAA 插件</strong><p>插件依赖会进入独立的本地 Profile，不污染 LFAA 主 workspace。</p></div>}
      </section>
    </div>
  );
}
