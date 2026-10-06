/**
 * LFAA Windows desktop Profile adapter for the in-process Cua Driver SDK.
 * Screenshots are transient model input; never include them in persisted tool records.
 */
import type { Context } from "@deepseek-ai/cordis";
import Joi from "joi";
import { createHash } from "node:crypto";
import { getUserSettings } from "lfaa-settings/src/service.js";
import type { AiBusinessTool, AiBusinessToolContext } from "lfaa-tools/src/business-tools.js";
import type { CuaDriverLike, ToolResult } from "@trycua/cua-driver";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";

const MAX_IMAGE_DIMENSION = 1280;
const MAX_IMAGE_BASE64_LENGTH = 4 * 1024 * 1024;
const MAX_TYPED_TEXT_LENGTH = 4000;
const DESKTOP_PROFILE = "desktop";
const OBSERVATION_MAX_AGE_MS = 60_000;

type ComputerUseParameters = Record<string, unknown>;
type CuaDriverModule = typeof import("@trycua/cua-driver");
type ObservationState = { observationFresh: boolean; observedAt: number; desktopRevision: number; cleanupRegistered: boolean };

interface ComputerUseRuntimeOptions {
  platform?: string;
  desktopMode?: boolean;
  isEnabledForUser?: (userId: string) => boolean;
}

function createDriverRuntime(module: CuaDriverModule) {
  let driverPromise: Promise<CuaDriverLike> | null = null;
  let driverClosing = false;
  let operationTail: Promise<void> = Promise.resolve();
  let desktopRevision = 0;
  const observationStates = new Map<string, ObservationState>();

  const stateForRun = (context: AiBusinessToolContext): ObservationState => {
    if (!context.agentRunId) throw new Error("当前 Agent Run 缺少隔离标识；已拒绝电脑操控。");
    let state = observationStates.get(context.agentRunId);
    if (!state) {
      state = { observationFresh: false, observedAt: 0, desktopRevision: -1, cleanupRegistered: false };
      observationStates.set(context.agentRunId, state);
    }
    if (!state.cleanupRegistered) {
      state.cleanupRegistered = true;
      context.onRunDispose?.(() => observationStates.delete(context.agentRunId));
    }
    return state;
  };

  const runDriverOperation = <T>(operation: () => Promise<T>): Promise<T> => {
    if (driverClosing) return Promise.reject(new Error("本机桌面驱动正在关闭；已拒绝新操作。"));
    const current = operationTail.then(() => {
      if (driverClosing) throw new Error("本机桌面驱动正在关闭；已拒绝新操作。");
      return operation();
    });
    operationTail = current.then(() => undefined, () => undefined);
    return current;
  };

  const getDriver = async (): Promise<CuaDriverLike> => {
    if (driverClosing) throw new Error("本机桌面驱动正在关闭；已拒绝新操作。");
    if (!driverPromise) {
      driverPromise = Promise.resolve().then(() => module.CuaDriver.create(undefined)).catch(error => {
        driverPromise = null;
        throw new Error(`本机 CUA Driver 初始化失败：${error instanceof Error ? error.message : String(error)}`);
      });
    }
    const driver = await driverPromise;
    if (!driver.isAvailable()) throw new Error("本机 CUA Driver 在此 Windows 会话中不可用。");
    return driver;
  };

  return {
    stateForRun,
    runDriverOperation,
    getDriver,
    getDesktopRevision: () => desktopRevision,
    markDesktopMutation: () => { desktopRevision += 1; },
    async dispose(): Promise<void> {
      driverClosing = true;
      await operationTail.catch(() => undefined);
      observationStates.clear();
      const current = driverPromise;
      driverPromise = null;
      if (!current) return;
      try {
        const driver = await current;
        try { await driver.shutdown(); } finally {
          if ("uniffiDestroy" in driver && typeof driver.uniffiDestroy === "function") driver.uniffiDestroy();
        }
      } catch { /* 驱动初始化失败时仍允许 Profile 正常卸载。 */ }
    }
  };
}

function parse(schema: Joi.ObjectSchema, value: unknown): ComputerUseParameters {
  const result = schema.validate(value, { abortEarly: false, convert: false, allowUnknown: false, stripUnknown: false });
  if (result.error || typeof result.value !== "object" || result.value === null || Array.isArray(result.value)) {
    throw new Error(result.error?.details.map(detail => detail.message).join("；") ?? "电脑操控参数必须是 JSON 对象。");
  }
  return result.value as ComputerUseParameters;
}

function jsonSchema(properties: Record<string, unknown>, required: string[] = []): Record<string, unknown> {
  return { type: "object", properties, required, additionalProperties: false };
}

function parametersDigest(name: string, parameters: ComputerUseParameters): string {
  return createHash("sha256").update(JSON.stringify([name, parameters])).digest("hex");
}

function makeTool(input: {
  id: string;
  name: string;
  description: string;
  properties: Record<string, unknown>;
  required?: string[];
  parser: Joi.ObjectSchema;
  risk: "read" | "dangerous";
  execute: (parameters: ComputerUseParameters, context: AiBusinessToolContext) => Promise<unknown>;
}): AiBusinessTool {
  return {
    id: `computer-use.${input.id}`,
    name: input.name,
    coreManaged: true,
    requiresComputerControl: true,
    description: input.description,
    applicationIds: [...APPLICATION_IDS],
    schema: jsonSchema(input.properties, input.required),
    risk: () => input.risk,
    approval: parameters => ({
      scopeKey: `computer-use:${parametersDigest(input.name, parameters)}`,
      scopeSummary: "当前 Windows 桌面的主显示器",
      summary: input.name === "computer_use_type_text" ? "向当前桌面输入模型拟定的文本（内容不会出现在审批说明中）"
        : input.name === "computer_use_click" ? `点击屏幕坐标 (${String(parameters.x)}, ${String(parameters.y)})`
          : input.name === "computer_use_scroll" ? `在屏幕坐标 (${String(parameters.x)}, ${String(parameters.y)}) 向${String(parameters.direction)}滚动`
            : input.name === "computer_use_hotkey" ? `向当前桌面发送快捷键：${(parameters.keys as string[]).join("+")}`
              : input.description
    }),
    parse: value => parse(input.parser, value),
    execute: input.execute
  };
}

function readImages(result: ToolResult): Array<{ mimeType: string; dataBase64: string }> {
  if (result.isError) throw new Error(result.text || "本机桌面驱动无法读取屏幕。");
  if (result.images.length !== 1) throw new Error("本机桌面驱动没有返回唯一屏幕截图，已停止向模型发送画面。");
  const image = result.images[0];
  if (!image || !["image/png", "image/jpeg", "image/webp"].includes(image.mimeType)) throw new Error("屏幕截图格式不是受支持的 PNG、JPEG 或 WebP。");
  if (!image.dataBase64 || image.dataBase64.length > MAX_IMAGE_BASE64_LENGTH || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(image.dataBase64)) {
    throw new Error("屏幕截图为空、过大或编码无效；已停止向模型发送画面。");
  }
  return [{ mimeType: image.mimeType, dataBase64: image.dataBase64 }];
}

function confirmRuntimeAccess(profile: { name: string }, context: AiBusinessToolContext, options: Required<ComputerUseRuntimeOptions>): void {
  if (options.platform !== "win32" || !options.desktopMode || profile.name !== DESKTOP_PROFILE) {
    throw new Error("本机电脑操控仅在 Windows 桌面 Profile 中可用。");
  }
  if (!options.isEnabledForUser(context.userId)) throw new Error("请先在设置中心启用本机电脑操控。");
}

function observeTool(profile: { name: string }, module: CuaDriverModule, runtime: ReturnType<typeof createDriverRuntime>, options: Required<ComputerUseRuntimeOptions>): AiBusinessTool {
  return makeTool({
    id: "observe",
    name: "computer_use_observe",
    description: "捕获当前 Windows 主显示器的一张屏幕图像，供本轮模型理解界面；每次输入动作前都必须先调用。",
    properties: {},
    parser: Joi.object({}).unknown(false),
    risk: "read",
    execute: async (_parameters, context) => {
      confirmRuntimeAccess(profile, context, options);
      const state = runtime.stateForRun(context);
      state.observationFresh = false;
      const driver = await runtime.getDriver();
      const result = await runtime.runDriverOperation(() => driver.getDesktopState(module.GetDesktopStateInput.new({ maxImageDimension: MAX_IMAGE_DIMENSION }), { signal: context.signal }));
      const images = readImages(result);
      state.observationFresh = true;
      state.observedAt = Date.now();
      state.desktopRevision = runtime.getDesktopRevision();
      return { images, screenshotForwarded: true, screenshotPersisted: false, imageDimensionLimit: MAX_IMAGE_DIMENSION };
    }
  });
}

function actionTools(profile: { name: string }, module: CuaDriverModule, runtime: ReturnType<typeof createDriverRuntime>, options: Required<ComputerUseRuntimeOptions>): AiBusinessTool[] {
  const target = () => module.ActionTarget.Desktop.new({ displayId: "primary" });
  const beforeAction = async (context: AiBusinessToolContext): Promise<{ driver: CuaDriverLike; state: ObservationState }> => {
    confirmRuntimeAccess(profile, context, options);
    const state = runtime.stateForRun(context);
    if (!state.observationFresh || Date.now() - state.observedAt > OBSERVATION_MAX_AGE_MS || state.desktopRevision !== runtime.getDesktopRevision()) {
      state.observationFresh = false;
      throw new Error("执行鼠标或键盘操作前，必须先观察最近 60 秒内且未被其他桌面操作改变的屏幕；每次操作后也要重新观察并核对结果。");
    }
    const driver = await runtime.getDriver();
    return { driver, state };
  };
  const performAction = async <T>(context: AiBusinessToolContext, operation: (driver: CuaDriverLike) => Promise<T>): Promise<T> => {
    const { driver, state } = await beforeAction(context);
    return runtime.runDriverOperation(async () => {
      if (!state.observationFresh || Date.now() - state.observedAt > OBSERVATION_MAX_AGE_MS || state.desktopRevision !== runtime.getDesktopRevision()) {
        state.observationFresh = false;
        throw new Error("屏幕状态在操作前已变化或过期；请重新观察，再决定是否操作。");
      }
      state.observationFresh = false;
      try {
        return await operation(driver);
      } finally {
        runtime.markDesktopMutation();
      }
    });
  };
  const actionResult = (value: ToolResult) => ({ text: value.text, isError: value.isError, ...(value.errorCode ? { errorCode: value.errorCode } : {}), ...(value.structuredJson ? { structuredJson: value.structuredJson } : {}) });
  return [
    makeTool({
      id: "click", name: "computer_use_click",
      description: "在最近一次屏幕截图的坐标位置单击、右击或双击；只使用截图中的坐标。",
      properties: { x: { type: "integer", minimum: 0, maximum: 100000 }, y: { type: "integer", minimum: 0, maximum: 100000 }, button: { type: "string", enum: ["left", "right", "middle"] }, count: { type: "integer", minimum: 1, maximum: 2 } }, required: ["x", "y"],
      parser: Joi.object({ x: Joi.number().integer().min(0).max(100000).required(), y: Joi.number().integer().min(0).max(100000).required(), button: Joi.string().valid("left", "right", "middle").default("left"), count: Joi.number().integer().min(1).max(2).default(1) }).unknown(false), risk: "dangerous",
      execute: async (parameters, context) => {
        const button = parameters.button === "right" ? module.ClickButton.Right : parameters.button === "middle" ? module.ClickButton.Middle : module.ClickButton.Left;
        const outcome = await performAction(context, driver => driver.click(module.ClickInput.new({ target: target(), position: module.ClickPosition.Coordinates.new({ x: Number(parameters.x), y: Number(parameters.y) }), deliveryMode: module.InputDeliveryMode.Foreground, button, count: Number(parameters.count) }), { signal: context.signal }));
        const effect = ({ 0: "confirmed", 1: "partial", 2: "unverifiable", 3: "suspected_noop", 4: "refused" } as Record<number, string>)[outcome.effect] ?? "unknown";
        return { effect, ...(outcome.summary ? { summary: outcome.summary } : {}), ...(outcome.error ? { error: outcome.error } : {}), isError: effect === "refused", verificationRequired: true };
      }
    }),
    makeTool({
      id: "type-text", name: "computer_use_type_text",
      description: "在当前前景焦点中输入非敏感文本；不要代填密码、验证码、支付资料、API 密钥或其他秘密。",
      properties: { text: { type: "string", minLength: 1, maxLength: MAX_TYPED_TEXT_LENGTH } }, required: ["text"],
      parser: Joi.object({ text: Joi.string().min(1).max(MAX_TYPED_TEXT_LENGTH).required() }).unknown(false), risk: "dangerous",
      execute: async (parameters, context) => actionResult(await performAction(context, driver => driver.typeText(module.TypeTextInput.new({ text: String(parameters.text), target: target() }), { signal: context.signal })))
    }),
    makeTool({
      id: "hotkey", name: "computer_use_hotkey",
      description: "向当前 Windows 桌面发送一组快捷键；必须先观察屏幕并确认组合键适合当前任务。",
      properties: { keys: { type: "array", items: { type: "string", minLength: 1, maxLength: 24, pattern: "^[A-Za-z0-9+ _.-]+$" }, minItems: 1, maxItems: 6, uniqueItems: true } }, required: ["keys"],
      parser: Joi.object({ keys: Joi.array().items(Joi.string().trim().min(1).max(24).pattern(/^[A-Za-z0-9+ _.-]+$/u)).min(1).max(6).unique().required() }).unknown(false), risk: "dangerous",
      execute: async (parameters, context) => actionResult(await performAction(context, driver => driver.hotkey(module.HotkeyInput.new({ keys: parameters.keys as string[], target: target() }), { signal: context.signal })))
    }),
    makeTool({
      id: "scroll", name: "computer_use_scroll",
      description: "在最近一次屏幕截图的坐标附近滚动少量内容。",
      properties: { x: { type: "integer", minimum: 0, maximum: 100000 }, y: { type: "integer", minimum: 0, maximum: 100000 }, direction: { type: "string", enum: ["up", "down", "left", "right"] }, amount: { type: "integer", minimum: 1, maximum: 10 } }, required: ["x", "y", "direction"],
      parser: Joi.object({ x: Joi.number().integer().min(0).max(100000).required(), y: Joi.number().integer().min(0).max(100000).required(), direction: Joi.string().valid("up", "down", "left", "right").required(), amount: Joi.number().integer().min(1).max(10).default(3) }).unknown(false), risk: "dangerous",
      execute: async (parameters, context) => actionResult(await performAction(context, driver => {
        const direction = ({ up: module.ScrollDirection.Up, down: module.ScrollDirection.Down, left: module.ScrollDirection.Left, right: module.ScrollDirection.Right } as const)[parameters.direction as "up" | "down" | "left" | "right"];
        return driver.scroll(module.ScrollInput.new({ x: Number(parameters.x), y: Number(parameters.y), direction, amount: BigInt(Number(parameters.amount)), target: target() }), { signal: context.signal });
      }))
    })
  ];
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    lfaaTools: typeof import("lfaa-tools/src/business-tools.js") & { registerTool: typeof import("lfaa-tools/src/registry.js").registerAiBusinessTool };
    profileContext: { name: string };
  }
}

export const name = "lfaa-computer-use";
export const inject = ["profileContext", "lfaaTools"];

export function registerComputerUseTools(ctx: Context, profile: { name: string }, module: CuaDriverModule, runtimeOverrides: ComputerUseRuntimeOptions = {}): void {
  const options: Required<ComputerUseRuntimeOptions> = {
    platform: runtimeOverrides.platform ?? process.platform,
    desktopMode: runtimeOverrides.desktopMode ?? process.env.LFAA_DESKTOP_MODE === "true",
    isEnabledForUser: runtimeOverrides.isEnabledForUser ?? (userId => getUserSettings(userId).computerControl.enabled)
  };
  if (options.platform !== "win32" || !options.desktopMode || profile.name !== DESKTOP_PROFILE) return;
  const runtime = createDriverRuntime(module);
  (ctx.lfaaTools as typeof import("lfaa-tools/src/business-tools.js") & { registerTool: typeof import("lfaa-tools/src/registry.js").registerAiBusinessTool }).registerTool(ctx, observeTool(profile, module, runtime, options));
  for (const tool of actionTools(profile, module, runtime, options)) {
    (ctx.lfaaTools as typeof import("lfaa-tools/src/business-tools.js") & { registerTool: typeof import("lfaa-tools/src/registry.js").registerAiBusinessTool }).registerTool(ctx, tool);
  }
  ctx.effect(() => () => runtime.dispose(), "lfaa-computer-use-driver-lifecycle");
}

export async function apply(ctx: Context): Promise<void> {
  if (process.platform !== "win32" || process.env.LFAA_DESKTOP_MODE !== "true" || ctx.profileContext.name !== DESKTOP_PROFILE) return;
  // Cua Driver telemetry is opt-out upstream; disable it for this embedded runtime unless the host explicitly set it.
  process.env.CUA_DRIVER_RS_TELEMETRY_ENABLED ??= "false";
  const module = await import("@trycua/cua-driver");
  registerComputerUseTools(ctx, ctx.profileContext, module);
}
