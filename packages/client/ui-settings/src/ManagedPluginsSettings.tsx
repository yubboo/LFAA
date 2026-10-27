/** 功能：呈现设置中心的 Profile 插件开关。作用：读取并调用现有插件生命周期 Owner，不复制安装或运行规则。关联文件：PluginManagerPage、client/connection、SettingsPage。 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Input, Select, Space, Typography } from "antd";
import { getErrorMessage, hasAdminAccess, loadAiSkillDirectory, loadManagedPlugins, setManagedPluginEnabled, type AiSkillDirectoryEntry, type ApplicationId, type ManagedPluginRecord, type User, type UserSettings } from "lfaa-client-connection/src/api.js";
import { SettingGroup, SettingRow, SettingsSwitch } from "lfaa-client-ui-primitives/src/settings-controls.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import type { ApplicationNavigationId } from "lfaa-util-values/src/application-id.js";
import type { ApplicationNavigationItem } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";
import { McpConnectionsSettings } from "./McpConnectionsSettings.js";
import { GitHubConnectionSettings } from "./GitHubConnectionSettings.js";

type IntegrationCategory = "plugins" | "applications" | "mcp" | "skills" | "market";

const integrationCategories: Array<{ id: IntegrationCategory; label: string }> = [
  { id: "plugins", label: "插件" },
  { id: "applications", label: "应用" },
  { id: "mcp", label: "MCP" },
  { id: "skills", label: "技能" },
  { id: "market", label: "市场" }
];

function pluginStateLabel(plugin: ManagedPluginRecord): string {
  if (plugin.state === "enabled") return "已启用";
  if (plugin.state === "incompatible") return "当前不兼容";
  return "已安装，未启用";
}

function pluginCompatibilityLabel(plugin: ManagedPluginRecord): string {
  return plugin.compatibility === "lfaa-v1" ? "LFAA Runtime" : plugin.compatibility === "dsh-v1" ? "DSH Bundle" : "未知合同";
}

function skillOriginLabel(skill: AiSkillDirectoryEntry): string {
  if (skill.origin === "account-installed") return "小鱼安装的本机用户 Skill · .lfaa\\skills\\<Skill 名称>\\SKILL.md";
  if (skill.origin === "bundled") return "LFAA 内置 · 随软件提供，无需安装";
  if (skill.origin === "user-lfaa") return "本机 LFAA Skill · .lfaa\\skills";
  if (skill.origin === "user-agents") return "本机共享 Agent Skill · .agents\\skills";
  if (skill.origin === "project-lfaa") return "当前项目 Skill · .lfaa\\skills";
  if (skill.origin === "project-agents") return "当前项目 Skill · .agents\\skills";
  if (skill.origin === "custom") return "设置中的自定义目录";
  return `Skill Registry · ${skill.origin}`;
}

export function ManagedPluginsSettings({ user, applications, settings, onPluginSettingsChange, onGeneralSettingsChange, onNavigate }: {
  user: User;
  applications: ApplicationNavigationItem[];
  settings: UserSettings;
  onPluginSettingsChange: (plugins: UserSettings["plugins"]) => void;
  onGeneralSettingsChange: (general: UserSettings["general"]) => void;
  onNavigate: (path: string) => void;
}) {
  const canManage = hasAdminAccess(user.role);
  const [plugins, setPlugins] = useState<ManagedPluginRecord[]>([]);
  const [skills, setSkills] = useState<AiSkillDirectoryEntry[]>([]);
  const [profile, setProfile] = useState("");
  const [loading, setLoading] = useState(canManage);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [pendingPluginId, setPendingPluginId] = useState<string | null>(null);
  const [targetApplications, setTargetApplications] = useState<Record<string, ApplicationId>>({});
  const [refreshSequence, setRefreshSequence] = useState(0);
  const [activeCategory, setActiveCategory] = useState<IntegrationCategory>("plugins");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (activeCategory !== "plugins") return;
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
  }, [activeCategory, canManage, refreshSequence, user.id]);

  useEffect(() => {
    const controller = new AbortController();
    setSkills([]);
    setSkillsLoading(true);
    setError("");
    void loadAiSkillDirectory(controller.signal).then(result => {
      if (!mountedRef.current || controller.signal.aborted) return;
      setSkills(result.skills);
    }).catch(loadError => {
      if (!controller.signal.aborted && mountedRef.current) setError(`读取 Skill 目录失败：${getErrorMessage(loadError)}`);
    }).finally(() => {
      if (!controller.signal.aborted && mountedRef.current) setSkillsLoading(false);
    });
    return () => controller.abort();
  }, [refreshSequence, user.id]);

  const visiblePlugins = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    if (!normalizedQuery) return plugins;
    return plugins.filter(plugin => [plugin.name, plugin.description, plugin.id, plugin.source.repository, pluginCompatibilityLabel(plugin)]
      .some(value => value.toLocaleLowerCase("zh-CN").includes(normalizedQuery)));
  }, [plugins, query]);
  const visibleSkills = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    if (!normalizedQuery) return skills;
    return skills.filter(skill => [skill.name, skill.description, skill.origin, skill.source]
      .some(value => value.toLocaleLowerCase("zh-CN").includes(normalizedQuery)));
  }, [skills, query]);
  const visibleApplications = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    if (!normalizedQuery) return applications;
    return applications.filter(application => [application.title, application.description ?? ""]
      .some(value => value.toLocaleLowerCase("zh-CN").includes(normalizedQuery)));
  }, [applications, query]);
  const enabledCount = plugins.filter(plugin => plugin.state === "enabled").length;
  const enabledSkillCount = skills.filter(skill => skill.enabled && !settings.plugins.disabledSkillNames.includes(skill.name)).length;
  const enabledApplicationCount = applications.filter(application => !(settings.general.hiddenApplicationNavigationIds ?? []).includes(application.id)).length;

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

  function toggleSkill(skillId: string): void {
    const disabled = new Set(settings.plugins.disabledSkillNames);
    if (disabled.has(skillId)) disabled.delete(skillId); else disabled.add(skillId);
    onPluginSettingsChange({ ...settings.plugins, disabledSkillNames: [...disabled] });
  }

  function toggleApplicationNavigation(applicationId: ApplicationNavigationId): void {
    const hidden = new Set(settings.general.hiddenApplicationNavigationIds ?? []);
    if (hidden.has(applicationId)) hidden.delete(applicationId); else hidden.add(applicationId);
    onGeneralSettingsChange({ ...settings.general, hiddenApplicationNavigationIds: [...hidden] });
  }

  const categoryTitle = integrationCategories.find(category => category.id === activeCategory)?.label ?? "插件";
  const categoryDescription: Record<IntegrationCategory, string> = {
    plugins: "查看当前 Profile 中已安装插件的真实状态，并按现有授权流程启用或停用。",
    applications: "管理 LFAA 内置应用入口和 GitHub 外部账户连接。",
    mcp: "查看账户已配置的 MCP 服务，并沿用当前设置和权限规则。",
    skills: "显示 Skill Registry 当前登记的真实技能。内置技能随软件提供；小鱼安装的技能位于本机 LFAA Home/skills/<技能名>/；单项开关沿用账户设置。",
    market: "LFAA 当前没有可浏览的公共集成目录。"
  };
  const categoryCounts: Record<IntegrationCategory, number | string> = {
    plugins: plugins.length,
    applications: applications.length,
    mcp: settings.plugins.mcpServers.length,
    skills: skillsLoading && skills.length === 0 ? "…" : skills.length,
    market: 0
  };
  const categoryCountSummary: Record<IntegrationCategory, string> = {
    plugins: `${plugins.length} 项 · ${enabledCount} 项已启用${profile ? ` · Profile ${profile}` : ""}`,
    applications: `${enabledApplicationCount} 项显示 · ${applications.length} 项内置应用`,
    mcp: `${settings.plugins.mcpServers.length} 项 · ${settings.plugins.mcpServers.filter(server => server.enabled).length} 项已启用`,
    skills: skillsLoading && skills.length === 0 ? "正在同步技能目录…" : `${skills.length} 项 · ${enabledSkillCount} 项单项开启${settings.plugins.enabled ? "" : " · Agent 扩展总开关已关闭"}`,
    market: "暂无目录条目"
  };
  const searchLabel = activeCategory === "mcp" ? "搜索 MCP 服务" : activeCategory === "skills" ? "搜索技能" : activeCategory === "applications" ? "搜索应用" : "搜索插件";
  const searchPlaceholder = activeCategory === "mcp" ? "搜索 MCP 服务" : activeCategory === "skills" ? "搜索技能" : activeCategory === "applications" ? "搜索应用" : "搜索插件";

  return (
    <section className="settings-content settings-profile-plugins">
      <header className="settings-content__heading">
        <div><span className="settings-eyebrow">集成</span><Typography.Title level={2}>{categoryTitle}</Typography.Title><Typography.Paragraph>{categoryDescription[activeCategory]}</Typography.Paragraph></div>
        {activeCategory === "plugins" ? <Space className="settings-profile-plugins__actions" wrap>
          <Button onClick={() => setRefreshSequence(sequence => sequence + 1)} loading={loading} disabled={!canManage}>刷新</Button>
          <Button type="primary" onClick={openPluginManager}>插件管理</Button>
        </Space> : null}
      </header>
      <div className="settings-profile-plugins__toolbar">
        <nav className="settings-profile-plugins__categories" role="tablist" aria-label="集成分类" onKeyDown={event => {
          const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]"));
          const currentIndex = tabs.indexOf(event.target as HTMLButtonElement);
          const nextIndex = event.key === "ArrowRight" ? (currentIndex + 1) % tabs.length
            : event.key === "ArrowLeft" ? (currentIndex - 1 + tabs.length) % tabs.length
              : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
          if (currentIndex >= 0 && nextIndex >= 0) {
            event.preventDefault();
            tabs[nextIndex]?.focus();
            tabs[nextIndex]?.click();
          }
        }}>
          {integrationCategories.map(category => <button
            key={category.id}
            id={`settings-integration-tab-${category.id}`}
            type="button"
            role="tab"
            tabIndex={activeCategory === category.id ? 0 : -1}
            className={`settings-profile-plugins__category${activeCategory === category.id ? " is-active" : ""}`}
            aria-selected={activeCategory === category.id}
            aria-controls="settings-integration-panel"
            onClick={() => setActiveCategory(category.id)}
          >{category.label}<span className="settings-profile-plugins__category-count">{categoryCounts[category.id]}</span></button>)}
        </nav>
        <span className="settings-profile-plugins__count">{categoryCountSummary[activeCategory]}</span>
        {activeCategory === "plugins" || activeCategory === "applications" || activeCategory === "mcp" || activeCategory === "skills" ? <Input.Search aria-label={searchLabel} placeholder={searchPlaceholder} allowClear value={query} onChange={event => setQuery(event.target.value)} /> : null}
      </div>
      <div id="settings-integration-panel" role="tabpanel" aria-labelledby={`settings-integration-tab-${activeCategory}`} tabIndex={0}>
        {error ? <Alert className="settings-profile-plugins__error" type="error" showIcon message={error} /> : null}
        {activeCategory === "plugins" ? <>
          <SettingGroup title="Agent 扩展">
            <SettingRow title="允许 Agent 使用账户扩展" description="控制用户 Skills、提示词、Tools 和 MCP 服务是否加入模型运行时；不会改变 Profile 插件清单。" status={settings.plugins.enabled ? "已开启" : "已关闭"}>
              <SettingsSwitch label="启用账户扩展" checked={settings.plugins.enabled} onChange={() => onPluginSettingsChange({ ...settings.plugins, enabled: !settings.plugins.enabled })} />
            </SettingRow>
          </SettingGroup>
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
        </> : null}
        {activeCategory === "applications" ? <>
          <SettingGroup title="LFAA 内置应用入口">
            {visibleApplications.length === 0 ? <div className="settings-profile-plugins__state" role="status"><span>没有符合当前搜索的应用。</span></div>
              : visibleApplications.map(application => {
                const enabled = !(settings.general.hiddenApplicationNavigationIds ?? []).includes(application.id);
                return <SettingRow key={application.id} title={application.title} description={
                  <span className="settings-profile-plugin-row__description">
                    <span className="settings-profile-plugin-row__icon"><WorkbenchIcon name="grid" size={18} /></span>
                    <span className="settings-profile-plugin-row__copy"><span>{application.description || "LFAA 内置工作区入口。"}</span></span>
                  </span>
                } status={enabled ? "应用菜单中显示" : "应用菜单中隐藏"}>
                  <SettingsSwitch label={`显示应用 ${application.title}`} checked={enabled} onChange={() => toggleApplicationNavigation(application.id)} />
                </SettingRow>;
              })}
          </SettingGroup>
          <GitHubConnectionSettings searchQuery={query} />
        </> : null}
        {activeCategory === "mcp" ? <McpConnectionsSettings settings={settings} onChange={onPluginSettingsChange} searchQuery={query} /> : null}
        {activeCategory === "skills" ? <SettingGroup title="Skill Registry">
          <Alert
            type="info"
            showIcon
            message="内置 Skill 和本机 Skill 的位置"
            description={<>LFAA 内置 Skill 来自软件包，无需安装；小鱼安装的 GitHub Skill 与手动放置的本机 Skill 都放在当前 LFAA Home 的 <code>skills/&lt;技能名&gt;/SKILL.md</code>，可由本机项目与 App 发现。项目 Skill 使用项目内 <code>.lfaa/skills</code> 或 <code>.agents/skills</code>。Codex 的 <code>.codex/skills</code> 与 LFAA 相互独立。</>}
          />
          {skillsLoading && skills.length === 0 ? <div className="settings-profile-plugins__state" role="status"><span className="loading-indicator" /><span>正在读取已登记的 Skill 能力…</span></div>
            : skills.length === 0 ? <div className="settings-profile-plugins__state" role="status"><WorkbenchIcon name="book" size={20} /><strong>当前没有登记技能</strong><span>内置与当前运行环境中可发现的 Skill 会显示在这里。</span></div>
              : visibleSkills.length === 0 ? <div className="settings-profile-plugins__state" role="status">没有符合当前搜索的技能。</div>
                : visibleSkills.map(skill => {
                  const enabled = !settings.plugins.disabledSkillNames.includes(skill.name);
                  return <SettingRow key={skill.id} title={skill.name} description={
                    <span className="settings-profile-plugin-row__description">
                      <span className="settings-profile-plugin-row__icon"><WorkbenchIcon name="book" size={18} /></span>
                      <span className="settings-profile-plugin-row__copy"><span>{skill.description || "此技能未提供说明。"}</span><span className="settings-profile-plugin-row__reason">{skillOriginLabel(skill)}</span></span>
                    </span>
                  } status={settings.plugins.enabled || skill.origin === "bundled" ? (enabled ? "当前可用" : "单项已停用") : "Agent 扩展总开关已关闭"}>
                    <SettingsSwitch label={`启用技能 ${skill.name}`} checked={enabled} onChange={() => toggleSkill(skill.name)} />
                  </SettingRow>;
                })}
        </SettingGroup> : null}
        {activeCategory === "market" ? <section className="settings-profile-plugins__market" aria-labelledby="settings-integrations-market-title">
          <WorkbenchIcon name="extension" size={22} />
          <strong id="settings-integrations-market-title">市场暂未接入</strong>
          <span>LFAA 当前没有可浏览的公共市场目录。</span>
        </section> : null}
      </div>
    </section>
  );
}
