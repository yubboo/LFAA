// 基于 @base-ui/react/switch 封装的双主题触感开关原语。
import { Switch } from "@base-ui/react/switch";
import styles from "./BasePrimitives.module.css";

export interface UiSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean | undefined;
  ariaLabel?: string | undefined;
}

export function UiSwitch({ checked, onCheckedChange, disabled = false, ariaLabel }: UiSwitchProps) {
  return (
    <Switch.Root
      className={styles.switchRoot}
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      onCheckedChange={onCheckedChange}
    >
      <Switch.Thumb className={styles.switchThumb} />
    </Switch.Root>
  );
}
