/**
 * 功能：管理当前账户已登记的 WebAuthn 通行密钥。
 * 作用：在真实浏览器支持且部署 Origin 匹配时提供添加、查看和删除能力，并在敏感变更前重新验证密码。
 * 关联文件：packages/client/connection/src/api.ts、packages/client/ui-settings/src/SettingsPage.tsx、packages/identity/auth/src/passkeys.ts。
 */
import { useEffect, useState } from "react";
import { browserSupportsPasskeys } from "@simplewebauthn/browser";
import { Alert, Button, Card, Input, Popconfirm, Space, Tag, Typography } from "antd";
import {
  getErrorMessage,
  loadPasskeyAvailability,
  loadUserPasskeys,
  registerPasskey,
  removePasskey,
  type PasskeyAvailability,
  type PasskeySummary
} from "lfaa-client-connection/src/api.js";

export function PasskeyManager() {
  const [availability, setAvailability] = useState<PasskeyAvailability | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [browserSupported, setBrowserSupported] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [name, setName] = useState("这台设备");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const [availabilityResult, passkeysResult, supported] = await Promise.all([
        loadPasskeyAvailability(),
        loadUserPasskeys(),
        browserSupportsPasskeys()
      ]);
      setAvailability(availabilityResult);
      setPasskeys(passkeysResult.passkeys);
      setBrowserSupported(supported);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const originMatches = availability?.origin === window.location.origin;
  const canManage = availability?.enabled === true && originMatches && browserSupported;

  async function addPasskey(): Promise<void> {
    if (!currentPassword) {
      setError("请输入当前登录密码以确认身份。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await registerPasskey(currentPassword, name.trim() || "这台设备");
      setPasskeys((current) => [result.passkey, ...current]);
      setCurrentPassword("");
    } catch (registrationError) {
      setError(getErrorMessage(registrationError));
    } finally {
      setBusy(false);
    }
  }

  async function deletePasskey(passkey: PasskeySummary): Promise<void> {
    if (!currentPassword) {
      setError("请输入当前登录密码以确认身份。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await removePasskey(passkey.id, currentPassword);
      setPasskeys((current) => current.filter((item) => item.id !== passkey.id));
      setCurrentPassword("");
    } catch (deletionError) {
      setError(getErrorMessage(deletionError));
    } finally {
      setBusy(false);
    }
  }

  const environmentMessage = !availability
    ? "暂时无法确认通行密钥配置，请刷新此页面后重试。"
    : !availability.enabled
    ? "此部署尚未启用通行密钥。开发环境请使用 http://localhost:5173；生产环境需配置 HTTPS Origin 与 RP ID。"
    : !originMatches
      ? `当前页面地址与已配置地址不一致。请从 ${availability.origin ?? "部署 Origin"} 打开 LFAA。`
      : !browserSupported
        ? "当前浏览器或设备没有可用的通行密钥验证器。"
        : "通行密钥使用设备验证器保护私钥；LFAA 只保存公钥和验证所需信息，不接收 PIN 或生物特征。";

  return (
    <Card className="settings-card" title="通行密钥登录" extra={<Tag color={passkeys.length ? "green" : "default"}>{passkeys.length} 项</Tag>}>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>{canManage ? "通行密钥由设备验证器保护私钥；LFAA 只保存公钥和验证所需信息，不接收 PIN 或生物特征。" : environmentMessage}</Typography.Paragraph>
        {error ? <Alert type="error" showIcon message={error} /> : null}
        {canManage ? <>
          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <Input.Password autoComplete="current-password" aria-label="当前登录密码" placeholder="添加或删除时输入当前登录密码" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={busy} />
            <Input aria-label="通行密钥名称" placeholder="设备名称" value={name} onChange={(event) => setName(event.target.value)} maxLength={48} disabled={busy} />
          </Space>
          <Button type="primary" loading={busy} disabled={loading || !currentPassword} onClick={() => void addPasskey()}>添加通行密钥</Button>
        </> : null}
        {loading ? <Typography.Text type="secondary">正在读取通行密钥…</Typography.Text> : passkeys.length ? passkeys.map((passkey) => (
          <div key={passkey.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <span>
              <Typography.Text strong>{passkey.name}</Typography.Text>
              <br />
              <Typography.Text type="secondary">{passkey.backedUp ? "已备份" : "未备份"} · {passkey.lastUsedAt ? `上次使用 ${new Date(passkey.lastUsedAt).toLocaleString("zh-CN")}` : "尚未使用"}</Typography.Text>
            </span>
            <Popconfirm title="删除这项通行密钥？" description="删除后，这项设备凭据将无法再登录此账户。" okText="删除" cancelText="取消" onConfirm={() => void deletePasskey(passkey)}>
              <Button danger disabled={!canManage || busy || !currentPassword} loading={busy}>删除</Button>
            </Popconfirm>
          </div>
        )) : !loading && canManage ? <Typography.Text type="secondary">尚未添加通行密钥。添加后可在登录页使用设备验证器登录。</Typography.Text> : null}
      </Space>
    </Card>
  );
}
