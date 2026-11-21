// 浏览器/桌面系统通知策略：统一申请权限、显示桌面通知，并判断「仅在未聚焦时」是否该提醒。
export type TurnNotifyMode = "unfocused" | "always" | "off";

/** 当前环境的通知权限；不支持 Notification API 时返回 unsupported。 */
export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** 申请一次桌面通知权限；必须在用户手势（如设置开关）中调用才会被浏览器接受。 */
export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  const current = notificationPermission();
  if (current === "unsupported" || current === "granted") return current;
  try {
    return await Notification.requestPermission();
  } catch {
    return notificationPermission();
  }
}

/** 弹出系统通知；应用自己的提示音由调用方播放，因此这里静音避免双重声音。 */
export function showDesktopNotification(input: { title: string; body: string; tag?: string }): boolean {
  if (notificationPermission() !== "granted") return false;
  try {
    const notification = new Notification(input.title, {
      body: input.body.slice(0, 200),
      ...(input.tag ? { tag: input.tag } : {}),
      silent: true,
    });
    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // 某些桌面环境不允许脚本聚焦窗口，忽略即可。
      }
      notification.close();
    };
    window.setTimeout(() => notification.close(), 8_000);
    return true;
  } catch {
    return false;
  }
}

/** 按「轮次完成通知」档位判断现在是否该提醒：off 永不，always 总是，unfocused 仅在窗口失焦/隐藏时。 */
export function shouldNotifyTurn(mode: TurnNotifyMode): boolean {
  if (mode === "off") return false;
  if (mode === "always") return true;
  if (typeof document === "undefined") return true;
  return document.hidden || !document.hasFocus();
}