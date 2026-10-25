/** 管理员编辑普通成员的 Agent 使用策略；成员账户只读本账户策略和用量。 */
import { useEffect, useState } from "react";
import { Alert, Button, Input, InputNumber, Select, Spin, Tag, message } from "antd";
import { getErrorMessage, hasAdminAccess, loadAgentUsageControls, saveAgentUsagePolicy, type AccountAgentUsageControls, type AccountAgentUsagePolicy, type ManagedAgentUsageAccount, type User } from "lfaa-client-connection/src/api.js";
import { SettingGroup, SettingRow, SettingsSwitch } from "lfaa-client-ui-primitives/src/settings-controls.js";

const weekdayLabels = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

function copyPolicy(policy: AccountAgentUsagePolicy): AccountAgentUsagePolicy {
  return { ...policy, weeklyWindows: policy.weeklyWindows.map(window => ({ ...window })) };
}

export function AccountAgentUsageSettings({ user }: { user: User }) {
  const isAdmin = hasAdminAccess(user.role);
  const [controls, setControls] = useState<AccountAgentUsageControls | null>(null);
  const [accounts, setAccounts] = useState<ManagedAgentUsageAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [draft, setDraft] = useState<AccountAgentUsagePolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void loadAgentUsageControls().then(result => {
      if (!active) return;
      setAccounts(result.manageableAccounts);
      if (isAdmin && result.manageableAccounts.length) setSelectedAccountId(current => current || result.manageableAccounts[0]!.id);
      if (!isAdmin) {
        setControls(result.controls);
        setDraft(copyPolicy(result.controls.policy));
      }
    }).catch(reason => { if (active) setError(getErrorMessage(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !selectedAccountId) return;
    let active = true;
    setLoading(true);
    setError("");
    void loadAgentUsageControls(selectedAccountId).then(result => {
      if (!active) return;
      setControls(result.controls);
      setDraft(copyPolicy(result.controls.policy));
    }).catch(reason => { if (active) setError(getErrorMessage(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAdmin, selectedAccountId]);

  const updateWindow = (index: number, value: Partial<AccountAgentUsagePolicy["weeklyWindows"][number]>): void => {
    setDraft(current => current ? { ...current, weeklyWindows: current.weeklyWindows.map((window, row) => row === index ? { ...window, ...value } : window) } : current);
  };

  const save = async (): Promise<void> => {
    if (!draft || !selectedAccountId) return;
    setSaving(true);
    setError("");
    try {
      const result = await saveAgentUsagePolicy(selectedAccountId, draft);
      setControls(result.controls);
      setDraft(copyPolicy(result.controls.policy));
      message.success("家长控制已保存并从账户 Owner 回读确认。");
    } catch (reason) { setError(getErrorMessage(reason)); }
    finally { setSaving(false); }
  };

  const title = <header className="settings-content__heading"><div><span className="settings-eyebrow">个人</span><h2>家长控制</h2><p>管理员可为普通成员账户设置 Agent 每周可用时段和每日使用上限；执行中到达任一上限后，本轮会被停止。</p></div></header>;
  if (loading && !controls) return <section className="settings-content">{title}<div role="status"><Spin /> 正在读取账户使用策略…</div></section>;

  return <section className="settings-content settings-content--parental">
    {title}
    {error ? <Alert type="error" showIcon message="家长控制读取或保存失败" description={error} /> : null}
    {isAdmin ? <SettingGroup title="管理普通成员">
      {accounts.length ? <SettingRow title="成员账户" description="仅管理普通成员；管理员与超级管理员账户不会显示在列表中。" status={selectedAccountId ? controls?.account.username ?? "载入中" : "请选择账户"}>
        <Select aria-label="选择家长控制成员账户" value={selectedAccountId || undefined} placeholder="选择成员账户" options={accounts.map(account => ({ value: account.id, label: account.username }))} onChange={setSelectedAccountId} />
      </SettingRow> : <SettingRow title="没有可管理的普通成员" description="创建普通成员账户后，可在此设置其 Agent 使用限制。" status="暂无成员"><Tag>空</Tag></SettingRow>}
    </SettingGroup> : <SettingGroup title="当前账户状态">
      <SettingRow title="管理权限" description="使用时段与每日额度由 LFAA 管理员设置。" status="只读"><Tag>普通成员</Tag></SettingRow>
    </SettingGroup>}

    {controls && draft ? <>
      <SettingGroup title="使用时段与每日额度">
        <SettingRow title="启用家长控制" description="启用后，小鱼 Agent 只可在以下时段运行，并受每日累计时长限制。停止时会保留已生成的部分回复。" status={draft.enabled ? "限制已启用" : "限制未启用"}>
          {isAdmin ? <SettingsSwitch label="启用 Agent 使用限制" checked={draft.enabled} onChange={() => setDraft(current => current ? { ...current, enabled: !current.enabled } : current)} /> : <Tag>{draft.enabled ? "已启用" : "未启用"}</Tag>}
        </SettingRow>
        <SettingRow title="时区" description="时段按此 IANA 时区解释，例如 Asia/Shanghai 或 America/Los_Angeles。" status={draft.timezone}>
          {isAdmin ? <Input aria-label="家长控制时区" value={draft.timezone} maxLength={80} onChange={event => setDraft(current => current ? { ...current, timezone: event.target.value } : current)} /> : <Tag>{draft.timezone}</Tag>}
        </SettingRow>
        <SettingRow title="每日 Agent 时长" description={`已用 ${Math.floor((controls.usedSeconds % 3600) / 60)} 分钟 ${controls.usedSeconds % 60} 秒；按 ${controls.localDate} 的本地自然日统计。`} status={`${draft.dailyLimitMinutes} 分钟 / 日`}>
          {isAdmin ? <InputNumber aria-label="每日 Agent 使用时长上限（分钟）" min={1} max={1440} value={draft.dailyLimitMinutes} addonAfter="分钟" onChange={value => { if (value !== null) setDraft(current => current ? { ...current, dailyLimitMinutes: value } : current); }} /> : <Tag>{draft.dailyLimitMinutes} 分钟 / 日</Tag>}
        </SettingRow>
        {draft.weeklyWindows.map((window, index) => <SettingRow key={weekdayLabels[index]} title={weekdayLabels[index]!} description={window.enabled ? `${window.start} 至 ${window.end}${window.start > window.end ? "（跨午夜）" : ""}` : "当天不允许启动 Agent"} status={window.enabled ? "允许使用" : "关闭"}>
          <div className="settings-parental__window-controls">
            {isAdmin ? <>
              <SettingsSwitch label={`${weekdayLabels[index]}允许使用`} checked={window.enabled} onChange={() => updateWindow(index, { enabled: !window.enabled })} />
              <Input aria-label={`${weekdayLabels[index]}开始时间`} type="time" value={window.start} disabled={!window.enabled} onChange={event => updateWindow(index, { start: event.target.value })} />
              <span aria-hidden="true">至</span>
              <Input aria-label={`${weekdayLabels[index]}结束时间`} type="time" value={window.end} disabled={!window.enabled} onChange={event => updateWindow(index, { end: event.target.value })} />
            </> : <Tag>{window.enabled ? `${window.start} 至 ${window.end}` : "关闭"}</Tag>}
          </div>
        </SettingRow>)}
        {isAdmin ? <SettingRow title="保存限制" description="保存后立即用于新的 Agent 运行；正在运行的 Agent 会在当前时段或每日额度结束时停止。" status={controls.updatedAt ? `更新于 ${new Date(controls.updatedAt).toLocaleString("zh-CN")}` : "尚未设置"}>
          <Button type="primary" loading={saving} onClick={() => void save()}>保存家长控制</Button>
        </SettingRow> : null}
      </SettingGroup>
      {controls.activeReservations ? <Alert type="info" showIcon message={`${controls.activeReservations} 个 Agent 运行正在占用今日预留时长。`} /> : null}
    </> : null}
    {isAdmin && !accounts.length ? null : !isAdmin ? <div className="settings-note-card"><strong>策略说明</strong><p>成员账户无法自行关闭或放宽限制；Agent 每轮开始前检查当前策略，并由账户 Owner 记录实际运行时长。</p></div> : null}
  </section>;
}
