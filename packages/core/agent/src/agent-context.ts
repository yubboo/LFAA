// Agent 运行上下文装配：记忆召回、规则提示词、资料库摘要、技能/进度提示与模型能力价格解析。
import { resolveModelCapabilities, type LlmProfile } from "@lfaa/llm";
import type { TokenPricing } from "@lfaa/metrics";
import { formatHistoryDigest, collectHistoryDigest } from "@lfaa/memory";
import type { RunExecutionParams, RunLoopDeps } from "./run-types";
import { resolveModelRoundLimits } from "./model-round";

/** 权限模式对应的系统提示说明，按当前模式拼进 system 消息。 */
export const MODE_HINTS = {
  full: "当前权限模式：完全访问权限（内置文件工具不受工作区目录限制，但应用私有文件始终受保护；命令沿用系统用户权限）。",
  smart: "当前权限模式：帮我审批（内置文件工具仅可访问工作区；同类常规操作累计批准 3 次后自动放行，高危操作仍需确认）。",
  ask: "当前权限模式：请求批准（内置文件工具仅可访问工作区；每次修改文件或执行命令均需用户确认）。",
} as const;

/** 排版规范：多目录/文件列举必须结构化，避免长句堆叠。 */
export const FORMAT_HINT = "排版规范：列举 3 个及以上的目录、文件、配置项或路径时，严禁挤在一段长句括号里用顿号堆叠；请使用结构化列表（如 `- \\`name/\\`：说明`）、Markdown 表格或树形代码块展示，并将文件名与目录名用反引号 `` ` `` 包裹。";

export interface RecalledContext {
  systemPrompt: string;
  projectRuleNames: string[];
  contextWindow: Awaited<ReturnType<RunLoopDeps["memory"]["buildContextMessages"]>>;
  historyDigest: string;
  libraryHint: string;
}

/** 召回长期记忆与资料库状态，并组装规则提示词与短期上下文窗口。 */
export async function recallAgentContext(
  deps: RunLoopDeps,
  params: RunExecutionParams,
): Promise<RecalledContext> {
  const [memories, storageState, recentAssets] = params.enableMemoryContext === false ? [[], null, []] as const : await Promise.all([
    deps.memory.recallRelevantMemories({
      query: params.userMessage,
      ...(params.projectId !== undefined ? { projectId: params.projectId } : {}),
      limit: 6,
    }),
    deps.memory.getStorageState(),
    deps.memory.listLibraryAssets({
      ...(params.projectId !== undefined ? { projectId: params.projectId } : {}),
    }),
  ]);
  const memoryHints = memories.map((m) => `[${m.scope === "project" ? "项目记忆" : "全局记忆"}] ${m.content}`);
  const { systemPrompt, documents } = await deps.rules.composeSystemPrompt({
    projectPaths: params.workspaceRoots,
    memoryHints,
  });
  const contextWindow = await deps.memory.buildContextMessages(params.sessionId, {
    maxRecentMessages: 16,
    maxChars: 16000,
  });
  // 历史工具轨迹只保留一行式要点，避免模型为确认既有改动而重复读取文件。
  const historyDigest = formatHistoryDigest(collectHistoryDigest(contextWindow.recentMessages));
  const projectRuleNames = documents.filter((doc) => doc.layer === "project").map((doc) => doc.source);

  // 资料库摘要只在数据可达时展示，帮助模型优先把成品存入资产库。
  const assetPreview = recentAssets.slice(0, 6).map((a) => `${a.title}(${a.fileName})`).join("、");
  const libraryHint = storageState
    ? `LFAA 资料库/资产库本地目录：${storageState.dataRoot}（当前已有 ${recentAssets.length} 项资产/产物${assetPreview ? `：${assetPreview}` : ""}）。你可通过 list_library_assets / read_library_asset 查看资料库内容，产出的报告、文档或成品请优先调用 save_library_artifact 存入资产库以便用户在「资料库」界面统一查看。`
    : "";
  return { systemPrompt, projectRuleNames, contextWindow, historyDigest, libraryHint };
}

/** 会话工作位置与授权目录提示，附带权限边界说明。 */
export function buildWorkspaceHint(projectId: string | null | undefined, workspaceRoots: string[], projectRuleNames: string[]): string {
  return [
    `会话工作位置：${projectId ? "已绑定项目" : "项目外聊天"}。`,
    `已授权目录：${workspaceRoots.join("、") || "无"}。`,
    `本轮加载的项目规则：${projectRuleNames.join("、") || "无"}。`,
    "以本轮生效上下文和工具清单为准；会话记录与其他应用配置不能证明当前权限。需要另一个项目时，请用户在新聊天选择该项目，或在既有聊天输入框使用 @项目。",
    "终端命令从工作目录启动，子进程当前没有 OS 路径隔离，必须遵守授权目录与操作审批；禁止读取 ~/.lfaa 下的配置、凭据与会话文件（会被拦截并记录审计）。",
  ].join("\n");
}

/** 显式选用技能的正文段。 */
export function buildSkillsSection(resolvedSkills: RunExecutionParams["resolvedSkills"]): string {
  return resolvedSkills && resolvedSkills.length > 0
    ? `\n\n本轮显式选用的技能（仅本轮生效）：\n${resolvedSkills
        .map((s) => `### 技能：${s.name} (v${s.revision})\n${s.content}`)
        .join("\n\n")}`
    : "";
}

/** 可用技能目录提示：命中技能场景时先 load_skill 再执行。 */
export function buildSkillsCatalogHint(availableSkillCatalog: RunExecutionParams["availableSkillCatalog"]): string {
  return availableSkillCatalog && availableSkillCatalog.length > 0
    ? `\n\n可用技能目录（当任务命中某个技能的适用场景时，请先调用 load_skill 读取完整正文再按规范执行；若用户要求从 Git 安装技能请调用 install_skill_from_git；若用户要求创建个人技能请调用 save_user_skill 存入 ~/.lfaa/skills/）：\n${availableSkillCatalog
        .slice(0, 30)
        .map((s) => `- ${s.name} (id: ${s.id}, 来源: ${s.source})${s.description ? `：${s.description}` : ""}`)
        .join("\n")}`
    : "";
}

/** 进度播报、工具效率、记忆与澄清等行为规范提示。 */
export function buildProgressHint(deps: RunLoopDeps, params: RunExecutionParams): string {
  return [
    params.enableClarification
      ? "需求澄清：若目标、操作对象或交付范围有多种合理解释，且会改变实施方向，先用 ask_user 提一个关键问题，必要时给出 2–4 个选项，并等待下一条用户消息；本轮不要同时修改文件、执行命令或委派。简短问候、明确请求和可安全从上下文确认的细节无需提问。"
      : "",
    "较大的代码变更分成有明确文件落点的小批次。已有工具结果足以行动时，直接发出下一项必要调用。可见进度只说实际完成、正在处理的目标或当前阻塞。",
    "多步任务的进度写入用户可见的正文。首次调用工具前，简短交代准备核查或执行的事项；得到实际结果、发现异常或进入下一阶段时，再说明进展和接下来的动作。连续的小操作可共用一段，直接问答无需播报。命令和工具详情由运行时展示。",
    deps.tools.getTool("invoke_subagent")
      ? "多智能体协作：用户明确要求委派，或任务存在可独立并行的调研、实现或验证时，用 invoke_subagent 设 wait=false 派发，并用 list_subagents 的 waitForIds 收集结果再汇总。无独立分工的简单任务直接完成。子任务失败时如实说明。"
      : "",
    "自主排查与编辑准则：定位问题时先用 grep（正则内容）/ glob（文件名模式）/ list_dir / read_file 检索并精读关键源码上下文再动手；修改代码或修复报错时，直接调用 edit_file / write_file 落实修改并立即通过 run_command 验证，遇到新报错继续读取对应行并修正闭环，不得停在只给建议或让用户手动改代码。edit_file 的 target 必须在文件中唯一命中，命中多处时请补充上下文行或显式传 replaceAll；新建文件用 write_file。",
    "工具效率与核验规范：创建或读取多个互相独立的文件时，请在同轮并行发起多个 read_file / write_file / edit_file 调用，避免逐个文件串行消耗步数；执行构建/测试请直接用 run_command 验证，不可将“静态自审”等价于编译或运行通过；前台命令默认 10 分钟超时，构建、安装等长命令可传 timeoutMs，服务器或监听类命令请用 start_background_task 启动并用 get_background_task 轮询；向用户提供复现命令时，必须严格匹配当前终端语法（CMD 用 `set \"VAR=...\"`，PowerShell 用 `$env:VAR=\"...\"`），严禁混写。",
    "长期记忆：当用户明确陈述跨会话仍需记住的偏好、约定或项目约束（如“以后统一用 pnpm”“这个项目不要改 X”），调用 save_memory 保存，一次只记一条可独立复述的事实；临时进度与本次任务的中间结果不要写入长期记忆。",
  ].join("\n");
}

/** 解析当前模型配置与能力：提示文案、上下文窗口、轮次时限与 token 单价。 */
export async function resolveModelContext(
  deps: RunLoopDeps,
  params: RunExecutionParams,
  recentMessages: Array<{ role: string; model?: string }>,
): Promise<{
  activeProfile: LlmProfile | null;
  lastRoutedModel: string | undefined;
  modelHint: string;
  modelCapability: ReturnType<typeof resolveModelCapabilities> | undefined;
  roundLimits: ReturnType<typeof resolveModelRoundLimits>;
  tokenPricing: TokenPricing | undefined;
}> {
  const activeProfile = typeof deps.llm.resolveProfile === "function"
    ? await deps.llm.resolveProfile(params.profileId).catch(() => null)
    : null;
  const lastRoutedModel = [...recentMessages]
    .reverse()
    .find((m) => m.role === "assistant" && typeof m.model === "string" && m.model.trim())?.model;
  const modelHint = activeProfile
    ? `当前调用的模型配置：${activeProfile.name}（配置模型 ID：${activeProfile.model}${activeProfile.model === "ark-code-latest" ? "，方舟控制台动态路由" : ""}${lastRoutedModel && lastRoutedModel !== activeProfile.model ? `，前序响应实际路由模型：${lastRoutedModel}` : ""}）。当用户询问当前使用的模型时，请如实告知以上信息；若使用 ark-code-latest 且尚未收到本轮响应，可说明具体模型由方舟控制台路由决定。`
    : "";
  // 思考型模型允许更长的连续推理时限，普通模型沿用较短阈值。
  const modelCapability = activeProfile
    ? activeProfile.availableModels?.find((item) => item.id === activeProfile.model)
      ?? resolveModelCapabilities(activeProfile.model, activeProfile.kind)
    : undefined;
  const roundLimits = resolveModelRoundLimits({ supportsReasoning: modelCapability?.supportsReasoning === true });
  // 模型配置里填写了输入/输出单价时，按真实 token 用量换算人民币成本。
  const tokenPricing: TokenPricing | undefined = activeProfile
    && typeof activeProfile.inputPricePerMillion === "number"
    && typeof activeProfile.outputPricePerMillion === "number"
    ? {
        inputPricePerMillion: activeProfile.inputPricePerMillion,
        outputPricePerMillion: activeProfile.outputPricePerMillion,
        ...(typeof activeProfile.cachedInputPricePerMillion === "number"
          ? { cachedInputPricePerMillion: activeProfile.cachedInputPricePerMillion }
          : {}),
      }
    : undefined;
  return { activeProfile, lastRoutedModel, modelHint, modelCapability, roundLimits, tokenPricing };
}
