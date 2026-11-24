// 设置中心通用结构：页外壳、无边框分组、左名称右控件的设置行、上下排表单字段、开关、分段选择与危险操作组。
import type { ReactNode } from "react";
import surface from "./SettingsSurface.module.css";
import controls from "./SettingsControls.module.css";

/** 设置页外壳：统一标题层级、内容宽度与分组之间的留白。 */
export function SettingsPage({
  title,
  description,
  label,
  actions,
  size = "default",
  children,
}: {
  title: string;
  description?: ReactNode;
  /** 无障碍标签；默认与标题一致。 */
  label?: string;
  /** 页级动作按钮，排在标题右侧。 */
  actions?: ReactNode;
  /** 内容宽度：默认行式页用 default，卡片网格类页面用 wide。 */
  size?: "default" | "wide";
  children: ReactNode;
}) {
  const rootClass = size === "wide" ? `${surface.root} ${surface.rootWide}` : surface.root;
  return (
    <section className={rootClass} aria-label={label ?? title}>
      <header className={surface.pageHeader}>
        <div className={surface.pageHeaderText}>
          <h1 className={surface.pageTitle}>{title}</h1>
          {description && <p className={surface.pageDesc}>{description}</p>}
        </div>
        {actions && <div className={surface.pageActions}>{actions}</div>}
      </header>
      {children}
    </section>
  );
}

/** 一组相关设置：标题 + 可选说明 + 条目列表；组本身不画框，不做卡片。 */
export function SettingGroup({
  title,
  description,
  children,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={surface.groupSection} aria-label={title}>
      {title && <h2 className={surface.groupTitle}>{title}</h2>}
      {description && <p className={surface.groupDesc}>{description}</p>}
      <div className={surface.groupList}>{children}</div>
    </section>
  );
}

/** 一行一项设置：名称与说明在左，控件在右。 */
export function SettingRow({
  title,
  description,
  control,
}: {
  title: string;
  /** 说明可省略：纯数值行不需要重复标题。 */
  description?: ReactNode;
  control: ReactNode;
}) {
  return (
    <div className={surface.row}>
      <div className={surface.rowText}>
        <div className={surface.rowTitle}>{title}</div>
        {description ? <div className={surface.rowDesc}>{description}</div> : null}
      </div>
      <div className={surface.rowControl}>{control}</div>
    </div>
  );
}

/** 顺序填写的表单字段：标签在上、控件在下，占满可用宽度。 */
export function SettingFormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className={controls.formField}>
      <span className={controls.formLabel}>{label}</span>
      {children}
      {hint && <span className={controls.formHint}>{hint}</span>}
    </label>
  );
}

/** 表单里的只读块：标题 + 内容，不绑定可编辑控件（如系统规则正文）。 */
export function SettingFormBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={controls.formField}>
      <span className={controls.formLabel}>{label}</span>
      {children}
    </div>
  );
}

/** 表单底部的提交动作区，不跟随每一行。 */
export function SettingFormActions({ children }: { children: ReactNode }) {
  return <div className={controls.formActions}>{children}</div>;
}

/** 危险操作组：删除、清空、重置等单独成组，固定放在页面最末。 */
export function SettingDangerGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={controls.dangerSection} aria-label={title}>
      <h2 className={controls.dangerTitle}>{title}</h2>
      <div className={surface.groupList}>{children}</div>
    </section>
  );
}

/** 用受控开关显示已经生效的布尔设置，变更由调用方持久化。 */
export function SettingSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`${controls.switchTrack} ${checked ? controls.switchChecked : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className={controls.switchThumb} aria-hidden="true" />
    </button>
  );
}

/** 短枚举（≤ 4 项）的分段选择，避免为此弹出一层菜单。 */
export function SettingSegmented<T extends string>({
  value,
  label,
  options,
  onChange,
}: {
  value: T;
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (next: T) => void;
}) {
  return (
    <div className={controls.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          className={`${controls.segBtn} ${option.value === value ? controls.segBtnActive : ""}`}
          onClick={() => {
            if (option.value !== value) onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}