/**
 * 文件：UserMenu.tsx
 * 作用：提供 LFAA 个人中心弹出菜单。
 * 负责：账户摘要、设置/更新/关于入口的视觉与点击契约。
 * 不负责：登录态、套餐用量、更新执行、Settings 路由或背景模糊层。
 * 状态归属：无业务状态；所有动作由宿主回调提供。
 * 对外接口：UserMenu、UserMenuProps。
 * 关联文件：../styles/user-menu.css、WorkbenchOverlays.tsx。
 * 修改注意事项：禁止伪造套餐/用量/登录状态；真实账户事实必须由 Account/Auth 域注入。
 */
import "../styles/user-menu.css";

export interface UserMenuProps {
  displayName: string;
  subtitle: string;
  onOpenSettings: () => void;
  onRequestUpdate: () => void;
}

export function UserMenu({ displayName, subtitle, onOpenSettings, onRequestUpdate }: UserMenuProps) {
  return (
    <section className="lfaa-user-menu" role="dialog" aria-label="个人中心">
      <header className="lfaa-user-menu__profile">
        <span className="lfaa-user-menu__avatar" aria-hidden="true">{displayName.slice(0, 1)}</span>
        <span><strong>{displayName}</strong><small>{subtitle}</small></span>
      </header>
      <div className="lfaa-user-menu__divider" />
      <button type="button" onClick={onOpenSettings}><span>设置</span><kbd>Ctrl+,</kbd></button>
      <button type="button" onClick={onRequestUpdate}><span>检查更新</span></button>
    </section>
  );
}
