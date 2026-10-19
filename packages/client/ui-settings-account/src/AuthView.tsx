/**
 * 功能：呈现默认账户登录和恢复密码表单。
 * 作用：通过控制端 API 验证账户或使用恢复密钥设置新密码，不在浏览器保存凭据。
 * 关联文件：packages/client/ui-renderer/src/App.tsx、packages/client/connection/src/api.ts、packages/client/ui-settings-account/src/PasswordStrengthIndicator.tsx、packages/client/ui-theme/src/login-appearance.ts、packages/client/ui-settings-account/src/auth.css。
 */
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Alert, Button, ConfigProvider, Form, Input, Typography } from "antd";
import type { CSSProperties } from "react";
import { browserSupportsPasskeys } from "@simplewebauthn/browser";
import { loadPasskeyAvailability } from "lfaa-client-connection/src/api.js";
import { applyAppearanceThemeBootstrap } from "lfaa-client-ui-theme/src/appearance-theme-bootstrap.js";
import { appearanceCodeFontStacks, appearanceTextFontStacks } from "lfaa-client-ui-theme/src/fonts.js";
import { getCachedLoginAppearance, resolveLoginAppearance, resolveLoginBackgroundImage } from "lfaa-client-ui-theme/src/login-appearance.js";
import { DshSlotOutlet, LFAA_AUTH_TRANSITION_SLOT, type AuthTransitionPhase, type AuthTransitionSlotOwner } from "lfaa-client-modules/src/client/index.js";
import { LoginTransitionScene } from "./LoginTransitionScene.js";
import { isPasswordAcceptable, PasswordStrengthIndicator } from "./PasswordStrengthIndicator.js";
import { ServiceStatus, type ServiceState } from "lfaa-client-ui-primitives/src/ServiceStatus.js";

interface AuthViewProps {
  serverState: ServiceState;
  busy: boolean;
  error: string | null;
  notice: string | null;
  transitionPhase: AuthTransitionPhase;
  transitionPluginId: string;
  reducedMotion: boolean;
  transitionOnly?: boolean;
  transitionOverlay?: boolean;
  transitionExiting?: boolean;
  transitionSettling?: boolean;
  onTransitionSettle?: () => void;
  onSubmit: (username: string, password: string) => void;
  onPasskeyLogin: () => void;
  onRecover: (username: string, recoveryKey: string, newPassword: string) => Promise<boolean>;
  onClearMessage: () => void;
}

interface AuthFormValues {
  username: string;
  password: string;
  recoveryKey?: string;
  newPassword?: string;
  confirmNewPassword?: string;
}

export function AuthView({ serverState, busy, error, notice, transitionPhase, transitionPluginId, reducedMotion, transitionOnly = false, transitionOverlay = false, transitionExiting = false, transitionSettling = false, onTransitionSettle, onSubmit, onPasskeyLogin, onRecover, onClearMessage }: AuthViewProps) {
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [form] = Form.useForm<AuthFormValues>();
  const username = Form.useWatch("username", form) ?? "admin";
  const loginAppearance = useMemo(() => getCachedLoginAppearance(username), [username]);
  const resolvedLoginAppearance = resolveLoginAppearance(loginAppearance, systemDark);
  const loginBackgroundImage = resolveLoginBackgroundImage(resolvedLoginAppearance.loginBackgroundId);
  const recoveryKey = Form.useWatch("recoveryKey", form) ?? "";
  const newPassword = Form.useWatch("newPassword", form) ?? "";
  const [passkeyLoginAvailable, setPasskeyLoginAvailable] = useState(false);

  useEffect(() => {
    if (transitionOnly || loginAppearance.theme !== "system") return;
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    setSystemDark(colorScheme.matches);
    colorScheme.addEventListener("change", updateSystemTheme);
    return () => colorScheme.removeEventListener("change", updateSystemTheme);
  }, [loginAppearance.theme, transitionOnly]);

  useLayoutEffect(() => {
    if (!transitionOnly) applyAppearanceThemeBootstrap(loginAppearance.theme, resolvedLoginAppearance.theme);
  }, [loginAppearance.theme, resolvedLoginAppearance.theme, transitionOnly]);

  const interfaceFontScale = resolvedLoginAppearance.interfaceFontSize / 14;
  const contrastDelta = resolvedLoginAppearance.contrast - 60;
  // 登录页沿用 Appearance 的既有令牌：强调色来自账户配置，浅/深遮罩分别为白/中性深灰并沿用遮罩百分比。
  const authAppearanceStyle = {
    "--auth-background-image": loginBackgroundImage ? `url("${loginBackgroundImage}")` : "none", // 登录页背景只使用校验后的内置图片路径。
    "--settings-accent": resolvedLoginAppearance.accentColor, // 登录页品牌标记、按钮和链接使用所选强调色。
    "--settings-interface-font": appearanceTextFontStacks[resolvedLoginAppearance.fonts.interface], // 登录页表单使用当前主题对应的界面字体。
    "--settings-content-font": appearanceTextFontStacks[resolvedLoginAppearance.fonts.content], // 登录页辅助内容沿用当前主题对应的内容字体。
    "--settings-code-font": appearanceCodeFontStacks[resolvedLoginAppearance.fonts.code], // 登录页代码样式使用当前主题对应的等宽字体。
    "--font-family-sans": appearanceTextFontStacks[resolvedLoginAppearance.fonts.interface], // 登录页原生控件和 Ant Design 文本使用同一界面字体。
    "--settings-interface-font-size": `${resolvedLoginAppearance.interfaceFontSize}px`, // 登录页正文及标题层级使用设置的界面字号。
    "--font-size-base": `${resolvedLoginAppearance.interfaceFontSize}px`, // 登录页共享正文基准字号与外观设置一致。
    "--font-size-sm": `${12 * interfaceFontScale}px`, // 登录页状态文字按界面字号同比缩放。
    "--settings-contrast-strong-mix": `${Math.max(0, contrastDelta) * 0.5}%`, // 登录页边界随外观对比度向正文颜色增强。
    "--settings-contrast-soft-mix": `${Math.max(0, -contrastDelta) / 3}%`, // 登录页边界在低于默认对比度时向表面颜色柔和混合。
    "--settings-background-overlay": resolvedLoginAppearance.theme === "dark"
      ? `rgba(24, 24, 24, ${resolvedLoginAppearance.overlay / 100})` // 深色登录页壁纸使用设置的中性深灰遮罩比例。
      : `rgba(255, 255, 255, ${resolvedLoginAppearance.overlay / 100})` // 浅色登录页壁纸使用设置的纯白遮罩比例。
  } as CSSProperties;

  useEffect(() => {
    if (transitionOnly || transitionOverlay || serverState !== "online") {
      setPasskeyLoginAvailable(false);
      return;
    }
    let active = true;
    void Promise.all([browserSupportsPasskeys(), loadPasskeyAvailability()]).then(([supported, availability]) => {
      if (active) setPasskeyLoginAvailable(supported && availability.available && availability.origin === window.location.origin);
    }).catch(() => {
      if (active) setPasskeyLoginAvailable(false);
    });
    return () => { active = false; };
  }, [serverState, transitionOnly, transitionOverlay]);

  async function handleSubmit(values: AuthFormValues): Promise<void> {
    if (recoveryMode) {
      if (!values.recoveryKey || !values.newPassword) return;
      if (await onRecover(values.username, values.recoveryKey, values.newPassword)) {
        setRecoveryMode(false);
        form.resetFields();
      }
      return;
    }

    onSubmit(values.username, values.password);
  }

  function toggleRecoveryMode(): void {
    form.resetFields();
    onClearMessage();
    setRecoveryMode((current) => !current);
  }

  if (transitionOnly) {
    return transitionPluginId === "builtin" || transitionPhase === "idle" ? null : (
      <div className="auth-page__transition-extension" aria-hidden="true">
        <DshSlotOutlet
          name={LFAA_AUTH_TRANSITION_SLOT}
          only={transitionPluginId}
          owner={{ phase: transitionPhase, reducedMotion } satisfies AuthTransitionSlotOwner}
        />
      </div>
    );
  }

  return (
    <ConfigProvider wave={{ disabled: true }}>
      <main
        className={`auth-page${transitionOverlay ? " auth-page--transition-overlay" : ""}${transitionExiting ? " auth-page--transition-exiting" : ""}${transitionSettling ? " auth-page--transition-settling" : ""}`}
        onTransitionEnd={(event) => {
          if (transitionSettling && event.target === event.currentTarget && event.propertyName === "opacity") onTransitionSettle?.();
        }}
        data-theme={resolvedLoginAppearance.theme}
        data-reduced-motion={loginAppearance.advanced.reducedMotion}
        style={authAppearanceStyle}
      >
      {transitionPhase !== "idle" && transitionPluginId !== "builtin" ? (
        <div className="auth-page__transition-extension" aria-hidden="true">
          <DshSlotOutlet
            name={LFAA_AUTH_TRANSITION_SLOT}
            only={transitionPluginId}
            owner={{ phase: transitionPhase, reducedMotion } satisfies AuthTransitionSlotOwner}
          />
        </div>
      ) : null}
      {transitionExiting ? (
        <>
          <LoginTransitionScene
            backgroundImage={loginBackgroundImage}
            theme={resolvedLoginAppearance.theme}
            overlay={resolvedLoginAppearance.overlay}
            accentColor={resolvedLoginAppearance.accentColor}
            reducedMotion={reducedMotion}
          />
          <div className="auth-page__transition-vortex" aria-hidden="true" />
          <div className="auth-page__transition-horizon" aria-hidden="true">
            <span className="auth-page__transition-vortex-core" />
            <span className="auth-page__transition-vortex-orbit" />
          </div>
        </>
      ) : null}
      <div className="auth-page__split-layout">
        {transitionExiting ? (
          <>
            <div className="auth-page__transition-shards" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => (
                <span key={index} className={`auth-page__transition-shard auth-page__transition-shard--${index + 1}`} />
              ))}
            </div>
            <div className="auth-page__transition-particles" aria-hidden="true">
              {Array.from({ length: 8 }, (_, index) => (
                <i key={index} className={`auth-page__transition-particle auth-page__transition-particle--${index + 1}`} />
              ))}
            </div>
          </>
        ) : null}
        <section className="auth-page__form-panel" aria-labelledby="form-heading">
          <span className="auth-page__brand-mark" aria-hidden="true">L</span>
          <Typography.Text className="auth-page__brand-name">LFAA</Typography.Text>
          <div className="auth-page__form-heading">
            <Typography.Text className="auth-page__form-eyebrow">
              {recoveryMode ? "账户恢复" : "欢迎回来"}
            </Typography.Text>
            <Typography.Title id="form-heading" level={2}>
              {recoveryMode ? "找回密码" : "登录 LFAA"}
            </Typography.Title>
            <Typography.Paragraph>
              {recoveryMode ? "使用账户恢复密钥设置新密码。" : "输入用户名和密码以继续。"}
            </Typography.Paragraph>
          </div>

          {!recoveryMode ? <Typography.Paragraph className="auth-page__default-credentials">默认登录名：<code>admin</code>　默认密码：<code>123456</code></Typography.Paragraph> : null}

          <div className="auth-page__form-message-slot" aria-live="polite" aria-atomic="true">
            {error && <Alert className="auth-page__form-message" type="error" showIcon message={error} />}
            {notice && transitionPhase !== "idle" ? (
              <div className="auth-page__login-wait" role="status">
                <span className="auth-page__black-hole" aria-hidden="true"><span className="auth-page__black-hole-core" /></span>
                <span>正在进入工作台…</span>
              </div>
            ) : notice ? <Alert className="auth-page__form-message" type="success" showIcon message={notice} /> : null}
          </div>

          <Form<AuthFormValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={(values) => void handleSubmit(values)}
            onValuesChange={() => onClearMessage()}
            autoComplete="on"
            initialValues={{ username: "admin" }}
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
            <Form.Item
              label="密码"
              name="password"
              rules={[
                { required: true, message: "请输入密码。" }
              ]}
            >
              <Input.Password
                autoComplete="current-password"
                placeholder="输入密码"
                size="large"
              />
            </Form.Item>
            )}

            <Button
              block
              type="primary"
              htmlType="submit"
              size="large"
              loading={busy ? { delay: 250 } : false}
              aria-busy={busy}
              disabled={busy || serverState !== "online"}
            >
              {recoveryMode ? "重置密码" : "登录"}
            </Button>
          </Form>

          {passkeyLoginAvailable && !recoveryMode ? <Button block size="large" loading={busy} disabled={busy || serverState !== "online"} onClick={onPasskeyLogin}>使用通行密钥登录</Button> : null}

          <div className="auth-page__form-support-row">
            <ServiceStatus state={serverState} compact />
            <Button
              type="link"
              aria-label={recoveryMode ? "返回登录" : "忘记密码？使用恢复密钥找回"}
              disabled={busy}
              onClick={toggleRecoveryMode}
            >
              {recoveryMode ? "返回登录" : <span className="auth-page__recovery-link-copy" aria-hidden="true">
                <span className="auth-page__recovery-label auth-page__recovery-label--full">忘记密码？使用恢复密钥找回</span>
                <span className="auth-page__recovery-label auth-page__recovery-label--compact">忘记密码？</span>
              </span>}
            </Button>
          </div>
          {recoveryMode ? (
            <Typography.Paragraph className="auth-page__form-footnote">
              恢复密钥以加盐哈希保存在本机，不会显示原密码。
            </Typography.Paragraph>
          ) : null}
        </section>
      </div>
      </main>
    </ConfigProvider>
  );
}

