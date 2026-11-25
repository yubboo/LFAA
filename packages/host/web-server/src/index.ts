// @lfaa/web-server：公开入口：开发宿主（Vite）、生产宿主（静态托管）与共用运行时装配。
export { detectProjectRoot } from "./detect-root";
export { startWeb, type WebServerOptions } from "./dev-server";
export { createHostRuntime, resolveLoaderBaseUrl, type HostRuntime, type HostRuntimeOptions } from "./runtime";
export {
  createBackgroundsHttpHandler,
  type BackgroundHandlerOptions,
  type CustomBackgroundMeta,
} from "./handlers/handlers-backgrounds";
export {
  createNotificationSoundsHttpHandler,
  type CustomNotificationSoundMeta,
  type NotificationSoundHandlerOptions,
} from "./handlers/handlers-notifications";
export {
  startHostServer,
  startStaticServer,
  type HostServer,
  type HostServerOptions,
  type StaticServer,
  type StaticServerOptions,
} from "./static-server";