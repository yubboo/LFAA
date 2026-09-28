/**
 * 功能：管理 LFAA 前端的系统通知和提示音。
 * 作用：读取浏览器通知授权、请求用户授权、发送不包含会话正文的通知并播放提示音；返回完成事件是否符合用户通知策略。
 * 关联文件：frontend/src/components/SettingsPage.tsx、frontend/src/components/AiWorkChat.tsx、frontend/src/components/ApplicationWorkspace.tsx。
 */
export type BrowserNotificationPermission = NotificationPermission | "unsupported" | "insecure";
export type NotificationSound = "default" | "subtle" | "off";

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

export function sendBrowserNotification(title: string, body: string): boolean {
  if (getBrowserNotificationPermission() !== "granted") return false;
  try {
    const notification = new window.Notification(title, { body, silent: true });
    notification.onclick = () => {
      window.focus();
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
  applicationName: string;
  policy: "always" | "unfocused" | "never";
  sound: NotificationSound;
}): boolean {
  if (input.policy === "never") return false;
  if (input.policy === "unfocused" && document.visibilityState === "visible" && document.hasFocus()) return false;

  if (input.sound !== "off") playNotificationSound(input.sound);
  sendBrowserNotification("LFAA AI Work", `${input.applicationName} 的回复已完成。`);
  return true;
}
