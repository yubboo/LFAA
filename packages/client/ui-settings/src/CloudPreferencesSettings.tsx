/** 功能：呈现当前账户的 LFAA 自托管偏好同步状态。作用：通过 Settings Owner 读取真实持久化分类，不把不同控制端之间的手动迁移说成同步。 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Space, Tag, Typography } from "antd";
import { loadUserSettingsSyncStatus, getErrorMessage, type User, type UserSettingsSyncStatus } from "lfaa-client-connection/src/api.js";
import { SettingGroup, SettingRow } from "lfaa-client-ui-primitives/src/settings-controls.js";

const categoryLabels: Record<string, string> = {
  general: "常规与通知", appearance: "外观", shortcuts: "快捷键", "ai-runtime": "AI 与语音",
  "minecraft-runtime": "Minecraft", git: "Git", permissions: "权限模式", plugins: "扩展与 MCP",
  personalization: "个性化记忆", "computer-control": "电脑操控", "browser-use": "浏览器", mini: "Mini 与虚拟宠物"
};

export function CloudPreferencesSettings({ user, onNavigate }: { user: User; onNavigate: (path: string) => void }) {
  const [status, setStatus] = useState<UserSettingsSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const result = await loadUserSettingsSyncStatus(signal);
      if (!signal?.aborted) setStatus(result.status);
    } catch (reason) {
      if (!signal?.aborted) setError(getErrorMessage(reason));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  return <section className="settings-content settings-content--sync">
    <header className="settings-content__heading"><div><span className="settings-eyebrow">编码</span><Typography.Title level={2}>云端偏好设置</Typography.Title><Typography.Paragraph>由你部署的 LFAA 控制端保存账户偏好。登录同一个控制端的设备会读取相同设置；不同 LFAA 控制端之间不会自动互传数据。</Typography.Paragraph></div><Button loading={loading} onClick={() => void refresh()}>检查同步状态</Button></header>
    {error ? <Alert type="error" showIcon message="读取自托管同步状态失败" description={error} /> : null}
    <SettingGroup title="当前自托管服务">
      <SettingRow title="服务地址" description="当前浏览器连接的 LFAA 控制端；此处不会把地址或账户凭据发送到第三方服务。" status="当前会话"><Typography.Text code copyable>{window.location.origin}</Typography.Text></SettingRow>
      <SettingRow title="账户" description="偏好按 LFAA 登录账户隔离。" status="已认证"><Typography.Text>{user.username}</Typography.Text></SettingRow>
      <SettingRow title="最近保存" description="来自控制端 Settings Owner 持久化记录，不代表其他独立控制端已同步。" status={loading ? "读取中" : status?.lastUpdatedAt ? new Date(status.lastUpdatedAt).toLocaleString("zh-CN") : "暂无记录"}>
        <Typography.Text type="secondary">{status ? `${status.categories.length} 个设置分类保存在当前服务` : "等待读取服务端状态"}</Typography.Text>
      </SettingRow>
      <SettingRow title="已保存分类" description="同步范围仅列出当前账户已有持久化记录；敏感值不会通过此状态接口返回。" status={status ? `${status.categories.length} 项` : loading ? "读取中" : "无记录"}>
        <Space wrap>{(status?.categories ?? []).map(category => <Tag key={category}>{categoryLabels[category] ?? category}</Tag>)}</Space>
      </SettingRow>
    </SettingGroup>
    <SettingGroup title="跨设备恢复">
      <SettingRow title="账户资料快照" description="同一控制端上的账户快照可供此账户其他设备读取；导出文件可以手动迁移到另一个 LFAA 控制端。恢复时可分别选择设置、记忆与会话。" status="同一服务共享">
        <Button onClick={() => onNavigate("/settings?section=snapshots")}>管理快照</Button>
      </SettingRow>
    </SettingGroup>
  </section>;
}
