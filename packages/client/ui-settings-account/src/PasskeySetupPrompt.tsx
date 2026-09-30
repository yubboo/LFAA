/**
 * 功能：在账户尚无通行密钥时显示可跳过的安全设置提示。
 * 作用：检查服务端部署配置、账户凭据和浏览器能力后，引导用户进入账户安全设置。
 * 关联文件：packages/client/connection/src/api.ts、packages/client/ui-layout/src/Workbench.tsx、packages/client/ui-settings/src/SettingsPage.tsx。
 */
import { useEffect, useRef, useState } from "react";
import { browserSupportsPasskeys } from "@simplewebauthn/browser";
import { Button, Modal, Space, Typography } from "antd";
import { loadPasskeyAvailability, loadUserPasskeys, type User } from "lfaa-client-connection/src/api.js";

interface PasskeySetupPromptProps {
  user: User;
  isSettingsPage: boolean;
  onOpenSettings: (section: "account") => void;
}

function dismissalKey(userId: string): string {
  return `lfaa.passkey-setup-dismissed.v1:${encodeURIComponent(userId)}`;
}

function wasDismissed(userId: string): boolean {
  try {
    return window.sessionStorage.getItem(dismissalKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function PasskeySetupPrompt({ user, isSettingsPage, onOpenSettings }: PasskeySetupPromptProps) {
  const [open, setOpen] = useState(false);
  const dismissedRef = useRef(false);
  const dismissedUserIdRef = useRef(user.id);

  useEffect(() => {
    setOpen(false);
    if (dismissedUserIdRef.current !== user.id) {
      dismissedUserIdRef.current = user.id;
      dismissedRef.current = false;
    }
    if (isSettingsPage || dismissedRef.current || wasDismissed(user.id)) return;

    let active = true;
    const timer = window.setTimeout(() => {
      void Promise.all([loadPasskeyAvailability(), loadUserPasskeys(), browserSupportsPasskeys()]).then(([availability, result, supported]) => {
        if (active && supported && availability.enabled
          && availability.origin === window.location.origin && result.passkeys.length === 0) {
          setOpen(true);
        }
      }).catch(() => undefined);
    }, 5000);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isSettingsPage, user.id]);

  function dismiss(): void {
    dismissedRef.current = true;
    try {
      window.sessionStorage.setItem(dismissalKey(user.id), "1");
    } catch {
      // 无法保存界面提示状态时，组件状态仍会关闭本次提示。
    }
    setOpen(false);
  }

  function openAccountSecurity(): void {
    dismiss();
    onOpenSettings("account");
  }

  return (
    <Modal
      title="使用通行密钥保护账户"
      open={open}
      onCancel={dismiss}
      getContainer={() => document.querySelector<HTMLElement>(".workbench-shell") ?? document.body}
      footer={<Space wrap>
        <Button onClick={dismiss}>暂时跳过</Button>
        <Button type="primary" onClick={openAccountSecurity}>设置通行密钥</Button>
      </Space>}
      centered
      width={480}
    >
      <Typography.Paragraph>可以使用 Windows Hello、指纹、设备 PIN 或密码管理器验证登录。LFAA 不会接收或保存设备 PIN、生物特征或私钥。</Typography.Paragraph>
      <Typography.Paragraph type="secondary">添加前会要求验证当前 LFAA 密码；之后仍可使用密码和恢复密钥登录。</Typography.Paragraph>
    </Modal>
  );
}
