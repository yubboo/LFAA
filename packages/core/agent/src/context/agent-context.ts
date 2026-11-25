// Agent 运行上下文装配：记忆召回、规则提示词、资料库摘要、背景图目录、技能/进度提示与模型能力价格解析。
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveModelCapabilities, type LlmMessage, type LlmProfile } from "@lfaa/llm";
import type { TokenPricing } from "@lfaa/metrics";
import { formatHistoryDigest, collectHistoryDigest, type SessionWorktree } from "@lfaa/memory";
import type { RunExecutionParams, RunLoopDeps } from "../run/run-types";
import type { ProjectScope } from "../types";
import { resolveModelRoundLimits } from "../run/model-round";

/** 权限模式对应的系统提示说明，按当前模式拼进 system 消息。 */
export const MODE_HINTS = {
  full: "当前权限模式：完全访问权限（内置文件工具不受工作区目录限制，但应用私有文件始终受保护；命令沿用系统用户权限）。",
  smart: "当前权限模式：帮我审批（内置文件工具仅可访问工作区；同类常规操作累计批准 3 次后自动放行，高危操作仍需确认）。",
  ask: "当前权限模式：请求批准（内置文件工具仅可访问工作区；每次修改文件或执行命令均需用户确认）。",
} as const;

/** 排版与语言规范：思考过程、过程说明与正文语言一致，多目录/文件列举结构化。 */
export const FORMAT_HINT = "语言与排版规范：\n1. 无论内部思考过程（thinking/reasoning）、工具调用前后的过程说明还是最终答复，都必须严格与用户提问的语言保持一致；用户使用中文提问时，思考过程与过程说明也必须全程使用自然流畅的简体中文，严禁切换为英文。\n2. 列举 3 个及以上的目录、文件、配置项或路径时，严禁挤在一段长句括号里用顿号堆叠；请使用结构化列表（如 `- `name/`：说明`）、Markdown 表格或树形代码块展示，并将文件名与目录名用反引号 `` ` `` 包裹。";

export interface RecalledContext {
  systemPrompt: string;
  projectRuleNames: string[];
  contextWindow: Awaited<ReturnType<RunLoopDeps["memory"]["buildContextMessages"]>>;
  historyDigest: string;
  libraryHint: string;
  backgroundHint: string;
}

/** 背景图落点提示：个人目录始终可用；只有工作区确实是 LFAA 源码仓库时才提内置目录。 */
function buildBackgroundHint(workspaceRoots: string[]): string {
  const personalDir = join(homedir(), ".lfaa", "backgrounds");
  const builtinDir = workspaceRoots
    .map((root) => join(root, "packages", "ui", "theme", "client", "assets", "backgrounds"))
    .find((candidate) => existsSync(candidate));
  const base = `LFAA 背景图个人目录：${personalDir}。把 PNG/JPG/WebP 直接放进去（文件名用小写英文 kebab-case）就会出现在「外观 → 预设 → 背景图片 → 我的图片」，刷新设置即生效、无需重新构建；任何项目下都走这个目录。`;
  return builtinDir
    ? `${base} 当前工作区同时是 LFAA 源码仓库：负责人要「内置/跟版本走」时，把图片转成 WebP 后放进 ${builtinDir}，需要中文名再补 manifest.json 的 labels/order；只要本机临时用就仍走个人目录。`
    : `${base} 当前工作区没有 LFAA 源码，不要尝试修改内置目录。`;
}

/** 装入已保存的上下文并补齐尚未写入的新消息。 */
export function buildRecentConversation(system: LlmMessage, window: RecalledContext["contextWindow"], prompt: string): LlmMessage[] {
  const messages: LlmMessage[] = [system];
  if (window.summaryNote) messages.push({ role: "system", content: `前序会话摘要：${window.summaryNote}` });
  for (const msg of window.recentMessages) {
    if (msg.status === "streaming" || (msg.role === "assistant" && !msg.content.trim())) continue;
    messages.push({ role: msg.role, content: msg.content });
  }
  if (!window.recentMessages.some((message) => message.role === "user" && message.content === prompt)) {
    messages.push({ role: "user", content: prompt });
  }
  return messages;
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
  const backgroundHint = buildBackgroundHint(params.workspaceRoots);
  return { systemPrompt, projectRuleNames, contextWindow, historyDigest, libraryHint, backgroundHint };
}

/** 会话工作位置与授权目录提示，附带权限边界说明。 */
export function buildWorkspaceHint(
  projectId: string | null | undefined,
  workspaceRoots: string[],
  projectRuleNames: string[],
  worktree?: SessionWorktree,
): string {
  return [
    `会话工作位置：${projectId ? "已绑定项目" : "项目外聊天"}${worktree ? `（工作树 ${worktree.branch}）` : ""}。`,
    `已授权目录：${workspaceRoots.join("、") || "无"}。`,
    ...(worktree
      ? [`当前会话工作树：${worktree.branch} → ${worktree.path}。所有读写、命令与 Git 操作都以该目录为根；项目主目录仅用于对照，不得直接修改。`]
      : []),
    `本轮加载的项目规则：${projectRuleNames.join("、") || "无"}。`,
    "以本轮生效上下文和工具清单为准；会话记录与其他应用配置不能证明当前权限。需要另一个项目时，请用户在新聊天选择该项目，或在既有聊天输入框使用 @项目。",
    "终端命令从工作目录启动，子进程当前没有 OS 路径隔离，必须遵守授权目录与操作审批；禁止读取 ~/.lfaa 下的配置、凭据与会话文件（会被拦截并记录审计）。",
  ].join("\n");
}

/** 项目范围锚定：项目名、简介与防跑偏处理要求；只在会话绑定项目时注入。 */
export function buildProjectScopeHint(scope: ProjectScope): string {
  const description = scope.description?.trim() || "（项目尚未填写简介）";
  return [
    `## 本项目范围：${scope.name}`,
    `项目简介：${description}`,
    "本会话属于该项目，只推进与项目简介、项目目录职责直接相关的工作；与项目无关的请求不要直接执行。",
    "若用户请求明显超出本项目范围：先用一句话说明「这看起来不属于本项目范围」，再询问是仍在本项目继续，还是改用项目外聊天或新建项目；在用户回答前不要执行无关的文件修改、命令、生成或资料检索。",
    "不得把无关主题夹带进项目交付，也不得引用其他项目或其他会话的资料作为本项目上下文。",
    "项目简介缺失或与目录内容不符时，先用只读方式查看 README、AGENTS.md 与顶层结构，再与用户确认项目目标。",
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

/** 压缩系统提示词中的单条技能摘要，控制每轮输入 token 开销（不影响 load_skill 读取完整正文）。 */
function compactSkillDescription(description: string | undefined, maxChars = 120): string {
  const normalized = (description ?? "").replace(/\s+/gu, " ").trim();
  if (!normalized) return "";
  return normalized.length <= maxChars ? normalized : `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
}

/** 可用技能目录提示：优先内联个人/项目/插件技能，内置技能压缩为按需检索提示，避免 40 个无关内置技能每轮膨胀数千 Token。 */
export function buildSkillsCatalogHint(availableSkillCatalog: RunExecutionParams["availableSkillCatalog"]): string {
  if (!availableSkillCatalog || availableSkillCatalog.length === 0) return "";
  const prioritySkills = availableSkillCatalog.filter((s) => s.source !== "builtin");
  const builtinSkills = availableSkillCatalog.filter((s) => s.source === "builtin");
  const maxShown = 24;
  const shown = prioritySkills.slice(0, maxShown);
  const lines = shown.map((s) => {
    const desc = compactSkillDescription(s.description, 100);
    return `- ${s.name} (id: ${s.id}, 来源: ${s.source})${desc ? `：${desc}` : ""}`;
  });
  if (prioritySkills.length > maxShown) {
    lines.push(`- （另有 ${prioritySkills.length - maxShown} 个自定义/插件技能，需要时调用 list_skills 查看）`);
  }
  if (builtinSkills.length > 0) {
    const builtinNames = builtinSkills.slice(0, 8).map((s) => s.name).join("、");
    const more = builtinSkills.length > 8 ? ` 等 ${builtinSkills.length} 个` : "";
    lines.push(`- 内置专业技能（${builtinNames}${more}）：按需先调用 list_skills 检索再用 load_skill 读取正文`);
  }
  return `\n\n可用技能目录（命中技能适用场景时先调用 load_skill 读取完整正文再执行；Git 安装用 install_skill_from_git；新建个人技能用 save_user_skill）：\n${lines.join("\n")}`;
}

/** 进度播报、工具效率、记忆与澄清等行为规范提示。 */
export function buildProgressHint(deps: RunLoopDeps, params: RunExecutionParams): string {
  return [
    params.enableClarification
      ? "需求澄清（极度克制使用）：仅当缺少关键信息会彻底改变实现方向、且无法从上下文合理判断时，才调用 ask_user 提一个问题；若上一轮你刚列出了编号条目/说明/建议（如 1. … 2. …），而用户回复「1」「2」「第一项」「都做」「好」「继续」「改吧」等简短指向，视为已明确确认对应条目，严禁调用 ask_user 再次反问，必须立刻直接执行！简短问候、明确指令和可安全推断的细节也绝不反问。"
      : "",
    "高效并行与精简验证：1）需要读取或检索多个已知文件时，必须在同一轮并行发起多个 read_file/grep/glob 调用，严禁逐个串行读取拖慢速度与放大 Token 消耗；2）类型检查、Lint、测试等验证命令优先合并为单条复合命令一次跑完，不要拆成多轮零碎命令；3）纯代码改动无需开浏览器，涉及前端 UI 改动最多做 1 轮聚焦验收，严禁重复派发功能重叠的子智能体或编写临时截图/计算脚本。",
    "较大的代码变更分成有明确文件落点的小批次。已有工具结果足以行动时，直接发出下一项必要调用。可见进度只说实际完成、正在处理的目标或当前阻塞。",
    "多步任务的进度写入用户可见的正文。首次调用工具前，简短交代准备核查或执行的事项；得到实际结果、发现异常或进入下一阶段时，再说明进展和接下来的动作。连续的小操作可共用一段，直接问答无需播报。命令和工具详情由运行时展示。",
    "任务清单：只要任务需要新建或修改 2 个及以上文件、或需要 2 条以上命令步骤，就必须先调用 todo_write 列出可执行步骤再动手；开始某项时把该项标成 in_progress，完成立即标成 completed，同一时刻只保留一条进行中；交付最终答复前必须把最后一项也标成 completed，禁止把已完成任务留在 in_progress。单步问答、纯解释和小改动不必建清单。",
    deps.tools.getTool("invoke_subagent")
      ? "多智能体协作：遇到复杂排查、跨模块代码调研、独立子模块实现或代码审查时，使用 invoke_subagent 按角色派发专职子智能体（kind=research 只读调研 / kind=coder 定向实现 / kind=reviewer 只读审查 / kind=browser 浏览器验收）。派发前在正文简短说明派发分工；支持设 wait=false 并行派发多个子智能体（右侧工作台会为每个子智能体新建独立标签），但主智能体必须调用 list_subagents(waitForIds) 等待所有已派发子智能体干完并回收结果后再汇总交付，严禁不等子智能体完成就结束本轮。无独立分工的简单任务直接完成；子任务失败时如实说明。"
      : "",
    deps.tools.getTool("browser_present")
      ? "展示预览（最高优先级分流）：只要用户说「打开浏览器」「我要看效果」「展示页面」「预览一下」等纯查看诉求，只调用一次 browser_present 展开右侧浏览器并立即结束本轮，严禁派发浏览器子智能体、严禁重新验收、严禁顺手改代码。复用当前标签；仅在用户指定其他地址或还没有活动网页且已知目标地址时才传 URL。"
      : "",
    deps.tools.getTool("browser_navigate")
      ? (deps.tools.getTool("invoke_subagent")
        ? "右侧工作台与内置浏览器闭环验收：仅在需要排查故障、交互测试或交付验收时调用 invoke_subagent(mode=browser)。派发时必须在 prompt 中列出 3–5 条明确可验证的检查项（目标页面、待点控件、预期变化、结束条件），禁止写「逐屏验收」这类无边界指令。收到子智能体回报的问题后，先向用户简述「发现了什么问题 → 准备修改哪些文件」，改完后仅复验受影响项，严禁无方向循环返工。"
        : "右侧工作台与内置浏览器闭环验收：按本轮用户要求定位页面和控件，实测关键交互。按检查项选择 browser_console、browser_network 或 browser_visual_check 等证据。")
      : "",
    deps.tools.getTool("browser_navigate")
      ? "浏览器任务边界：只排查时回报证据；本轮已授权修复时，只处理与需求相关且可复现的问题，再复验受影响步骤。遇到接管、无法验证或复验无新证据时，结束检查并说明阻塞。向用户同步已点过的控件、实际观察、修改位置和复验结果。"
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
