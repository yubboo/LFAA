// @lfaa/browser Host 侧 Cordis 服务：统一注册 DSH 风格独占驱动槽位、内置浏览器工具与生命周期清理。
import { type Context, Service } from "@deepseek-ai/cordis";
import "@lfaa/tools";
import { BrowserRuntime, detectLocalBrowserExecutable, validateBrowserUrl } from "./browser-service";
import { registerBrowserAgentTools } from "./browser-tools";
import { BrowserUseRegistry } from "./registry";
import type { StreamFrameListener } from "./screencast-manager";
import type { BrowserPluginConfig, BrowserSettingsConfig } from "./types";

export * from "./types";
export * from "./registry";
export { createBrowserHttpHandler } from "./http-handler";
export { detectLocalBrowserExecutable, validateBrowserUrl };

/** Host 侧内置浏览器服务，挂接于 Cordis `browser` 属性。 */
export class BrowserService extends Service {
  static inject = ["tools"];

  private readonly runtime: BrowserRuntime;
  private unregisterProvider: (() => void) | null = null;
  private unregisterTools: (() => void) | null = null;

  constructor(ctx: Context, config: BrowserPluginConfig = {}) {
    super(ctx, "browser");
    this.runtime = new BrowserRuntime(config.storeFilePath);
    const registry = ctx.get("browserUse") ?? new BrowserUseRegistry(ctx);
    this.unregisterProvider = registry.register("playwright-local");
    this.unregisterTools = registerBrowserAgentTools(ctx.tools, this.runtime);
    ctx.effect(() => () => {
      this.unregisterTools?.();
      this.unregisterTools = null;
      this.unregisterProvider?.();
      this.unregisterProvider = null;
      return this.runtime.closeAll();
    });
  }

  protected async stop(): Promise<void> {
    this.unregisterTools?.();
    this.unregisterTools = null;
    this.unregisterProvider?.();
    this.unregisterProvider = null;
    await this.runtime.closeAll();
  }

  getSettings() { return this.runtime.getSettings(); }
  updateSettings(patch: Partial<BrowserSettingsConfig>) { return this.runtime.updateSettings(patch); }
  getSnapshot(sessionId: string) { return this.runtime.getSnapshot(sessionId); }
  subscribeStream(
    sessionId: string,
    listener: StreamFrameListener,
    appearance?: { deviceScaleFactor?: number; colorScheme?: "dark" | "light" },
  ) {
    return this.runtime.subscribeStream(sessionId, listener, appearance);
  }
  setViewport(
    sessionId: string,
    width: number,
    height: number,
    appearance?: { deviceScaleFactor?: number; colorScheme?: "dark" | "light" },
  ) {
    return this.runtime.setViewport(sessionId, width, height, appearance);
  }
  createTab(
    sessionId: string,
    url?: string,
    viewport?: { width: number; height: number },
    appearance?: { deviceScaleFactor?: number; colorScheme?: "dark" | "light" },
  ) {
    return this.runtime.createTab(sessionId, url, false, viewport, appearance);
  }
  activateTab(sessionId: string, tabId: string) { return this.runtime.activateTab(sessionId, tabId); }
  closeTab(sessionId: string, tabId: string) { return this.runtime.closeTab(sessionId, tabId); }
  navigate(
    sessionId: string,
    url: string,
    viewport?: { width: number; height: number },
    appearance?: { deviceScaleFactor?: number; colorScheme?: "dark" | "light" },
  ) {
    return this.runtime.navigate(sessionId, url, false, viewport, appearance);
  }
  goBack(sessionId: string) { return this.runtime.goBack(sessionId); }
  goForward(sessionId: string) { return this.runtime.goForward(sessionId); }
  reload(sessionId: string) { return this.runtime.reload(sessionId); }
  click(
    sessionId: string,
    target: { ref?: string; selector?: string; x?: number; y?: number; button?: "left" | "right" | "middle"; clickCount?: number },
    fast = false,
  ) {
    return this.runtime.click(sessionId, target, false, fast);
  }
  hover(sessionId: string, target: { ref?: string; selector?: string; x?: number; y?: number }, fast = false) {
    return this.runtime.hover(sessionId, target, false, fast);
  }
  typeText(sessionId: string, target: { ref?: string; selector?: string; text: string; submit?: boolean }, fast = false) {
    return this.runtime.typeText(sessionId, target, false, fast);
  }
  pressKey(sessionId: string, key: string, fast = false) { return this.runtime.pressKey(sessionId, key, false, fast); }
  scroll(sessionId: string, deltaY: number, deltaX = 0, fast = false) { return this.runtime.scroll(sessionId, deltaY, deltaX, false, fast); }
  setTakeover(sessionId: string, paused: boolean) { return this.runtime.setTakeover(sessionId, paused); }
  setTakeoverAndSnapshot(sessionId: string, paused: boolean) { return this.runtime.setTakeoverAndSnapshot(sessionId, paused); }
  openDesktopTakeoverWindow(sessionId: string) { return this.runtime.openDesktopTakeoverWindow(sessionId); }
  getConsole(sessionId: string) { return this.runtime.getConsole(sessionId); }
  getNetwork(sessionId: string) { return this.runtime.getNetwork(sessionId); }
  clearLogs(sessionId: string) { return this.runtime.clearLogs(sessionId); }
  closeSession(sessionId: string) { return this.runtime.closeSession(sessionId); }
}

export function browserPlugin(ctx: Context, config: BrowserPluginConfig = {}): void {
  new BrowserService(ctx, config);
}

browserPlugin.inject = ["tools"] as const;

declare module "@deepseek-ai/cordis" {
  interface Context {
    browser: BrowserService;
  }
}
/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default browserPlugin;
