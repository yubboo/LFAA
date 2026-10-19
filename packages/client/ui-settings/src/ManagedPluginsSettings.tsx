/** 功能：呈现设置中心的 Profile 插件开关。作用：读取并调用现有插件生命周期 Owner，不复制安装或运行规则。关联文件：PluginManagerPage、client/connection、SettingsPage。 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Input, Select, Space, Typography } from "antd";
import { getErrorMessage, hasAdminAccess, loadManagedPlugins, setManagedPluginEnabled, type ApplicationId, type ManagedPluginRecord, type User } from "lfaa-client-connection/src/api.js";
import { SettingGroup, SettingRow, SettingsSwitch } from "lfaa-client-ui-primitives/src/settings-controls.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import type { ApplicationNavigationItem } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";

function pluginStateLabel(plugin: ManagedPluginRecord): string {
  if (plugin.state === "enabled") return "已启用";
  if (plugin.state === "incompatible") return "当前不兼容";
  return "已安装，未启用";
}

function pluginCompatibilityLabel(plugin: ManagedPluginRecord): string {
  return plugin.compatibility === "lfaa-v1" ? "LFAA Runtime" : plugin.compatibility === "dsh-v1" ? "DSH Bundle" : "未知合同";
}

export function ManagedPluginsSettings({ user, applications, onNavigate }: {
  user: User;
  applications: ApplicationNavigationItem[];
  onNavigate: (path: string) => void;
}) {
  const canManage = hasAdminAccess(user.role);
  const [plugins, setPlugins] = useState<ManagedPluginRecord[]>([]);
  const [profile, setProfile] = useState("");
  const [loading, setLoading] = useState(canManage);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [pendingPluginId, setPendingPluginId] = useState<string | null>(null);
  const [targetApplications, setTargetApplications] = useState<Record<string, ApplicationId>>({});
  const [refreshSequence, setRefreshSequence] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!canManage) {
      setPlugins([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void loadManagedPlugins(controller.signal).then(result => {
      if (!mountedRef.current || controller.signal.aborted) return;
      setProfile(result.profile);
      setPlugins(result.plugins);
      setTargetApplications(current => {
        const next = { ...current };
        for (const plugin of result.plugins) {
          if (plugin.applicationIds.length > 1 && plugin.applicationIds.includes(next[plugin.id] as ApplicationId)) continue;
          delete next[plugin.id];
        }
        return next;
      });
    }).catch(loadError => {
      if (!controller.signal.aborted && mountedRef.current) setError(`读取 Profile 插件失败：${getErrorMessage(loadError)}`);
    }).finally(() => {
      if (!controller.signal.aborted && mountedRef.current) setLoading(false);
    });
    return () => controller.abort();
  }, [canManage, refreshSequence, user.id]);

  const visiblePlugins = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    if (!normalizedQuery) return plugins;
    return plugins.filter(plugin => [plugin.name, plugin.description, plugin.id, plugin.source.repository, pluginCompatibilityLabel(plugin)]
      .some(value => value.toLocaleLowerCase("zh-CN").includes(normalizedQuery)));
  }, [plugins, query]);
  const enabledCount = plugins.filter(plugin => plugin.state === "enabled").length;

  async function togglePlugin(plugin: ManagedPluginRecord): Promise<void> {
    if (!canManage || pendingPluginId || plugin.state === "incompatible") return;
    const targetApplicationId = targetApplications[plugin.id] ?? plugin.applicationIds[0] ?? "workspace";
    const enabled = plugin.state !== "enabled";
    setPendingPluginId(plugin.id);
    setError("");
    try {
      const result = await setManagedPluginEnabled(plugin.id, {
        enabled,
        targetApplicationId,
        expectedSourceCommit: plugin.source.commit
      });
      if (mountedRef.current) {
        setPlugins(current => current.map(item => item.id === result.plugin.id ? result.plugin : item));
      }
    } catch (actionError) {
      if (mountedRef.current) {
        setError(`插件${enabled ? "启用" : "停用"}失败：${getErrorMessage(actionError)}`);
        try {
          const latest = await loadManagedPlugins();
          if (mountedRef.current) {
            setProfile(latest.profile);
            setPlugins(latest.plugins);
          }
        } catch {
          // 保留原动作错误；状态回读失败时不声称插件已启用或已停用。
        }
      }
    } finally {
      if (mountedRef.current) setPendingPluginId(null);
    }
  }

  function openPluginManager(): void {
    onNavigate("/plugin-manager");
  }

  return (
    <section className="settings-content settings-profile-plugins">
      <header className="settings-content__heading">
        <div><span className="settings-eyebrow">集成</span><Typography.Title level={2}>插件</Typography.Title><Typography.Paragraph>查看当前 Profile 中已安装插件的真实状态，并按现有授权流程启用或停用。</Typography.Paragraph></div>
        <Space wrap>
          <Button onClick={() => setRefreshSequence(sequence => sequence + 1)} loading={loading} disabled={!canManage}>刷新</Button>
          <Button type="primary" onClick={openPluginManager}>插件管理</Button>
        </Space>
      </header>
      <div className="settings-profile-plugins__toolbar">
        <Input.Search aria-label="搜索插件" placeholder="搜索插件" allowClear value={query} onChange={event => setQuery(event.target.value)} />
        <span>{plugins.length} 项 · {enabledCount} 项已启用{profile ? ` · Profile ${profile}` : ""}</span>
      </div>
      {error ? <Alert className="settings-profile-plugins__error" type="error" showIcon message={error} /> : null}
      <SettingGroup title="已安装插件">
        {!canManage ? <div className="settings-profile-plugins__state"><WorkbenchIcon name="shield" size={20} /><strong>需要管理员权限</strong><span>当前账户无权读取或管理 Profile 插件。</span></div>
          : loading && plugins.length === 0 ? <div className="settings-profile-plugins__state" role="status"><span className="loading-indicator" /><span>正在读取 Profile 插件清单…</span></div>
            : plugins.length === 0 ? <div className="settings-profile-plugins__state"><WorkbenchIcon name="extension" size={20} /><strong>当前 Profile 尚未安装插件</strong><span>安装、详情和来源检查可在插件管理页面完成。</span><Button onClick={openPluginManager}>打开插件管理</Button></div>
              : visiblePlugins.length === 0 ? <div className="settings-profile-plugins__state"><span>没有符合当前搜索的插件。</span></div>
                : visiblePlugins.map(plugin => {
                  const selectedApplicationId = targetApplications[plugin.id] ?? plugin.applicationIds[0] ?? "workspace";
                  const applicationOptions = plugin.applicationIds.map(applicationId => ({
                    value: applicationId,
                    label: applications.find(application => application.applicationId === applicationId)?.title ?? applicationId
                  }));
                  const disabled = pendingPluginId !== null || plugin.state === "incompatible";
                  return <SettingRow key={plugin.id} title={plugin.name} description={
                    <span className="settings-profile-plugin-row__description">
                      <span className="settings-profile-plugin-row__icon"><WorkbenchIcon name="extension" size={18} /></span>
                      <span className="settings-profile-plugin-row__copy">
                        <span>{plugin.description || "此插件未提供说明。"}</span>
                        {plugin.reason ? <span className="settings-profile-plugin-row__reason">{plugin.reason}</span> : null}
                      </span>
                    </span>
                  } status={`v${plugin.version} · ${pluginStateLabel(plugin)} · ${pluginCompatibilityLabel(plugin)}`}>
                    <div className="settings-profile-plugin-row__controls">
                      {applicationOptions.length > 1 ? <Select aria-label={`${plugin.name} 生命周期目标 App`} value={selectedApplicationId} options={applicationOptions} disabled={!canManage || pendingPluginId !== null} onChange={applicationId => setTargetApplications(current => ({ ...current, [plugin.id]: applicationId }))} /> : null}
                      <SettingsSwitch label={`启用 ${plugin.name}`} checked={plugin.state === "enabled"} disabled={!canManage || disabled} onChange={() => void togglePlugin(plugin)} />
                    </div>
                  </SettingRow>;
                })}
      </SettingGroup>
    </section>
  );
}
