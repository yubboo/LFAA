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
import { config } from "lfaa-launch-environment/src/config.js";
import { createLocalAppsRuntime, type LocalAppsRuntimeOptions } from "./local-apps.js";

const MAX_IMAGE_DIMENSION = 1280;
const MAX_IMAGE_BASE64_LENGTH = 4 * 1024 * 1024;
const MAX_TYPED_TEXT_LENGTH = 4000;
const DESKTOP_PROFILE = "desktop";
const WEB_PROFILE = "web";
const OBSERVATION_MAX_AGE_MS = 60_000;

type ComputerUseParameters = Record<string, unknown>;
type CuaDriverModule = typeof import("@trycua/cua-driver");
type ObservationState = { observationFresh: boolean; observedAt: number; desktopRevision: number; cleanupRegistered: boolean; windows: Set<string> };

interface ComputerUseRuntimeOptions {
  platform?: string;
  desktopMode?: boolean;
  localWebMode?: boolean;
  isEnabledForUser?: (userId: string) => boolean;
  localApps?: LocalAppsRuntimeOptions;
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
      state = { observationFresh: false, observedAt: 0, desktopRevision: -1, cleanupRegistered: false, windows: new Set() };
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
  approval?: (parameters: ComputerUseParameters) => { scopeKey: string; scopeSummary: string; summary: string };
  execute: (parameters: ComputerUseParameters, context: AiBusinessToolContext) => Promise<unknown>;
}): AiBusinessTool {
  const targetsWindow = input.id === "type-text" || input.id === "hotkey";
  const properties = targetsWindow ? { ...input.properties, pid: { type: "integer", minimum: 1 }, windowId: { type: "string", pattern: "^[1-9][0-9]{0,19}$", description: "从最近观察返回的窗口清单原样选择；应用内输入须与 pid 一起提供，避免审批页面抢焦点。" } } : input.properties;
  const parser = targetsWindow ? input.parser.keys({ pid: Joi.number().integer().min(1), windowId: Joi.string().pattern(/^[1-9][0-9]{0,19}$/u) }).and("pid", "windowId") : input.parser;
  return {
    id: `computer-use.${input.id}`,
    name: input.name,
    coreManaged: true,
    requiresComputerControl: true,
    description: input.description,
    applicationIds: [...APPLICATION_IDS],
    schema: jsonSchema(properties, input.required),
    risk: () => input.risk,
    approval: parameters => input.approval?.(parameters) ?? ({
      scopeKey: `computer-use:${parametersDigest(input.name, parameters)}`,
      scopeSummary: "当前 Windows 桌面的主显示器",
      summary: input.name === "computer_use_type_text" ? "向当前桌面输入模型拟定的文本（内容不会出现在审批说明中）"
        : input.name === "computer_use_click" ? `点击屏幕坐标 (${String(parameters.x)}, ${String(parameters.y)})`
          : input.name === "computer_use_scroll" ? `在屏幕坐标 (${String(parameters.x)}, ${String(parameters.y)}) 向${String(parameters.direction)}滚动`
            : input.name === "computer_use_hotkey" ? `向当前桌面发送快捷键：${(parameters.keys as string[]).join("+")}`
              : input.description
    }),
    parse: value => parse(parser, value),
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

function isSupportedProfile(profile: { name: string }, options: Required<ComputerUseRuntimeOptions>): boolean {
  return options.platform === "win32"
    && (options.desktopMode && profile.name === DESKTOP_PROFILE || options.localWebMode && profile.name === WEB_PROFILE);
}

function confirmRuntimeAccess(profile: { name: string }, context: AiBusinessToolContext, options: Required<ComputerUseRuntimeOptions>): void {
  if (!isSupportedProfile(profile, options)) {
    throw new Error("本机电脑操控仅在 Windows 桌面 App 或绑定 loopback 的本机 Web Profile 中可用。");
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
      const { result, windows } = await runtime.runDriverOperation(async () => {
        const result = await driver.getDesktopState(module.GetDesktopStateInput.new({ maxImageDimension: MAX_IMAGE_DIMENSION }), { signal: context.signal });
        const windows = module.ListWindowsInput && typeof driver.listWindows === "function"
          ? (await driver.listWindows(module.ListWindowsInput.new({ onScreenOnly: true }), { signal: context.signal })).windows.filter(window => window.pid && window.isOnScreen).slice(0, 128).map(window => ({ pid: window.pid!, windowId: String(window.windowId), appName: window.appName.slice(0, 80), title: window.title.slice(0, 160), bounds: window.bounds })) : [];
        return { result, windows };
      });
      const images = readImages(result);
      state.windows = new Set(windows.map(window => `${window.pid}:${window.windowId}`));
      state.observationFresh = true;
      state.observedAt = Date.now();
      state.desktopRevision = runtime.getDesktopRevision();
      return { images, windows, screenshotForwarded: true, screenshotPersisted: false, imageDimensionLimit: MAX_IMAGE_DIMENSION };
    }
  });
}

function actionTools(profile: { name: string }, module: CuaDriverModule, runtime: ReturnType<typeof createDriverRuntime>, options: Required<ComputerUseRuntimeOptions>): AiBusinessTool[] {
  const target = (parameters?: ComputerUseParameters, context?: AiBusinessToolContext) => {
    if (parameters?.windowId && context) {
      if (!runtime.stateForRun(context).windows.has(`${parameters.pid}:${parameters.windowId}`)) throw new Error("目标窗口不在最近观察清单中；请重新观察并选择真实窗口。");
      return module.ActionTarget.Window.new({ pid: Number(parameters.pid), windowId: BigInt(String(parameters.windowId)) });
    }
    return module.ActionTarget.Desktop.new({ displayId: "primary" });
  };
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
      description: "向最近观察清单的指定 pid/windowId 窗口输入非敏感文本；省略时向桌面前景输入。应用内输入应指定窗口，以免审批页面抢焦点。仅处理当前用户目标涉及的输入；不要把敏感内容回显或写入记忆。",
      properties: { text: { type: "string", minLength: 1, maxLength: MAX_TYPED_TEXT_LENGTH } }, required: ["text"],
      parser: Joi.object({ text: Joi.string().min(1).max(MAX_TYPED_TEXT_LENGTH).required() }).unknown(false), risk: "dangerous",
      execute: async (parameters, context) => actionResult(await performAction(context, driver => driver.typeText(module.TypeTextInput.new({ text: String(parameters.text), target: target(parameters, context) }), { signal: context.signal })))
    }),
    makeTool({
      id: "hotkey", name: "computer_use_hotkey",
      description: "发送一组快捷键；应用内快捷键应提供最近观察清单的 pid/windowId，避免审批切换焦点后落到浏览器。Win+E 等系统快捷键可省略窗口目标。先观察并确认组合键适合当前任务。",
      properties: { keys: { type: "array", items: { type: "string", minLength: 1, maxLength: 24, pattern: "^[A-Za-z0-9+ _.-]+$" }, minItems: 1, maxItems: 6, uniqueItems: true } }, required: ["keys"],
      parser: Joi.object({ keys: Joi.array().items(Joi.string().trim().min(1).max(24).pattern(/^[A-Za-z0-9+ _.-]+$/u)).min(1).max(6).unique().required() }).unknown(false), risk: "dangerous",
      execute: async (parameters, context) => actionResult(await performAction(context, driver => driver.hotkey(module.HotkeyInput.new({ keys: parameters.keys as string[], target: target(parameters, context) }), { signal: context.signal })))
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

function localAppTools(profile: { name: string }, runtime: ReturnType<typeof createLocalAppsRuntime>, options: Required<ComputerUseRuntimeOptions>): AiBusinessTool[] {
  const querySchema = Joi.object({ query: Joi.string().trim().min(1).max(120).required() }).unknown(false);
  const emptySchema = Joi.object({}).unknown(false);
  const launchSchema = Joi.object({
    id: Joi.string().pattern(/^(?:steam:[1-9]\d{0,9}|(?:shortcut|appsfolder|registered|path|indexed):[a-f\d]{24})$/u),
    query: Joi.string().trim().min(1).max(120)
  }).xor("id", "query").unknown(false);
  const activeRunId = (context: AiBusinessToolContext): string => {
    if (!context.agentRunId) throw new Error("当前 Agent Run 缺少隔离标识；已拒绝本机应用操作。");
    const runId = context.agentRunId;
    context.onRunDispose?.(() => runtime.clearRun(context.userId, runId));
    return runId;
  };
  return [
    makeTool({
      id: "local-app-search",
      name: "computer_use_search_local_apps",
      description: "按名称或常见别名查询本机 Windows 应用和 Steam 游戏；可用 | 一次给出全名和简称。覆盖开始菜单、Windows 应用目录、已安装登记、PATH、Steam 与最多 2.5 秒的有界便携 EXE 查找。支持名称、首字母和文件夹别名，只返回名称与不透明 ID，不返回路径。用户明确要求启动且名称清楚时，直接用启动工具的 query 一次完成查找与启动；仅在需要比较候选时使用本工具。不要为同一目标重复搜索，也不要改用 Shell/文件工具递归扫盘。",
      properties: { query: { type: "string", minLength: 1, maxLength: 120 } },
      required: ["query"],
      parser: querySchema,
      risk: "read",
      execute: async (parameters, context) => {
        confirmRuntimeAccess(profile, context, options);
        return runtime.search(String(parameters.query), context.userId, activeRunId(context), context.signal);
      }
    }),
    makeTool({
      id: "local-app-recommend",
      name: "computer_use_recommend_games",
      description: "读取当前 Steam 已安装游戏和本 LFAA Control Plane 进程内由当前账户通过 LFAA 启动的 Steam 游戏。历史不代表实际游戏时长，也不包含 LFAA 外的使用；历史为空时只返回未个性化的已安装 Steam 游戏候选。Windows 开始菜单快捷方式可用于按名查找和启动，但来源无法可靠分类为游戏，因此不计入游戏推荐。先将候选交给用户选择，不要自动启动。",
      properties: {},
      parser: emptySchema,
      risk: "read",
      execute: async (_parameters, context) => {
        confirmRuntimeAccess(profile, context, options);
        return runtime.recommend(context.userId, activeRunId(context), context.signal);
      }
    }),
    makeTool({
      id: "local-app-launch",
      name: "computer_use_launch_local_app",
      description: "启动本机 Windows 应用或游戏。用户明确指定应用名且目标清楚时传 query：Owner 在一次有界发现中解析并启动唯一高置信匹配；无结果或有歧义时只返回安全候选、不启动。若需从候选中选择，传本轮搜索/推荐结果的 id；执行前会重新发现校验。开始菜单和 Windows 应用目录由 Explorer 打开，其他程序使用已发现目标及固定参数，不接受任意路径、命令或模型启动参数。不要为同一目标重复搜索，也不要用 Shell/文件工具递归扫盘。启动后观察桌面；回执只证明系统接收请求，不证明应用已进入可用状态。",
      properties: {
        id: { type: "string", pattern: "^(?:steam:[1-9]\\d{0,9}|(?:shortcut|appsfolder|registered|path|indexed):[a-f\\d]{24})$" },
        query: { type: "string", minLength: 1, maxLength: 120 }
      },
      parser: launchSchema,
      risk: "dangerous",
      approval: parameters => {
        const isQuery = typeof parameters.query === "string";
        const target = isQuery ? { name: String(parameters.query).slice(0, 120), launcher: "按名称查找" } : runtime.approvalLabel(String(parameters.id));
        return {
          scopeKey: `computer-use:launch:${parametersDigest("computer_use_launch_local_app", parameters)}`,
          scopeSummary: `${target.launcher} · ${target.name}`.slice(0, 180),
          summary: isQuery ? `按名称查找并请求启动本机应用或游戏《${target.name}》` : `请求启动本机应用或游戏《${target.name}》`
        };
      },
      execute: async (parameters, context) => {
        confirmRuntimeAccess(profile, context, options);
        const agentRunId = activeRunId(context);
        return typeof parameters.query === "string"
          ? runtime.launchByQuery(parameters.query, context.userId, agentRunId, options.isEnabledForUser, context.signal)
          : runtime.launch(String(parameters.id), context.userId, agentRunId, options.isEnabledForUser, context.signal);
      }
    }),
    makeTool({
      id: "local-executable-launch",
      name: "computer_use_launch_local_executable",
      description: "仅启动用户明确提供或本轮工具结果明确返回并核实的 Windows EXE 绝对路径。用户只给应用名称时，使用 computer_use_launch_local_app 的 query 入口；无结果后不要猜路径、递归搜索磁盘或改用 Shell/文件工具扫盘。本工具不接受目录、相对路径或命令参数；执行使用该 EXE、空参数、shell:false 和 EXE 所在目录，并遵循现有本机操控授权。启动后观察画面核实；回执只证明 Windows 接收请求。",
      properties: { executablePath: { type: "string", minLength: 1, maxLength: 32760, pattern: "^[^\\u0000-\\u001f\\u007f]+$" } },
      required: ["executablePath"],
      parser: Joi.object({ executablePath: Joi.string().min(1).max(32_760).pattern(/^[^\u0000-\u001f\u007f]+$/u).required() }).unknown(false),
      risk: "dangerous",
      approval: parameters => {
        const rawPath = String(parameters.executablePath).replaceAll("/", "\\");
        const approvalPath = rawPath.length <= 140 ? rawPath : `…${rawPath.slice(-139)}`;
        return {
          scopeKey: `computer-use:launch-executable:${parametersDigest("computer_use_launch_local_executable", parameters)}`,
          scopeSummary: `本机 EXE · ${approvalPath}`.slice(0, 180),
          summary: `按精确路径启动本机程序 ${approvalPath}（不传启动参数）`
        };
      },
      execute: async (parameters, context) => {
        confirmRuntimeAccess(profile, context, options);
        activeRunId(context);
        return runtime.launchExecutablePath(String(parameters.executablePath), context.userId, options.isEnabledForUser, context.signal);
      }
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
    localWebMode: runtimeOverrides.localWebMode ?? config.localComputerUse,
    isEnabledForUser: runtimeOverrides.isEnabledForUser ?? (userId => getUserSettings(userId).computerControl.enabled),
    localApps: runtimeOverrides.localApps ?? {}
  };
  if (!isSupportedProfile(profile, options)) return;
  const runtime = createDriverRuntime(module);
  const localAppsRuntime = createLocalAppsRuntime({ ...runtimeOverrides.localApps, platform: options.platform });
  (ctx.lfaaTools as typeof import("lfaa-tools/src/business-tools.js") & { registerTool: typeof import("lfaa-tools/src/registry.js").registerAiBusinessTool }).registerTool(ctx, observeTool(profile, module, runtime, options));
  for (const tool of actionTools(profile, module, runtime, options)) {
    (ctx.lfaaTools as typeof import("lfaa-tools/src/business-tools.js") & { registerTool: typeof import("lfaa-tools/src/registry.js").registerAiBusinessTool }).registerTool(ctx, tool);
  }
  for (const tool of localAppTools(profile, localAppsRuntime, options)) {
    (ctx.lfaaTools as typeof import("lfaa-tools/src/business-tools.js") & { registerTool: typeof import("lfaa-tools/src/registry.js").registerAiBusinessTool }).registerTool(ctx, tool);
  }
  ctx.effect(() => async () => {
    await Promise.all([runtime.dispose(), localAppsRuntime.dispose()]);
  }, "lfaa-computer-use-driver-lifecycle");
}

export async function apply(ctx: Context): Promise<void> {
  const options = { platform: process.platform, desktopMode: config.desktopMode, localWebMode: config.localComputerUse };
  if (!isSupportedProfile(ctx.profileContext, { ...options, isEnabledForUser: () => false, localApps: {} })) return;
  // Cua Driver telemetry is opt-out upstream; disable it for this embedded runtime unless the host explicitly set it.
  process.env.CUA_DRIVER_RS_TELEMETRY_ENABLED ??= "false";
  let module: CuaDriverModule;
  try { module = await import("@trycua/cua-driver"); }
  catch (error) {
    process.stderr.write(`本机电脑操控运行库未能初始化；Web/桌面服务继续启动，但不会登记电脑操控工具：${error instanceof Error ? error.message : "未知加载错误"}\n`);
    return;
  }
  registerComputerUseTools(ctx, ctx.profileContext, module, options);
}
