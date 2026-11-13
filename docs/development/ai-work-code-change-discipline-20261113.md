# LFAA AI 代码修改纪律与防止无关整文件重写（2026-11-13）

<a id="lfaa-ai-code-change-discipline-20261113"></a>

## 用户问题与现状

用户发现 AI Work 组件在本地被大段改写，输入提示、模型快捷键和逐回复建议等已有行为发生回退。排查时本地 `main`、`origin/main` 与 GitHub `main` 指向相同的早间提交；修复前的完整工作区差异已保存到本轮恢复快照。Git 差异能证明源文件曾整段改写，不能证明具体由哪个会话、模型或写入工具触发。

仓库已有精准修改原则，文件工具支持摘要校验的写入和精确字符串替换；但摘要只防止基于旧版本覆盖，不能判断一份合法写入是否产生了超出用户目标的语义改动。公共系统提示词没有把代码任务的目标理解、局部编辑和写后差异核对明确组合成模型指令。恢复快照中的聊天组件是大段本地重写，包含不相关格式改动并回退既有行为；Git 不能指出具体是哪一个模型轮次或写入工具造成，只能排除当时的远端拉取差异。

## 入口、Owner 与边界

- 小鱼入口：AI Work → Session/Agent Loop → `lfaa-llm` → `lfaa-system-prompt` 的 `composeLfaaSystemPrompt`；主模型继续自主理解目标和选择本轮已登记工具。
- 通用代码修改规则归根目录 `开发规范.md`；Codex/工程助手读取仓库 `AGENTS.md`。小鱼每轮核心指令归 `packages/core/system-prompt`。
- 项目写入归 `packages/core/tools` 的 `project_file_operation`，通用别名归 `packages/fs/tool-fs` 与 `packages/fs/tool-str-replace-editor`。写入风险和批准继续走现有 Permission Owner。已有文件摘要校验、项目范围校验与工具参数校验保持不变。
- 不新增设置、权限模式、审批步骤或代码路径白名单；不改变用户模型、推理偏好、账户数据或项目数据。

## 允许、禁止与验收

- 允许：把“先理解目标与 Owner、以局部精确编辑为默认、保留未涉及内容、写后检查真实差异并修正越界变更”的简短指令注入小鱼公共系统提示词；同步 Codex/工程助手规范、项目写入工具和别名工具描述；增加提示词组合回归与对应文档。为让正式 Host 可构建，可修正本地已有 Provider 用量代码中的纯类型缩窄错误，但不得改变其字段优先级或计算结果。
- 禁止：用固定关键词路由或写死代码实现代替模型判断；输出隐藏推理；新增强制人工批准、静态应用/路径白名单，或绕过既有 Permission Owner；禁止用户明确要求的整体重写。
- 验收：实际组合出的系统提示词包含上述纪律；模型仍依用户目标自主决定是否修改、读取什么及使用哪个已登记工具；工具写入仍校验最近读取摘要并遵循现有授权；本轮不触碰此前的 AI Work 与其它工作区改动。
- 直接运行提示词/文件工具回归、受影响包构建及 `git diff --check`。本任务不改 UI，不触发真实模型、用户数据或设置写入。

## 实施记录

已完成。根因证据边界：本地 `AiWorkChat.tsx` 确实曾被整段重写，改动包含局部问题以外的大量格式/结构变化，因而丢失已完成行为；本地与 GitHub `main` 当时相同，故不是拉取冲突。没有工具级写入审计记录能确定具体由 Codex、小鱼或哪次文件操作触发；“整文件生成式回写”是最符合差异的推断，不作为已证实的执行器归因。

**实现：** 小鱼公共系统提示词现在要求代码修改先核实目标、Owner、源码和已有改动，确定最小范围，默认局部精确编辑，写后检查差异；不能读差异时读回文件并说明。指令保持稳定且简短（337 个 UTF-8 字节），不输出隐藏推理、不新增审批步骤，工具/上下文仍由模型按目标自行选择。根 `AGENTS.md` 与 `开发规范.md` 为 Codex 和其它编码助手增加同一规则；`project_file_operation`、`lfaa_write_file` 和 `lfaa_str_replace` 的运行时描述明确局部编辑与整文件写入适用条件。SHA-256 仍只解决过期/并发覆盖，不冒充语义范围防护。

正式 Host 首次构建遇到当前工作树 `completion.ts` 的两处严格空值缩窄错误。已将嵌套缓存计数读取到局部变量，保留 Provider 字段优先级与原计算；对应既有归一化回归通过。此小改动是正式 Control Plane 构建的必要前置，不改变用量数据语义。

**变更文件与职责：**

- `AGENTS.md`：为 Codex/工程编码助手登记精确变更硬规则。
- `开发规范.md`：定义目标理解、局部修改、写后差异检查和澄清边界。
- `packages/core/system-prompt/src/index.ts`：将简短纪律注入所有 App 共用的小鱼核心系统提示词。
- `packages/core/system-prompt/README.md`：记录系统提示词的编码行为合同。
- `packages/core/tools/src/project-tools.ts`、`packages/core/tools/README.md`：加强主要项目文件工具的写入说明并记录 SHA 与语义审查边界。
- `packages/fs/tool-fs/src/write.ts`、`packages/fs/tool-str-replace-editor/src/index.ts`：说明整文件写入与局部替换的适用情形。
- `packages/llm/llm/src/completion.ts`：修复缓存计数可空对象访问的 TypeScript 缩窄，不改变运行逻辑。
- `apps/cli/tests/xiaoyu-persona-core.test.mjs`：锁定系统提示词必须包含局部修改、写后差异核对、模型自主选择及不增加审批的要求。
- `docs/PROMPTS.md`、本合同：登记任务并保留证据/边界。

**验证：** 新增提示词定向回归 1/1 通过；Provider 用量归一化定向回归 1/1 通过。`lfaa-system-prompt`、`lfaa-tool-fs`、`lfaa-tool-str-replace-editor`、`lfaa-tools`、`lfaa-llm` 包构建通过；最终 `pnpm run build:control-plane` 通过，`node scripts/runtime-build-state.mjs host` 返回 `[]`，`git diff --check` 通过。`xiaoyu-persona-core.test.mjs` 全文件 4/5：唯一失败是既有顺序断言把未被 `composeLfaaSystemPrompt` 消费的 `CTX-MARKER` 当成 system prompt 内容；当前运行上下文由 LLM Owner 注入 user 消息，因此未为通过测试而改动提示词边界或该断言。

**未验边界：** 没有调用真实 Provider，无法证明模型每次都遵守指令或评估输出质量；提示词是模型级行为约束，并非阻止有效但语义越界整文件写入的硬编码 diff gate。没有改设置、权限、用户数据或运行中服务，也没有界面变化。小鱼进程是否已加载新 Control Plane 构建未实测。
