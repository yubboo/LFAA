/**
 * 功能：显示密码和恢复密钥的实时强度。
 * 作用：按服务端相同的字符类别规则提示弱、中、强，并暴露提交校验函数。
 * 关联文件：packages/client/ui-settings-account/src/AuthView.tsx、packages/client/ui-settings/src/SettingsPage.tsx、packages/identity/auth/src/password-policy.ts。
 */
import { Progress, Typography } from "antd";

const passwordCharacterGroups = [
  /\p{Lu}/u,
  /\p{Ll}/u,
  /\p{N}/u,
  /[\p{P}\p{S}]/u,
  /\p{Lo}/u
];

export type PasswordStrength = "weak" | "medium" | "strong";

export function getPasswordStrength(value: string): PasswordStrength {
  const characterCount = Array.from(value).length;
  const characterGroupCount = passwordCharacterGroups.filter((pattern) => pattern.test(value)).length;

  if (characterCount < 8 || characterGroupCount < 3) {
    return "weak";
  }

  return characterCount >= 12 && characterGroupCount >= 4 ? "strong" : "medium";
}

export function isPasswordAcceptable(value: string): boolean {
  return getPasswordStrength(value) !== "weak";
}

const strengthDisplay: Record<PasswordStrength, { label: string; percent: number; color: string }> = {
  weak: { label: "弱", percent: 25, color: "#d84b4b" },
  medium: { label: "中", percent: 65, color: "#d79a27" },
  strong: { label: "强", percent: 100, color: "#27845b" }
};

export function PasswordStrengthIndicator({ password, label = "密码" }: { password: string; label?: string }) {
  const strength = getPasswordStrength(password);
  const display = strengthDisplay[strength];

  return (
    <div className="password-strength" aria-live="polite">
      <Progress percent={password ? display.percent : 0} showInfo={false} size="small" strokeColor={display.color} />
      <div>
        <Typography.Text type={strength === "weak" && password ? "danger" : "secondary"}>
          {password ? `${label}强度：${display.label}` : `${label}强度：未评估`}
        </Typography.Text>
      </div>
      <div>
        <Typography.Text type="secondary">至少 8 位；大写、小写、数字、符号或汉字等类别任选至少 3 类。</Typography.Text>
      </div>
    </div>
  );
}
