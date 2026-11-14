/**
 * 功能：呈现当前登录账户的只读资料。
 * 作用：只显示 Settings 容器传入的认证会话用户，不读取跨账号缓存或持有账户副本。
 * 关联文件：packages/client/ui-settings/src/SettingsPage.tsx、Account Owner。
 */
import { Typography, Tag } from "antd";
import { userRoleLabel, type User } from "lfaa-client-connection/src/api.js";
import { SettingGroup, SettingRow } from "lfaa-client-ui-primitives/src/settings-controls.js";

export function AccountProfileSettings({ user, canAdmin }: { user: User; canAdmin: boolean }) {
  return (
    <SettingGroup title="账户资料">
      <SettingRow title="用户名" description="当前账户的登录名称。" status="当前账户"><Typography.Text>{user.username}</Typography.Text></SettingRow>
      <SettingRow title="邮箱" description="当前账户关联的邮箱地址。"><Typography.Text>{user.email ?? "未设置"}</Typography.Text></SettingRow>
      <SettingRow title="账户 UID" description="用于识别当前账户的编号。"><Typography.Text>{user.uid.toLocaleString("zh-CN")}</Typography.Text></SettingRow>
      <SettingRow title="账户角色" description="当前账户在 LFAA 中的权限角色。"><Tag color={canAdmin ? "blue" : undefined}>{userRoleLabel(user.role)}</Tag></SettingRow>
      <SettingRow title="创建时间" description="当前账户的创建时间。"><Typography.Text>{new Date(user.createdAt).toLocaleString("zh-CN")}</Typography.Text></SettingRow>
    </SettingGroup>
  );
}
