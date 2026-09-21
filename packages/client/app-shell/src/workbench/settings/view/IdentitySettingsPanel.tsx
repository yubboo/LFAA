/**
 * 文件：IdentitySettingsPanel.tsx
 * 作用：LFAA 设置中心的本地实例“用户、角色与权限”管理界面。
 * 负责：用户列表/禁用、创建用户、角色列表、自定义角色创建/删除与权限字符串展示。
 * 不负责：First Run、Login、Auth Cookie、Host 授权结论、密码散列。
 * 状态归属：新建用户/角色表单属于本 View；用户/角色长期真值由 Identity Host 持有。
 * 对外接口：IdentitySettingsPanel。
 * 关联文件：useIdentitySettingsController.ts、settings.types.ts、@lfaa/identity。
 * 修改注意事项：super_admin 的保护必须由 Host 再校验；前端 disabled 只是 UX，不是安全边界。
 */
import { useMemo, useState, type FormEvent } from "react";
import type { IdentitySettingsPanelProps } from "../contracts/settings.types";

const parsePermissions = (value: string) => [...new Set(value.split(/[\s,，]+/u).map((item) => item.trim()).filter(Boolean))];

export function IdentitySettingsPanel(props: IdentitySettingsPanelProps) {
  const [userForm, setUserForm] = useState({ username: "", displayName: "", password: "", roleId: "user" });
  const [roleForm, setRoleForm] = useState({ id: "", name: "", permissions: "" });
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  const assignableRoles = useMemo(() => props.snapshot.roles.filter((role) => role.id !== "super_admin"), [props.snapshot.roles]);

  const submitUser = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setLocalError("");
    try {
      await props.onCreateUser({ username: userForm.username, password: userForm.password, roleIds: [userForm.roleId], ...(userForm.displayName.trim() ? { displayName: userForm.displayName.trim() } : {}) });
      setUserForm({ username: "", displayName: "", password: "", roleId: "user" });
    } catch (reason) { setLocalError(reason instanceof Error ? reason.message : "创建用户失败。"); }
    finally { setBusy(false); }
  };
  const submitRole = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setLocalError("");
    try {
      await props.onCreateRole({ id: roleForm.id, name: roleForm.name, permissions: parsePermissions(roleForm.permissions) });
      setRoleForm({ id: "", name: "", permissions: "" });
    } catch (reason) { setLocalError(reason instanceof Error ? reason.message : "创建角色失败。"); }
    finally { setBusy(false); }
  };

  if (!props.hostAvailable) return <div className="lfaa-settings-empty"><strong>Identity Host 未连接</strong><p>不会伪造用户与权限状态。</p></div>;
  if (props.error && !props.snapshot.users.length) return <div className="lfaa-identity-error"><strong>无法读取用户与角色</strong><span>{props.error}</span></div>;

  return <div className="lfaa-identity-settings">
    {(props.error || localError) ? <div className="lfaa-identity-error"><strong>Identity 操作未完成</strong><span>{localError || props.error}</span></div> : null}
    <section className="lfaa-identity-section">
      <div className="lfaa-identity-heading"><div><h2>用户</h2><p>没有有效本地账号与 AuthSession，就不能进入 LFAA 或调用受保护 Host API。</p></div><span>{props.snapshot.users.length} 个</span></div>
      <div className="lfaa-identity-list">{props.snapshot.users.map((user) => {
        const isRoot = user.roleIds.includes("super_admin");
        const roleNames = user.roleIds.map((id) => props.snapshot.roles.find((role) => role.id === id)?.name ?? id);
        return <article className="lfaa-identity-user" key={user.id}><span className="lfaa-identity-avatar">{user.displayName.slice(0,1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>@{user.username} · {roleNames.join(" / ")}</small></div><span className={user.disabled?"is-disabled":"is-enabled"}>{user.disabled?"已禁用":"可登录"}</span>{isRoot?<span className="lfaa-identity-root-badge">Root</span>:<select aria-label={`修改 ${user.displayName} 的角色`} disabled={busy || !assignableRoles.length} value={user.roleIds[0] ?? "user"} onChange={(event)=>void props.onUpdateUser(user.id,{roleIds:[event.target.value]})}>{assignableRoles.map((role)=><option key={role.id} value={role.id}>{role.name}</option>)}</select>}<button type="button" disabled={busy || isRoot} onClick={() => void props.onUpdateUser(user.id, { disabled: !user.disabled })}>{user.disabled?"启用":"禁用"}</button></article>;
      })}</div>
      <form className="lfaa-identity-form" onSubmit={submitUser}><div className="lfaa-identity-form-title"><strong>创建用户</strong><small>super_admin 只能由 First Run 创建，普通创建接口不会授予 Root。</small></div><div className="lfaa-identity-form-grid"><label>用户名<input value={userForm.username} onChange={(event)=>setUserForm({...userForm,username:event.target.value})} required placeholder="operator" /></label><label>显示名称<input value={userForm.displayName} onChange={(event)=>setUserForm({...userForm,displayName:event.target.value})} placeholder="服务器运维" /></label><label>初始密码<input type="password" autoComplete="new-password" value={userForm.password} onChange={(event)=>setUserForm({...userForm,password:event.target.value})} minLength={12} required placeholder="至少 12 位" /></label><label>角色<select value={userForm.roleId} onChange={(event)=>setUserForm({...userForm,roleId:event.target.value})}>{assignableRoles.map((role)=><option key={role.id} value={role.id}>{role.name}</option>)}</select></label></div><button type="submit" disabled={busy || !assignableRoles.length}>创建用户</button></form>
    </section>
    <section className="lfaa-identity-section">
      <div className="lfaa-identity-heading"><div><h2>角色与权限</h2><p>Role 只是 Permission 集合。最终执行仍由 Host 结合 App Pack / Project / Capability Scope 再判定。</p></div><span>{props.snapshot.roles.length} 个</span></div>
      <div className="lfaa-role-list">{props.snapshot.roles.map((role)=><article key={role.id} className="lfaa-role-card"><div className="lfaa-role-title"><strong>{role.name}</strong><code>{role.id}</code>{role.system?<small>系统</small>:null}</div><p>{role.description || "自定义角色"}</p><div className="lfaa-role-permissions">{role.permissions.map((permission)=><span key={permission}>{permission}</span>)}</div>{!role.system?<button type="button" disabled={busy} onClick={() => { if (window.confirm(`删除角色“${role.name}”？`)) void props.onDeleteRole(role.id); }}>删除角色</button>:null}</article>)}</div>
      <form className="lfaa-identity-form" onSubmit={submitRole}><div className="lfaa-identity-form-title"><strong>创建自定义角色</strong><small>权限用逗号或空格分隔，例如 server.*、agent.run。</small></div><div className="lfaa-identity-form-grid"><label>角色 ID<input value={roleForm.id} onChange={(event)=>setRoleForm({...roleForm,id:event.target.value})} required placeholder="server_operator" /></label><label>显示名称<input value={roleForm.name} onChange={(event)=>setRoleForm({...roleForm,name:event.target.value})} required placeholder="服务器运维" /></label><label className="is-wide">权限<input value={roleForm.permissions} onChange={(event)=>setRoleForm({...roleForm,permissions:event.target.value})} required placeholder="server.* agent.run" /></label></div><button type="submit" disabled={busy}>创建角色</button></form>
    </section>
  </div>;
}
