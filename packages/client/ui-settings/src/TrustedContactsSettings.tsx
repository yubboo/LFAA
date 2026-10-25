import { useEffect, useState } from "react";
import { Alert, Button, Input, Popconfirm, Space, Tag, Typography, message } from "antd";
import { SettingGroup, SettingRow } from "lfaa-client-ui-primitives/src/settings-controls.js";
import { acceptTrustedContactInvitation, approveTrustedRecoveryRequest, createTrustedContactInvitation, loadTrustedContactSettings, removeTrustedContact, type TrustedContactSettings } from "lfaa-client-connection/src/api.js";

export function TrustedContactsSettings(): JSX.Element {
  const [state, setState] = useState<TrustedContactSettings>({ contacts: [], trustedBy: [], recoveryRequests: [] });
  const [code, setCode] = useState("");
  const [newInvite, setNewInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => setState(await loadTrustedContactSettings());
  useEffect(() => { void refresh().catch(error => message.error(error instanceof Error ? error.message : "读取受信联系人失败。")); }, []);

  const createInvite = async () => {
    setBusy(true);
    try { setNewInvite(await createTrustedContactInvitation()); await refresh(); message.success("一次性邀请已生成，请通过你选择的安全渠道交给对方。 "); }
    catch (error) { message.error(error instanceof Error ? error.message : "生成邀请失败。 "); }
    finally { setBusy(false); }
  };
  const acceptInvite = async () => {
    const value = code.trim();
    if (!value) return;
    setBusy(true);
    try { const result = await acceptTrustedContactInvitation(value); setCode(""); setNewInvite(null); await refresh(); message.success(`已确认与 ${result.contact.username} 的恢复委托。`); }
    catch (error) { message.error(error instanceof Error ? error.message : "邀请无效或已过期。 "); }
    finally { setBusy(false); }
  };
  const removeContact = async (id: string) => {
    setBusy(true);
    try { await removeTrustedContact(id); await refresh(); message.success("受信关系已撤销，未完成的恢复请求也已失效。 "); }
    catch (error) { message.error(error instanceof Error ? error.message : "撤销受信关系失败。 "); }
    finally { setBusy(false); }
  };
  const approve = async (id: string) => {
    setBusy(true);
    try { await approveTrustedRecoveryRequest(id); await refresh(); message.success("已批准该账户的密码恢复请求；恢复码仍由申请人持有。 "); }
    catch (error) { message.error(error instanceof Error ? error.message : "批准恢复请求失败。 "); }
    finally { setBusy(false); }
  };

  return <section className="settings-content settings-content--trusted-contacts" role="tabpanel" tabIndex={0}>
    <header className="settings-content__heading"><div><span className="settings-eyebrow">个人资料</span><Typography.Title level={2}>受信任联系人</Typography.Title><Typography.Paragraph>在同一 LFAA 本机的两个已登录账户间建立密码恢复委托。联系人不会获得对方的设置、会话或文件访问权。</Typography.Paragraph></div></header>
    <Alert type="warning" showIcon message="只邀请你信任的人" description="邀请需要由另一账户登录后手动接受。恢复申请由联系人独立批准，申请人还必须持有自己收到的恢复码和新密码。所有邀请码、恢复码和密码都只在页面中处理，Agent 不接收这些秘密。" />
    <SettingGroup title="邀请与接受">
      <SettingRow title="生成一次性邀请" description="邀请 24 小时内有效，创建后只显示一次；请通过你选择的安全渠道转交。">
        <Button type="primary" loading={busy} onClick={() => void createInvite()}>生成邀请</Button>
      </SettingRow>
      {newInvite ? <SettingRow title="邀请码" description={`有效期至 ${new Date(newInvite.expiresAt).toLocaleString("zh-CN")}。关闭或离开此页后不会再次显示。`}>
        <Space direction="vertical" align="end"><Typography.Text copyable={{ text: newInvite.code }} code>{newInvite.code}</Typography.Text><Tag color="orange">仅显示一次</Tag></Space>
      </SettingRow> : null}
      <SettingRow title="接受邀请" description="在被邀请的本机账户中粘贴一次性代码，确认后该账户成为邀请方的恢复联系人。">
        <Space.Compact className="settings-trusted-contact-accept"><Input value={code} autoComplete="off" maxLength={64} placeholder="粘贴邀请码" onChange={event => setCode(event.target.value)} /><Button loading={busy} disabled={!code.trim()} onClick={() => void acceptInvite()}>接受邀请</Button></Space.Compact>
      </SettingRow>
    </SettingGroup>
    <SettingGroup title={`我信任的联系人 · ${state.contacts.length}`}>
      {state.contacts.length ? state.contacts.map(contact => <SettingRow key={contact.id} title={contact.username} description={`已于 ${new Date(contact.createdAt).toLocaleString("zh-CN")} 建立恢复委托。`} status={contact.role}>
        <Popconfirm title={`撤销与 ${contact.username} 的受信关系？`} description="双方未完成的恢复请求会一并失效。" okText="撤销关系" cancelText="取消" onConfirm={() => void removeContact(contact.id)}><Button danger loading={busy}>撤销</Button></Popconfirm>
      </SettingRow>) : <div className="settings-snapshot-empty">尚未添加受信联系人。</div>}
    </SettingGroup>
    <SettingGroup title={`信任我的账户 · ${state.trustedBy.length}`}>
      {state.trustedBy.length ? state.trustedBy.map(contact => <SettingRow key={contact.id} title={contact.username} description={`已于 ${new Date(contact.createdAt).toLocaleString("zh-CN")} 授权你协助恢复。撤销操作会同时取消这条关系。`} status={contact.role}>
        <Popconfirm title={`撤销 ${contact.username} 对你的恢复委托？`} description="这会移除双方关系并取消未完成请求。" okText="撤销关系" cancelText="取消" onConfirm={() => void removeContact(contact.id)}><Button danger loading={busy}>撤销</Button></Popconfirm>
      </SettingRow>) : <div className="settings-snapshot-empty">没有其他账户将你设为受信联系人。</div>}
    </SettingGroup>
    <SettingGroup title={`待处理的恢复申请 · ${state.recoveryRequests.length}`}>
      {state.recoveryRequests.length ? state.recoveryRequests.map(request => <SettingRow key={request.id} title={`${request.requesterUsername} 请求恢复账户密码`} description={`申请时间 ${new Date(request.createdAt).toLocaleString("zh-CN")} · 到期 ${new Date(request.expiresAt).toLocaleString("zh-CN")}`} status={request.approvedAt ? "已批准" : "待你确认"}>
        {request.approvedAt ? <Tag color="green">已批准</Tag> : <Popconfirm title={`批准 ${request.requesterUsername} 重置密码？`} description="只批准你确认身份的请求。申请人还需要自己持有的恢复码才能完成重置。" okText="批准请求" cancelText="取消" onConfirm={() => void approve(request.id)}><Button type="primary" loading={busy}>批准恢复</Button></Popconfirm>}
      </SettingRow>) : <div className="settings-snapshot-empty">当前没有待处理的恢复申请。</div>}
    </SettingGroup>
  </section>;
}
