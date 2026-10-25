/** 功能：提供 lfaa-client-ui-primitives 的现有界面能力。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { type ReactNode, useState } from "react";
import { Button } from "antd";
export function SettingGroup({ title, children }: { title: string; children: ReactNode }) {
  return <section className="settings-group"><h3>{title}</h3><div className="settings-group__rows">{children}</div></section>;
}

export function AdvancedGroup({ children }: { children: ReactNode }) {
  return <div className="settings-advanced__group"><div className="settings-group__rows">{children}</div></div>;
}

export function SettingRow({ title, description, status, children, id }: { title: string; description: ReactNode; status?: string; children: ReactNode; id?: string }) {
  return <div id={id} className="settings-row"><div className="settings-row__copy"><strong>{title}</strong><span>{description}</span></div><div className="settings-row__control">{children}{status ? <small className="settings-row__status">{status}</small> : null}</div></div>;
}

export function SettingsSwitch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  const [motionKey, setMotionKey] = useState(0);
  const handleClick = () => {
    if (disabled) return;
    setMotionKey(current => current === 1 ? 2 : 1);
    onChange();
  };

  return <button type="button" className={"settings-switch" + (checked ? " is-on" : "") + (disabled ? " is-disabled" : "")} role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={handleClick}>
    <i><span key={motionKey} className={"settings-switch__thumb" + (motionKey > 0 ? " is-jelly" : "")} /></i>
  </button>;
}

export function SettingsActions({ saving, onReset, onSave }: { saving: boolean; onReset: () => void; onSave: () => void }) {
  return <div className="settings-actions"><small className="settings-actions__hint">更改会自动保存</small><Button onClick={onReset} disabled={saving}>恢复默认</Button><Button type="primary" loading={saving} onClick={onSave}>立即保存</Button></div>;
}
