import type { AiWorkNotification } from "lfaa-client-resources/src/notification-runtime.js";
import type { ApplicationId } from "lfaa-client-connection/src/api.js";

export function hasUnreadSessionCompletionNotification(
  notifications: readonly AiWorkNotification[],
  appId: ApplicationId,
  sessionId: string,
): boolean {
  return notifications.some(notification =>
    notification.appId === appId
    && notification.sessionId === sessionId
    && notification.kind === "complete"
    && !notification.read
  );
}
