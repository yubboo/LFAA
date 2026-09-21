/**
 * 文件：UserMenu.tsx
 * 作用：提供 LFAA 个人中心弹出菜单。
 * 负责：真实 Identity 摘要、应用中心、设置/更新/退出入口的视觉与点击契约。
 * 不负责：登录态真值、权限判断、更新执行、Settings 路由或背景模糊层。
 * 状态归属：无业务状态；所有身份事实与动作由上层注入。
 * 对外接口：UserMenu、UserMenuProps。
 * 关联文件：../styles/user-menu.css、WorkbenchOverlays.tsx、@lfaa/identity。
 * 修改注意事项：禁止重新写死用户名称/角色；退出登录必须由 Identity Host 真正销毁 AuthSession。
 */
import "../styles/user-menu.css";

export interface UserMenuProps {
  displayName: string;
  subtitle: string;
  onOpenSettings: () => void;
  onRequestUpdate: () => void;
  onOpenAppHub?: () => void;
  onLogout?: () => void;
}

export function UserMenu({ displayName, subtitle, onOpenSettings, onRequestUpdate, onOpenAppHub, onLogout }: UserMenuProps) {
  return (
    <section className="lfaa-user-menu" role="dialog" aria-label="个人中心">
      <header className="lfaa-user-menu__profile">
        <span className="lfaa-user-menu__avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>
        <span><strong>{displayName}</strong><small>{subtitle}</small></span>
      </header>
      <div className="lfaa-user-menu__divider" />
      {onOpenAppHub ? <button type="button" onClick={onOpenAppHub}><span>应用中心</span></button> : null}
      <button type="button" onClick={onOpenSettings}><span>设置</span><kbd>Ctrl+,</kbd></button>
      <button type="button" onClick={onRequestUpdate}><span>检查更新</span></button>
      {onLogout ? <><div className="lfaa-user-menu__divider" /><button type="button" onClick={onLogout}><span>退出登录</span></button></> : null}
    </section>
  );
}
