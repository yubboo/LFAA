/**
 * 功能：呈现账户登录资料和凭据表单。
 * 作用：只收集受控草稿并调用 Settings 容器回调；认证、校验、密钥生成、持久化和错误处理仍归原 Owner。
 * 关联文件：packages/client/ui-settings/src/SettingsPage.tsx、PasswordStrengthIndicator.tsx、PasskeyManager.tsx。
 */
import { Button, Card, Input, Space, Typography } from "antd";
import { SettingGroup, SettingRow } from "lfaa-client-ui-primitives/src/settings-controls.js";
import { PasswordStrengthIndicator } from "./PasswordStrengthIndicator.js";
import { PasskeyManager } from "./PasskeyManager.js";

export interface AccountSecuritySettingsProps {
  username: string;
  email: string;
  serverOnline: boolean;
  usernameDraft: string;
  onUsernameDraftChange: (value: string) => void;
  usernameCurrentPassword: string;
  onUsernameCurrentPasswordChange: (value: string) => void;
  savingUsername: boolean;
  onSaveUsername: () => void;
  emailDraft: string;
  onEmailDraftChange: (value: string) => void;
  emailCurrentPassword: string;
  onEmailCurrentPasswordChange: (value: string) => void;
  savingEmail: boolean;
  onSaveEmail: () => void;
  passwordChangeCurrent: string;
  onPasswordChangeCurrentChange: (value: string) => void;
  passwordChangeNext: string;
  onPasswordChangeNextChange: (value: string) => void;
  passwordChangeConfirmation: string;
  onPasswordChangeConfirmationChange: (value: string) => void;
  savingPasswordChange: boolean;
  onSavePasswordChange: () => void;
  recoveryCurrentPassword: string;
  onRecoveryCurrentPasswordChange: (value: string) => void;
  recoveryKey: string;
  onRecoveryKeyChange: (value: string) => void;
  recoveryKeyConfirmation: string;
  onRecoveryKeyConfirmationChange: (value: string) => void;
  savingRecoveryKey: boolean;
  onSaveRecoveryKey: () => void;
  onCreateRecoveryKey: () => void;
  onCopyRecoveryKey: () => void;
}

export function AccountSecuritySettings({
  username,
  email,
  serverOnline,
  usernameDraft,
  onUsernameDraftChange,
  usernameCurrentPassword,
  onUsernameCurrentPasswordChange,
  savingUsername,
  onSaveUsername,
  emailDraft,
  onEmailDraftChange,
  emailCurrentPassword,
  onEmailCurrentPasswordChange,
  savingEmail,
  onSaveEmail,
  passwordChangeCurrent,
  onPasswordChangeCurrentChange,
  passwordChangeNext,
  onPasswordChangeNextChange,
  passwordChangeConfirmation,
  onPasswordChangeConfirmationChange,
  savingPasswordChange,
  onSavePasswordChange,
  recoveryCurrentPassword,
  onRecoveryCurrentPasswordChange,
  recoveryKey,
  onRecoveryKeyChange,
  recoveryKeyConfirmation,
  onRecoveryKeyConfirmationChange,
  savingRecoveryKey,
  onSaveRecoveryKey,
  onCreateRecoveryKey,
  onCopyRecoveryKey
}: AccountSecuritySettingsProps) {
  return <>
    <SettingGroup title="登录用户名">
      <SettingRow title="账户用户名" description="用户名用于登录，修改前需要重新验证当前密码。" status={username}>
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          <Input autoComplete="username" maxLength={32} value={usernameDraft} onChange={(event) => onUsernameDraftChange(event.target.value)} placeholder="3 到 32 个字符" />
          <Input.Password autoComplete="current-password" value={usernameCurrentPassword} onChange={(event) => onUsernameCurrentPasswordChange(event.target.value)} placeholder="输入当前登录密码以确认修改" />
          <Button type="primary" loading={savingUsername} disabled={!serverOnline || !usernameCurrentPassword || usernameDraft.trim() === username} onClick={onSaveUsername}>保存用户名</Button>
        </Space>
      </SettingRow>
    </SettingGroup>
    <SettingGroup title="邮箱资料">
      <SettingRow title="账户邮箱" description="邮箱目前用于账户资料和管理员检索，尚未接入邮箱验证或邮件找回。清空后会移除当前邮箱。" status={email ? "已设置" : "未设置"}>
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          <Input type="email" autoComplete="email" maxLength={254} value={emailDraft} onChange={(event) => onEmailDraftChange(event.target.value)} placeholder="输入邮箱地址" />
          <Input.Password autoComplete="current-password" value={emailCurrentPassword} onChange={(event) => onEmailCurrentPasswordChange(event.target.value)} placeholder="输入当前登录密码以确认修改" />
          <Button type="primary" loading={savingEmail} disabled={!serverOnline || !emailCurrentPassword} onClick={onSaveEmail}>保存邮箱</Button>
        </Space>
      </SettingRow>
    </SettingGroup>
    <Card className="settings-card" title="更改登录密码">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Input.Password autoComplete="current-password" value={passwordChangeCurrent} onChange={(event) => onPasswordChangeCurrentChange(event.target.value)} placeholder="当前登录密码" />
        <div>
          <Input.Password autoComplete="new-password" value={passwordChangeNext} onChange={(event) => onPasswordChangeNextChange(event.target.value)} placeholder="新密码" />
          <PasswordStrengthIndicator password={passwordChangeNext} label="新密码" />
        </div>
        <Input.Password autoComplete="new-password" value={passwordChangeConfirmation} onChange={(event) => onPasswordChangeConfirmationChange(event.target.value)} placeholder="再次输入新密码" />
        <Typography.Text type="secondary">密码至少 8 位，并包含至少 3 类字符。更改后会让其他设备退出登录，当前设备保持登录。</Typography.Text>
        <Button type="primary" loading={savingPasswordChange} disabled={!serverOnline} onClick={onSavePasswordChange}>更新密码</Button>
      </Space>
    </Card>
    <Card className="settings-card" title="密码恢复密钥">
      <Typography.Paragraph type="secondary">恢复密钥可用于忘记密码时重设登录密码。密钥只在此页内存中暂存，控制端只保存加盐哈希；离开“安全”分类会清除输入内容。</Typography.Paragraph>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Input.Password autoComplete="current-password" value={recoveryCurrentPassword} onChange={(event) => onRecoveryCurrentPasswordChange(event.target.value)} placeholder="输入当前登录密码" />
        <Space wrap>
          <Button onClick={onCreateRecoveryKey}>随机生成</Button>
          <Button disabled={!recoveryKey} onClick={onCopyRecoveryKey}>复制恢复密钥</Button>
        </Space>
        <div>
          <Input.Password autoComplete="new-password" value={recoveryKey} onChange={(event) => onRecoveryKeyChange(event.target.value)} placeholder="设置独立恢复密钥" />
          <PasswordStrengthIndicator password={recoveryKey} label="恢复密钥" />
        </div>
        <Input.Password autoComplete="new-password" value={recoveryKeyConfirmation} onChange={(event) => onRecoveryKeyConfirmationChange(event.target.value)} placeholder="再次输入恢复密钥" />
        <Button type="primary" loading={savingRecoveryKey} disabled={!serverOnline} onClick={onSaveRecoveryKey}>保存恢复密钥</Button>
      </Space>
    </Card>
    <PasskeyManager />
  </>;
}
