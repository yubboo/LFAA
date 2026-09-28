/**
 * 功能：呈现超级管理员首次初始化、登录和恢复密码表单。
 * 作用：通过控制端 API 初始化管理员、验证账户或使用恢复密钥设置新密码，不在浏览器保存凭据。
 * 关联文件：frontend/src/App.tsx、frontend/src/api.ts、frontend/src/components/PasswordStrengthIndicator.tsx、frontend/src/shared/login-background.ts、frontend/src/styles/auth.css。
 */
import { useState } from "react";
import { Alert, Button, Form, Input, Typography } from "antd";
import type { CSSProperties } from "react";
import { resolveLoginBackgroundImage } from "../shared/login-background.js";
import { isPasswordAcceptable, PasswordStrengthIndicator } from "./PasswordStrengthIndicator.js";
import { ServiceStatus, type ServiceState } from "./ServiceStatus.js";

interface AuthViewProps {
  mode: "setup" | "login";
  serverState: ServiceState;
  busy: boolean;
  error: string | null;
  notice: string | null;
  onSubmit: (username: string, password: string, recoveryKey?: string) => void;
  onRecover: (username: string, recoveryKey: string, newPassword: string) => Promise<boolean>;
  onClearMessage: () => void;
}

interface AuthFormValues {
  username: string;
  password: string;
  confirmPassword?: string;
  recoveryKey?: string;
  confirmRecoveryKey?: string;
  newPassword?: string;
  confirmNewPassword?: string;
}

export function AuthView({ mode, serverState, busy, error, notice, onSubmit, onRecover, onClearMessage }: AuthViewProps) {
  const isSetup = mode === "setup";
  const loginBackgroundImage = resolveLoginBackgroundImage();
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [form] = Form.useForm<AuthFormValues>();
  const password = Form.useWatch("password", form) ?? "";
  const recoveryKey = Form.useWatch("recoveryKey", form) ?? "";
  const newPassword = Form.useWatch("newPassword", form) ?? "";

  async function handleSubmit(values: AuthFormValues): Promise<void> {
    if (recoveryMode) {
      if (!values.recoveryKey || !values.newPassword) return;
      if (await onRecover(values.username, values.recoveryKey, values.newPassword)) {
        setRecoveryMode(false);
        form.resetFields();
      }
      return;
    }

    onSubmit(values.username, values.password, isSetup ? values.recoveryKey : undefined);
  }

  function toggleRecoveryMode(): void {
    form.resetFields();
    onClearMessage();
    setRecoveryMode((current) => !current);
  }

  return (
    <main
      className="auth-page"
      style={{ "--auth-background-image": loginBackgroundImage ? `url("${loginBackgroundImage}")` : "none" } as CSSProperties}
    >
      <div className="auth-page__split-layout">
        <section className="auth-page__visual" aria-labelledby="auth-heading">
          <div className="auth-page__visual-brand">
            <span className="auth-page__visual-brand-mark" aria-hidden="true">L</span>
            <span className="auth-page__visual-brand-name">LFAA</span>
          </div>
          <div className="auth-page__visual-copy">
            <Typography.Title id="auth-heading" level={1}>
              主机服务与应用，<br />从一个工作台开始。
            </Typography.Title>
            <Typography.Paragraph>
              先完成账户初始化，随后即可进入应用中心。当前版本提供基础账户、权限和服务状态能力。
            </Typography.Paragraph>
          </div>
          <div className="auth-page__visual-status">
            <ServiceStatus state={serverState} />
            <span>控制端连接状态</span>
          </div>
        </section>

        <section className="auth-page__form-panel" aria-labelledby="form-heading">
          <div className="auth-page__form-heading">
            <Typography.Text className="auth-page__form-eyebrow">
              {isSetup ? "首次使用" : recoveryMode ? "账户恢复" : "欢迎回来"}
            </Typography.Text>
            <Typography.Title id="form-heading" level={2}>
              {isSetup ? "创建超级管理员" : recoveryMode ? "找回密码" : "登录 LFAA"}
            </Typography.Title>
            <Typography.Paragraph>
              {isSetup
                ? "首次初始化只创建一个超级管理员。请分别设置登录密码和恢复密钥，并妥善保管恢复密钥。"
                : recoveryMode
                  ? "使用注册时设置的恢复密钥验证身份，然后设置新密码。系统不会显示原密码。"
                  : "使用已创建的 LFAA 账户继续。"}
            </Typography.Paragraph>
          </div>

          {error && <Alert className="auth-page__form-message" type="error" showIcon message={error} />}
          {notice && <Alert className="auth-page__form-message" type="success" showIcon message={notice} />}

          <Form<AuthFormValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={(values) => void handleSubmit(values)}
            autoComplete="on"
            className="auth-page__form"
          >
            <Form.Item
              label="用户名"
              name="username"
              rules={[
                { required: true, message: "请输入用户名。" },
                { min: 3, max: 32, message: "用户名长度为 3 到 32 个字符。" },
                { pattern: /^[\p{L}\p{N}_.-]+$/u, message: "用户名可使用文字、数字、句点、下划线和连字符。" }
              ]}
            >
              <Input autoComplete="username" placeholder="输入用户名" size="large" />
            </Form.Item>

            {recoveryMode ? (
              <>
                <Form.Item label="恢复密钥" name="recoveryKey" rules={[{ required: true, message: "请输入恢复密钥。" }]}>
                  <Input.Password autoComplete="off" placeholder="输入注册时设置的恢复密钥" size="large" />
                </Form.Item>
                <Form.Item
                  label="新密码"
                  name="newPassword"
                  extra={<PasswordStrengthIndicator password={newPassword} />}
                  rules={[
                    { required: true, message: "请输入新密码。" },
                    { validator: (_: unknown, value: string | undefined) => !value || isPasswordAcceptable(value) ? Promise.resolve() : Promise.reject(new Error("密码强度不足，请至少使用 8 位和 3 类字符。")) },
                    { validator: (_: unknown, value: string | undefined) => !value || value !== recoveryKey ? Promise.resolve() : Promise.reject(new Error("新密码必须与恢复密钥不同。")) }
                  ]}
                >
                  <Input.Password autoComplete="new-password" placeholder="至少 8 位并包含 3 类字符" size="large" />
                </Form.Item>
                <Form.Item
                  label="确认新密码"
                  name="confirmNewPassword"
                  dependencies={["newPassword"]}
                  rules={[
                    { required: true, message: "请再次输入新密码。" },
                    ({ getFieldValue }) => ({
                      validator(_, value: string | undefined) {
                        return !value || getFieldValue("newPassword") === value
                          ? Promise.resolve()
                          : Promise.reject(new Error("两次输入的新密码不一致。"));
                      }
                    })
                  ]}
                >
                  <Input.Password autoComplete="new-password" placeholder="再次输入新密码" size="large" />
                </Form.Item>
              </>
            ) : (
              <>
            <Form.Item
              label="密码"
              name="password"
              extra={isSetup ? <PasswordStrengthIndicator password={password} /> : undefined}
              rules={[
                { required: true, message: "请输入密码。" },
                ...(isSetup ? [{ validator: (_: unknown, value: string | undefined) => !value || isPasswordAcceptable(value) ? Promise.resolve() : Promise.reject(new Error("密码强度不足，请至少使用 8 位和 3 类字符。")) }] : [])
              ]}
            >
              <Input.Password
                autoComplete={isSetup ? "new-password" : "current-password"}
                placeholder={isSetup ? "至少 8 位并包含 3 类字符" : "输入密码"}
                size="large"
              />
            </Form.Item>

            {isSetup && (
              <Form.Item
                label="确认密码"
                name="confirmPassword"
                dependencies={["password"]}
                rules={[
                  { required: true, message: "请再次输入密码。" },
                  ({ getFieldValue }) => ({
                    validator(_, value: string | undefined) {
                      if (!value || getFieldValue("password") === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error("两次输入的密码不一致。"));
                    }
                  })
                ]}
              >
                <Input.Password autoComplete="new-password" placeholder="再次输入密码" size="large" />
              </Form.Item>
            )}

            {isSetup && (
              <Form.Item
                label="账户恢复密钥"
                name="recoveryKey"
                extra={<PasswordStrengthIndicator password={recoveryKey} label="恢复密钥" />}
                rules={[
                  { required: true, message: "请设置账户恢复密钥。" },
                  { validator: (_: unknown, value: string | undefined) => !value || isPasswordAcceptable(value) ? Promise.resolve() : Promise.reject(new Error("恢复密钥强度不足，请至少使用 8 位和 3 类字符。")) },
                  ({ getFieldValue }) => ({
                    validator(_, value: string | undefined) {
                      if (!value || value !== getFieldValue("password")) return Promise.resolve();
                      return Promise.reject(new Error("恢复密钥必须与登录密码不同。"));
                    }
                  })
                ]}
              >
                <Input.Password autoComplete="new-password" placeholder="用于账户恢复，至少 8 个字符并包含 3 类字符" size="large" />
              </Form.Item>
            )}

            {isSetup && (
              <Form.Item
                label="确认恢复密钥"
                name="confirmRecoveryKey"
                dependencies={["recoveryKey"]}
                rules={[
                  { required: true, message: "请再次输入恢复密钥。" },
                  ({ getFieldValue }) => ({
                    validator(_, value: string | undefined) {
                      if (!value || getFieldValue("recoveryKey") === value) return Promise.resolve();
                      return Promise.reject(new Error("两次输入的恢复密钥不一致。"));
                    }
                  })
                ]}
              >
                <Input.Password autoComplete="new-password" placeholder="再次输入恢复密钥" size="large" />
              </Form.Item>
            )}
              </>
            )}

            <Button
              block
              type="primary"
              htmlType="submit"
              size="large"
              loading={busy}
              disabled={serverState !== "online"}
            >
              {isSetup ? "创建超级管理员并进入" : recoveryMode ? "重置密码" : "登录"}
            </Button>
          </Form>

          {!isSetup && <Button type="link" block onClick={toggleRecoveryMode}>{recoveryMode ? "返回登录" : "忘记密码？使用恢复密钥找回"}</Button>}

          <Typography.Paragraph className="auth-page__form-footnote">
            {isSetup
              ? "超级管理员仅能在本地数据尚无账户时初始化；升级前创建的账户可在设置中补设恢复密钥。"
              : recoveryMode
                ? "恢复密钥以加盐哈希保存在本机 SQLite 文件中，请勿与登录密码相同。"
                : "登录状态由服务端管理；浏览器不会保存你的密码。"}
          </Typography.Paragraph>
        </section>
      </div>
    </main>
  );
}

