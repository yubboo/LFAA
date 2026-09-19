/**
 * 文件：ThemeModeMenu.tsx
 * 作用：共享三态主题选择菜单。
 * 负责：system/light/dark 三种 UI 偏好的选择呈现。
 * 不负责：localStorage、matchMedia 监听、全局主题应用。
 * 状态归属：受控组件。
 * 对外接口：ThemeModeMenu、ThemePreference。
 */
import "./theme-mode-menu.css";

export type ThemePreference = "system" | "light" | "dark";

export interface ThemeModeMenuProps {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
}

const options: readonly { value: ThemePreference; label: string; description: string }[] = [
  { value: "system", label: "跟随系统", description: "随系统外观自动切换" },
  { value: "light", label: "浅色", description: "始终使用浅色界面" },
  { value: "dark", label: "深色", description: "始终使用深色界面" },
];

export function ThemeModeMenu({ value, onChange }: ThemeModeMenuProps) {
  return (
    <section className="lfaa-theme-menu" role="menu" aria-label="主题模式">
      <header>主题</header>
      {options.map((option) => (
        <button key={option.value} type="button" role="menuitemradio" aria-checked={option.value === value} className={option.value === value ? "is-active" : ""} onClick={() => onChange(option.value)}>
          <span><strong>{option.label}</strong><small>{option.description}</small></span><i aria-hidden="true" />
        </button>
      ))}
    </section>
  );
}
