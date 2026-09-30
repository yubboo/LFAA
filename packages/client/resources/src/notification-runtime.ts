/**
 * 功能：管理 LFAA 前端的系统通知和提示音。
 * 作用：读取浏览器通知授权、请求用户授权、发送可定位到 AI Work 会话的通知并播放提示音。
 * 关联文件：packages/client/ui-settings/src/SettingsPage.tsx、packages/client/ui-chat/src/AiWorkChat.tsx、packages/client/ui-workspace/src/ApplicationWorkspace.tsx、packages/client/ui-layout/src/Workbench.tsx。
 */
import type { ApplicationId } from "lfaa-client-connection/src/api.js";

export type BrowserNotificationPermission = NotificationPermission | "unsupported" | "insecure";
export type NotificationSound = "default" | "subtle" | "off";
export type AiWorkNotificationKind = "complete" | "issue" | "approval";

export interface AiWorkNotificationInput {
  appId: ApplicationId;
  applicationName: string;
  sessionId: string;
  kind: AiWorkNotificationKind;
  title: string;
  body: string;
}

export interface AiWorkNotification extends AiWorkNotificationInput {
  id: string;
  createdAt: number;
  read: boolean;
}

export interface AiWorkSessionTarget {
  appId: ApplicationId;
  sessionId: string;
}

export const aiWorkSessionOpenEventName = "lfaa:open-ai-session";

let sharedAudioContext: AudioContext | null = null;

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === "undefined" || typeof window.Notification === "undefined") return "unsupported";
  if (!window.isSecureContext) return "insecure";
  return window.Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  const current = getBrowserNotificationPermission();
  if (current !== "default") return current;
  try {
    return await window.Notification.requestPermission();
  } catch {
    return getBrowserNotificationPermission();
  }
}

export function sendBrowserNotification(title: string, body: string, target?: AiWorkSessionTarget): boolean {
  if (getBrowserNotificationPermission() !== "granted") return false;
  try {
    const notification = new window.Notification(title, { body, silent: true });
    notification.onclick = () => {
      window.focus();
      if (target) window.dispatchEvent(new CustomEvent<AiWorkSessionTarget>(aiWorkSessionOpenEventName, { detail: target }));
      notification.close();
    };
    window.setTimeout(() => notification.close(), 9000);
    return true;
  } catch {
    return false;
  }
}

export function playNotificationSound(sound: NotificationSound): boolean {
  if (sound === "off" || typeof window === "undefined" || typeof window.AudioContext === "undefined") return false;
  try {
    sharedAudioContext ??= new window.AudioContext();
    const context = sharedAudioContext;
    if (context.state === "suspended") void context.resume().catch(() => undefined);

    const notes = sound === "default"
      ? [{ frequency: 784, delay: 0, duration: 0.12 }, { frequency: 988, delay: 0.11, duration: 0.16 }]
      : [{ frequency: 659, delay: 0, duration: 0.2 }];
    for (const note of notes) {
      const start = context.currentTime + note.delay;
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(note.frequency, start);
      volume.gain.setValueAtTime(0.0001, start);
      volume.gain.exponentialRampToValueAtTime(sound === "default" ? 0.075 : 0.04, start + 0.025);
      volume.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
      oscillator.connect(volume);
      volume.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + note.duration + 0.02);
    }
    return true;
  } catch {
    return false;
  }
}

export function notifyAiWorkCompletion(input: {
  notification: AiWorkNotificationInput;
  policy: "always" | "unfocused" | "never";
  sound: NotificationSound;
  onNotification: (notification: AiWorkNotificationInput) => void;
}): boolean {
  if (input.policy === "never") return false;
  input.onNotification(input.notification);
  // 完成提醒已进入工作台通知中心；焦点状态只影响系统通知，不应抑制这条提醒音效。
  if (input.sound !== "off") playNotificationSound(input.sound);
  const shouldNotifyOutsideWorkbench = input.policy === "always"
    || document.visibilityState !== "visible"
    || !document.hasFocus();
  if (!shouldNotifyOutsideWorkbench) return true;

  sendBrowserNotification("LFAA AI Work", input.notification.body, input.notification);
  return true;
}

export function notifyAiWorkAction(input: {
  notification: AiWorkNotificationInput;
  sound: NotificationSound;
  onNotification: (notification: AiWorkNotificationInput) => void;
}): void {
  if (input.sound !== "off") playNotificationSound(input.sound);
  input.onNotification(input.notification);
  if (document.visibilityState !== "visible" || !document.hasFocus()) {
    sendBrowserNotification("LFAA AI Work", input.notification.body, input.notification);
  }
}
