/**
 * 功能：为 Browser 右 Dock 与设置页提供认证 API。
 * 作用：同一 LFAA 会话共享 Agent Browser Context；响应只包含真实运行结果。
 * 关联文件：browser-use/browser-use、client/connection、client/ui-sidebar-browser。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { Router } from "express";
import Joi from "joi";
import { requireAuthentication } from "lfaa-authorization/src/middleware.js";
import { asyncHandler, parseBody } from "lfaa-api-remotes/src/route-contracts.js";
import { createRateLimit } from "lfaa-api-remotes/src/rate-limit.js";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { BROWSER_PROVIDER_IDS } from "lfaa-util-values/src/browser-provider.js";
import { getUserSettings, saveUserSettings } from "lfaa-settings/src/service.js";
import { BROWSER_ALLOWED_KEYS, BrowserNavigationTargetError, type BrowserSessionManager } from "lfaa-browser-use/src/session-manager.js";
import type { BrowserProviderId } from "lfaa-util-values/src/browser-provider.js";

declare module "@deepseek-ai/cordis" {
  interface Context {
    apiGateway: import("lfaa-api-gateway/src/index.js").ApiGateway;
    lfaaBrowser: BrowserSessionManager;
  }
}

const providerSchema = Joi.string().valid(...BROWSER_PROVIDER_IDS).required();
const dockProviderSchema = Joi.string().valid("lfaa-managed-edge", "lfaa-managed-chrome").required();
const sessionSchema = Joi.string().trim().min(1).max(160).pattern(/^[A-Za-z0-9._-]+$/u).required();
const navigateSchema = Joi.object({ providerId: providerSchema, url: Joi.string().uri({ scheme: ["http", "https"] }).max(2048).required() }).unknown(false);
const viewportSchema = Joi.object({ providerId: providerSchema.valid("lfaa-managed-edge", "lfaa-managed-chrome"), width: Joi.number().integer().min(320).max(1280).required(), height: Joi.number().integer().min(400).max(1600).required() }).unknown(false);
const actionSchema = Joi.object({
  providerId: providerSchema,
  action: Joi.string().valid("back", "forward", "reload", "clickAt", "dragAt", "typeText", "pressKey", "scroll").required(),
  x: Joi.number().min(0).max(4096), y: Joi.number().min(0).max(4096),
  points: Joi.array().items(Joi.object({ x: Joi.number().min(0).max(4096).required(), y: Joi.number().min(0).max(4096).required(), delayMs: Joi.number().integer().min(0).max(1000).required() }).unknown(false)).min(1).max(128),
  text: Joi.string().min(1).max(2000),
  key: Joi.string().valid(...BROWSER_ALLOWED_KEYS),
  direction: Joi.string().valid("up", "down"), amount: Joi.number().integer().min(1).max(600),
  includeScreenshot: Joi.boolean()
}).unknown(false);
const providerQuerySchema = Joi.object({ providerId: providerSchema }).unknown(false);
const dockProviderQuerySchema = Joi.object({ providerId: dockProviderSchema }).unknown(false);
const dockRevisionWaitSchema = Joi.object({ providerId: dockProviderSchema, revision: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER).required() }).unknown(false);
const claimSchema = Joi.object({ providerId: providerSchema.valid("tabbit-personal"), tabId: Joi.number().integer().min(0).required() }).unknown(false);
const tabbitConnectSchema = Joi.object({ sourceSessionId: sessionSchema }).unknown(false);
const nativeActiveTargetSchema = Joi.object({ providerId: providerSchema.valid("lfaa-native-browser"), targetId: Joi.string().trim().min(1).max(128).pattern(/^[A-Za-z0-9_-]+$/u).required() }).unknown(false);
const recentSitesQuerySchema = Joi.object({ limit: Joi.number().integer().min(1).max(50).default(12) }).unknown(false);
const recentSitesBodySchema = Joi.object({ urls: Joi.array().items(Joi.string().uri({ scheme: ["http", "https"] }).max(2048)).min(1).max(64).required() }).unknown(false);

function readSessionId(value: unknown): string {
  const result = sessionSchema.validate(value, { convert: false });
  if (result.error) throw new ApiError(400, "browser_session_invalid", "浏览器 Session 标识无效。");
  return result.value as string;
}

function readProvider(value: unknown): BrowserProviderId {
  const result = providerQuerySchema.validate({ providerId: value }, { convert: false });
  if (result.error) throw new ApiError(400, "browser_provider_invalid", "浏览器提供方无效。");
  return (result.value as { providerId: BrowserProviderId }).providerId;
}

function readDockProvider(value: unknown): BrowserProviderId {
  const result = dockProviderQuerySchema.validate({ providerId: value }, { convert: false });
  if (result.error) throw new ApiError(400, "browser_dock_provider_invalid", "LFAA 浏览器工作区只支持本机隔离浏览器。");
  return (result.value as { providerId: BrowserProviderId }).providerId;
}

function assertProviderLinked(userId: string, providerId: BrowserProviderId): void {
  const settings = getUserSettings(userId);
  if (!settings.browserUse.enabled) throw new ApiError(403, "browser_use_disabled", "Agent 浏览器控制已在设置中心关闭。");
  if (providerId === "tabbit-personal") {
    if (!settings.browserUse.enabledProviderIds.includes(providerId)) throw new ApiError(403, "browser_provider_not_connected", "Tabbit 个人浏览器尚未由用户明确选择并接入。");
    if (!settings.computerControl.enabled) throw new ApiError(403, "browser_personal_control_disabled", "个人浏览器会话需要在设置中心启用电脑操控。");
  }
}

function assertProviderAvailable(manager: BrowserSessionManager, providerId: BrowserProviderId): void {
  const provider = manager.listProviders().find(item => item.id === providerId);
  if (!provider?.available) throw new ApiError(503, "browser_dock_provider_unavailable", provider?.reason ?? "当前 LFAA Host 没有可用的隔离浏览器。");
}

function assertDockProviderAvailable(manager: BrowserSessionManager, providerId: BrowserProviderId): void {
  assertProviderAvailable(manager, providerId);
}

function registerRoutes(router: Router, manager: BrowserSessionManager): void {
  const auth = [requireAuthentication];
  const actionLimit = createRateLimit(600, 60_000);
  router.get("/browser/recent-sites", ...auth, (request, response) => {
    const result = recentSitesQuerySchema.validate(request.query);
    if (result.error) throw new ApiError(400, "browser_recent_sites_query_invalid", "最近网站查询范围无效。");
    const { limit } = result.value as { limit: number };
    response.json({ sites: manager.getRecentSites(request.auth!.user.id, limit) });
  });
  router.post("/browser/recent-sites", ...auth, actionLimit, asyncHandler(async (request, response) => {
    const body = parseBody<{ urls: string[] }>(recentSitesBodySchema, request.body);
    response.json({ recorded: manager.recordRecentSites(request.auth!.user.id, body.urls) });
  }));
  router.delete("/browser/recent-sites", ...auth, actionLimit, (_request, response) => {
    manager.clearRecentSites(_request.auth!.user.id);
    response.json({ cleared: true });
  });
  router.get("/browser/providers", ...auth, (_request, response) => response.json({ providers: manager.listProviders(), personalBrowsersInspected: false }));
  router.post("/browser/providers/tabbit-personal/connect", ...auth, actionLimit, asyncHandler(async (request, response) => {
    const body = parseBody<{ sourceSessionId: string }>(tabbitConnectSchema, request.body);
    const ownerId = request.auth!.user.id;
    if (!getUserSettings(ownerId).computerControl.enabled) throw new ApiError(403, "browser_personal_control_disabled", "请先在设置中心启用电脑操控，再连接 Tabbit 个人会话。");
    const tabs = await manager.listTabs(ownerId, body.sourceSessionId, "tabbit-personal");
    const current = getUserSettings(ownerId);
    const enabledProviderIds: BrowserProviderId[] = current.browserUse.enabledProviderIds.includes("tabbit-personal")
      ? [...current.browserUse.enabledProviderIds]
      : [...current.browserUse.enabledProviderIds, "tabbit-personal"];
    saveUserSettings(ownerId, "browser-use", { ...current.browserUse, enabledProviderIds });
    response.json({ tabs, settings: getUserSettings(ownerId) });
  }));

  // 用户在 Browser Dock 里的手动浏览不要求开启 Agent Browser Use；Agent 专用路由仍保留下方 Provider 设置门禁。
  router.get("/browser/dock/sessions/:sourceSessionId", ...auth, asyncHandler(async (request, response) => {
    const sourceSessionId = readSessionId(request.params.sourceSessionId);
    const providerId = readDockProvider(request.query.providerId);
    assertDockProviderAvailable(manager, providerId);
    const session = await manager.getPanelSnapshot(request.auth!.user.id, sourceSessionId, providerId, true, false);
    response.json({ session });
  }));
  router.get("/browser/dock/sessions/:sourceSessionId/wait", ...auth, asyncHandler(async (request, response) => {
    const sourceSessionId = readSessionId(request.params.sourceSessionId);
    const result = dockRevisionWaitSchema.validate(request.query);
    if (result.error) throw new ApiError(400, "browser_dock_revision_invalid", "浏览器页面修订号无效。");
    const { providerId, revision } = result.value as { providerId: BrowserProviderId; revision: number };
    assertDockProviderAvailable(manager, providerId);
    const controller = new AbortController();
    const cancel = () => { if (!response.writableEnded) controller.abort(); };
    response.once("close", cancel);
    try {
      const session = await manager.waitForPanelRevision(request.auth!.user.id, sourceSessionId, providerId, revision, controller.signal);
      if (!response.writableEnded) response.json({ session });
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    } finally {
      response.off("close", cancel);
    }
  }));
  router.get("/browser/dock/sessions/:sourceSessionId/revision", ...auth, asyncHandler(async (request, response) => {
    const sourceSessionId = readSessionId(request.params.sourceSessionId);
    const providerId = readDockProvider(request.query.providerId);
    assertDockProviderAvailable(manager, providerId);
    const session = await manager.getPanelRevision(request.auth!.user.id, sourceSessionId, providerId);
    response.json({ session });
  }));
  router.post("/browser/dock/sessions/:sourceSessionId/navigate", ...auth, actionLimit, asyncHandler(async (request, response) => {
    const sourceSessionId = readSessionId(request.params.sourceSessionId);
    const body = parseBody<{ providerId: BrowserProviderId; url: string }>(navigateSchema, request.body);
    readDockProvider(body.providerId);
    assertDockProviderAvailable(manager, body.providerId);
    let session;
    try {
      session = await manager.navigate(request.auth!.user.id, sourceSessionId, body.providerId, body.url, undefined, false, false);
    } catch (error) {
      if (error instanceof BrowserNavigationTargetError) throw new ApiError(400, "browser_target_unsafe", error.message);
      throw error;
    }
    response.json({ session });
  }));
  router.post("/browser/dock/sessions/:sourceSessionId/viewport", ...auth, actionLimit, asyncHandler(async (request, response) => {
    const sourceSessionId = readSessionId(request.params.sourceSessionId);
    const body = parseBody<{ providerId: BrowserProviderId; width: number; height: number }>(viewportSchema, request.body);
    assertDockProviderAvailable(manager, body.providerId);
    const session = await manager.resizeViewport(request.auth!.user.id, sourceSessionId, body.providerId, body.width, body.height);
    response.json({ session });
  }));
  router.post("/browser/dock/sessions/:sourceSessionId/action", ...auth, actionLimit, asyncHandler(async (request, response) => {
    const sourceSessionId = readSessionId(request.params.sourceSessionId);
    const body = parseBody<{ providerId: BrowserProviderId; action: "back" | "forward" | "reload" | "clickAt" | "dragAt" | "typeText" | "pressKey" | "scroll"; x?: number; y?: number; points?: Array<{ x: number; y: number; delayMs: number }>; text?: string; key?: string; direction?: "up" | "down"; amount?: number; includeScreenshot?: boolean }>(actionSchema, request.body);
    const providerId = readDockProvider(body.providerId);
    assertDockProviderAvailable(manager, providerId);
    const fieldsByAction: Record<typeof body.action, string[]> = {
      back: [], forward: [], reload: [], clickAt: ["x", "y"], dragAt: ["x", "y", "points"], typeText: ["text"], pressKey: ["key"], scroll: ["direction", "amount"]
    };
    const allowedFields = new Set(["providerId", "action", "includeScreenshot", ...fieldsByAction[body.action]]);
    if (Object.keys(body).some(key => !allowedFields.has(key)) || fieldsByAction[body.action].some(key => body[key as keyof typeof body] === undefined)) {
      throw new ApiError(400, "browser_action_invalid", "浏览器交互参数与动作不匹配。");
    }
    const ownerId = request.auth!.user.id;
    const includeScreenshot = body.includeScreenshot === true;
    const session = body.action === "back" ? await manager.back(ownerId, sourceSessionId, providerId, undefined, false, includeScreenshot)
      : body.action === "forward" ? await manager.forward(ownerId, sourceSessionId, providerId, undefined, false, includeScreenshot)
        : body.action === "reload" ? await manager.reload(ownerId, sourceSessionId, providerId, undefined, false, includeScreenshot)
          : body.action === "clickAt" ? await manager.clickAt(ownerId, sourceSessionId, providerId, body.x!, body.y!, undefined, false, includeScreenshot)
            : body.action === "dragAt" ? await manager.dragAt(ownerId, sourceSessionId, providerId, body.x!, body.y!, body.points!, undefined, false, includeScreenshot)
              : body.action === "typeText" ? await manager.typeText(ownerId, sourceSessionId, providerId, body.text!, undefined, includeScreenshot, false)
                : body.action === "pressKey" ? await manager.pressKey(ownerId, sourceSessionId, providerId, body.key!, undefined, includeScreenshot, false)
                  : await manager.scroll(ownerId, sourceSessionId, providerId, body.direction!, body.amount!, undefined, includeScreenshot, false);
    response.json({ session });
  }));
  router.delete("/browser/dock/sessions/:sourceSessionId", ...auth, actionLimit, asyncHandler(async (request, response) => {
    const sourceSessionId = readSessionId(request.params.sourceSessionId);
    const providerId = readDockProvider(request.query.providerId);
    assertDockProviderAvailable(manager, providerId);
    await manager.closeSession(request.auth!.user.id, sourceSessionId, providerId);
    response.json({ closed: true });
  }));

  router.get("/browser/tabs/:sourceSessionId", ...auth, asyncHandler(async (request, response) => {
    const sourceSessionId = readSessionId(request.params.sourceSessionId);
    const providerId = readProvider(request.query.providerId);
    assertProviderLinked(request.auth!.user.id, providerId);
    const tabs = await manager.listTabs(request.auth!.user.id, sourceSessionId, providerId);
    response.json({ tabs });
  }));
  router.get("/browser/sessions/:sourceSessionId", ...auth, asyncHandler(async (request, response) => {
    const sourceSessionId = readSessionId(request.params.sourceSessionId);
    const providerId = readProvider(request.query.providerId);
    assertProviderLinked(request.auth!.user.id, providerId);
    const session = await manager.getPanelSnapshot(request.auth!.user.id, sourceSessionId, providerId, true);
    response.json({ session });
  }));
  router.get("/browser/sessions/:sourceSessionId/revision", ...auth, asyncHandler(async (request, response) => {
    const sourceSessionId = readSessionId(request.params.sourceSessionId);
    const providerId = readProvider(request.query.providerId);
    assertProviderLinked(request.auth!.user.id, providerId);
    const session = await manager.getPanelRevision(request.auth!.user.id, sourceSessionId, providerId);
    response.json({ session });
  }));
  router.post("/browser/sessions/:sourceSessionId/native-active", ...auth, actionLimit, asyncHandler(async (request, response) => {
    const sourceSessionId = readSessionId(request.params.sourceSessionId);
    const body = parseBody<{ providerId: BrowserProviderId; targetId: string }>(nativeActiveTargetSchema, request.body);
    assertProviderAvailable(manager, body.providerId);
    await manager.setNativeActiveTarget(request.auth!.user.id, sourceSessionId, body.targetId);
    response.json({ active: true });
  }));
  router.post("/browser/sessions/:sourceSessionId/navigate", ...auth, actionLimit, asyncHandler(async (request, response) => {
    const sourceSessionId = readSessionId(request.params.sourceSessionId);
    const body = parseBody<{ providerId: BrowserProviderId; url: string }>(navigateSchema, request.body);
    assertProviderLinked(request.auth!.user.id, body.providerId);
    let session;
    try {
      session = await manager.navigate(request.auth!.user.id, sourceSessionId, body.providerId, body.url);
    } catch (error) {
      if (error instanceof BrowserNavigationTargetError) throw new ApiError(400, "browser_target_unsafe", error.message);
      throw error;
    }
    response.json({ session });
  }));
  router.post("/browser/sessions/:sourceSessionId/viewport", ...auth, actionLimit, asyncHandler(async (request, response) => {
    const sourceSessionId = readSessionId(request.params.sourceSessionId);
    const body = parseBody<{ providerId: BrowserProviderId; width: number; height: number }>(viewportSchema, request.body);
    assertProviderLinked(request.auth!.user.id, body.providerId);
    const session = await manager.resizeViewport(request.auth!.user.id, sourceSessionId, body.providerId, body.width, body.height);
    response.json({ session });
  }));
  router.post("/browser/sessions/:sourceSessionId/claim", ...auth, actionLimit, asyncHandler(async (request, response) => {
    const sourceSessionId = readSessionId(request.params.sourceSessionId);
    const body = parseBody<{ providerId: BrowserProviderId; tabId: number }>(claimSchema, request.body);
    assertProviderLinked(request.auth!.user.id, body.providerId);
    const session = await manager.claimTab(request.auth!.user.id, sourceSessionId, body.providerId, body.tabId);
    response.json({ session });
  }));
  router.post("/browser/sessions/:sourceSessionId/action", ...auth, actionLimit, asyncHandler(async (request, response) => {
    const sourceSessionId = readSessionId(request.params.sourceSessionId);
      const body = parseBody<{ providerId: BrowserProviderId; action: "back" | "forward" | "reload" | "clickAt" | "dragAt" | "typeText" | "pressKey" | "scroll"; x?: number; y?: number; points?: Array<{ x: number; y: number; delayMs: number }>; text?: string; key?: string; direction?: "up" | "down"; amount?: number; includeScreenshot?: boolean }>(actionSchema, request.body);
    assertProviderLinked(request.auth!.user.id, body.providerId);
    const fieldsByAction: Record<typeof body.action, string[]> = {
        back: [], forward: [], reload: [], clickAt: ["x", "y"], dragAt: ["x", "y", "points"], typeText: ["text"], pressKey: ["key"], scroll: ["direction", "amount"]
    };
    const allowedFields = new Set(["providerId", "action", "includeScreenshot", ...fieldsByAction[body.action]]);
    if (Object.keys(body).some(key => !allowedFields.has(key)) || fieldsByAction[body.action].some(key => body[key as keyof typeof body] === undefined)) {
      throw new ApiError(400, "browser_action_invalid", "浏览器交互参数与动作不匹配。");
    }
    const ownerId = request.auth!.user.id;
    const includeScreenshot = body.includeScreenshot !== false;
    const session = body.action === "back" ? await manager.back(ownerId, sourceSessionId, body.providerId)
      : body.action === "forward" ? await manager.forward(ownerId, sourceSessionId, body.providerId)
        : body.action === "reload" ? await manager.reload(ownerId, sourceSessionId, body.providerId)
          : body.action === "clickAt" ? await manager.clickAt(ownerId, sourceSessionId, body.providerId, body.x!, body.y!)
            : body.action === "dragAt" ? await manager.dragAt(ownerId, sourceSessionId, body.providerId, body.x!, body.y!, body.points!)
              : body.action === "typeText" ? await manager.typeText(ownerId, sourceSessionId, body.providerId, body.text!, undefined, includeScreenshot)
              : body.action === "pressKey" ? await manager.pressKey(ownerId, sourceSessionId, body.providerId, body.key!, undefined, includeScreenshot)
                : await manager.scroll(ownerId, sourceSessionId, body.providerId, body.direction!, body.amount!, undefined, includeScreenshot);
    response.json({ session });
  }));
  router.delete("/browser/sessions/:sourceSessionId", ...auth, actionLimit, asyncHandler(async (request, response) => {
    const sourceSessionId = readSessionId(request.params.sourceSessionId);
    const providerId = readProvider(request.query.providerId);
    assertProviderLinked(request.auth!.user.id, providerId);
    await manager.closeSession(request.auth!.user.id, sourceSessionId, providerId);
    response.json({ closed: true });
  }));
  router.delete("/browser/providers/:providerId/sessions", ...auth, actionLimit, asyncHandler(async (request, response) => {
    const providerId = readProvider(request.params.providerId);
    const ownerId = request.auth!.user.id;
    if (providerId === "tabbit-personal" && !getUserSettings(ownerId).browserUse.enabledProviderIds.includes(providerId)) throw new ApiError(403, "browser_provider_not_connected", "Tabbit 个人浏览器尚未由用户明确选择并接入。");
    await manager.closeProviderSessions(ownerId, providerId);
    response.json({ closed: true });
  }));
}

export const name = "lfaa-api-browser-controller";
export const inject = ["apiGateway", "lfaaBrowser"];

export function apply(ctx: Context): void {
  ctx.apiGateway.register(ctx, "browser-controller", router => registerRoutes(router, ctx.lfaaBrowser));
}
