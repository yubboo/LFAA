/**
 * 功能：定义登录密码与恢复密钥的强度判定规则。
 * 作用：在控制端统一拒绝过短或字符类别不足的凭据。
 * 关联文件：packages/identity/auth/src/service.ts、packages/client/ui-settings-account/src/PasswordStrengthIndicator.tsx。
 */
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
