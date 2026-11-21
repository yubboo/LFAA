# LFAA 仓库目录说明书

盘点时间为 **2026-11-18 23:41（Asia/Shanghai）**。这是当前本地工作区的结构快照，收录 Git 可见且仍存在的已跟踪文件和未忽略的新文件，共 **535 个文件、74 个子目录**。文件说明以当前源码职责、包清单、脚本入口和文档标题为依据。

## 1. 仓库总览

```text
lfaa/
├── .agent/  # 仓库级 AI Agent 开发资料
├── apps/  # 启动、平台适配、Host 与 Client 插件装配
├── packages/  # 各业务和共享能力的 pnpm 工作区包
├── docs/  # 架构、开发规范、开发日志、更新说明和协作模板
├── scripts/  # Windows 启动、依赖检查及脚本回归测试
├── .editorconfig  # 编辑器协作配置，统一字符编码、换行和基础缩进
├── .gitignore  # Git 忽略规则，覆盖依赖、构建产物、运行数据与本地凭据
├── AGENTS.md  # AI Agent 的项目级工作约定，定义架构、审批、注释、验证和日志要求
├── lfaa.bat  # Windows 双击入口，调用 PowerShell 菜单并保留终端
├── package.json  # Monorepo 根清单，提供 lfaa、typecheck、build 与 pnpm 版本声明
├── pnpm-lock.yaml  # pnpm 依赖解析结果，固定各工作区包的依赖版本和来源
├── pnpm-workspace.yaml  # 登记 apps/* 与 packages/*/* 工作区包，定义允许构建的依赖
├── README.md  # 项目简介、工程文档入口和 Windows/Web 启动说明
└── tsconfig.json  # 各工作区 TypeScript 配置继承的编译基线
```

## 2. 按任务快速找文件

| 想找什么 | 从哪里看 |
| --- | --- |
| Windows 菜单、依赖安装和本地启动 | [Windows 入口](../../lfaa.bat) → [PowerShell 菜单](../../scripts/lfaa.ps1) → [依赖预检](../../scripts/ensure-dependencies.mjs) |
| Web 服务和浏览器从哪启动 | [CLI 入口](../../apps/cli/src/bin.ts) → [Host 服务装配](../../apps/web/src/server.ts)。浏览器由 [HTML 入口](../../apps/web/index.html) 挂载 [Client 装配](../../apps/web/src/main.tsx) |
| 四栏布局、导航和拖拽 | [工作台 Shell](../../packages/ui/layout/client/components/WorkbenchShell.tsx)、[工作台服务](../../packages/ui/layout/client/workbench-service.ts)、[拖拽计算](../../packages/ui/layout/client/sidebar-resize.ts) |
| 聊天页面、状态和会话存储 | [聊天工作区](../../packages/core/chat/client/components/ChatWorkspace.tsx)、[聊天状态](../../packages/core/chat/client/chat-store.ts)、[会话存储](../../packages/core/memory/src/session-store.ts) |
| Agent 任务、审批、工具和模型 | [任务循环](../../packages/core/agent/src/agent-loop.ts)、[审批策略](../../packages/core/agent/src/permission-policy.ts)、[工具服务](../../packages/core/tools/src/index.ts)、[模型服务](../../packages/core/llm/src/index.ts) |
| 本地项目和分区 | [项目服务](../../packages/workspace/workspace/src/index.ts)、[分区服务](../../packages/workspace/sections/src/index.ts) |
| 改主题、取共享控件 | [主题入口](../../packages/ui/theme/client/index.tsx)、[共享控件入口](../../packages/ui/primitives/client/index.tsx) |
| 查协作规则、设计方案和历史变更 | [开发规范](../standards/AI-Agent-Development-Standards.md)、[架构索引](README.md)、[开发日志卷](../dev-log/000001-000200.md) |

### 阅读目录时常用的术语

- **Host** 在 Node 中运行，负责本地存储、工具、模型调用及 HTTP 接口。**Client** 在浏览器中运行，负责 React 界面、交互和同步状态。
- **Cordis 服务与插件**　服务暴露功能接口。插件在应用装配时注册服务、界面或工具，并在退出或卸载时释放对应资源。各包的 `package.json` 列出可从包外使用的入口。
- **`src/`、`client/`、`tests/`**　分别对应 Host 或公共契约、浏览器逻辑和自动化验证。共享 UI 包的 `src/` 也可以只放纯类型、配置或计算。相邻的 `*.module.css` 管对应组件的局部样式。

### 本地目录与方案状态

| 路径 | 用途或当前状态 |
| --- | --- |
| `.git/` | 本地 Git 元数据，保存版本对象、分支与索引。 |
| 根目录和各包的 `node_modules/` | pnpm 安装生成的依赖与链接。 |
| `apps/web/dist/` | Web 的构建输出，由 `pnpm run build` 生成。 |
| `data/`、`~/.lfaa/` | 运行时数据位置。实际资料库根由存储配置决定，项目、会话及部分设置由 Host 管理。 |
| `.env*` 及本地密钥文件 | 本机环境配置和凭据。逐文件目录的范围是仓库源文件与受版本控制的文档。 |
| `packages/skills/`、`packages/plugins/` | 已写入[扩展中心设计方案](extensions.md)的拟建包，待实施。当前的 `.agent/skills/` 是项目开发资料。 |
| `apps/desktop/`、`packages/core/session/`、`packages/ui/slots/`、`native/` 等 | 示例结构中的位置。当前可执行程序为 CLI 和 Web，会话存储在 `packages/core/memory/`，Workbench 插槽契约在 `packages/ui/layout/src/index.ts`。 |

## 3. 项目开发技能 `.agent/`

```text
.agent/  # 仓库级 AI Agent 开发资料
└── skills/  # 项目开发使用的技能说明、参考资料与配套脚本
    ├── antfu/  # 工程工具、应用、库和 Monorepo 约定
    │   ├── references/  # 按使用场景组织的工程配置指南
    │   │   ├── antfu-eslint-config.md  # Antfu ESLint 预设及项目级覆盖方式
    │   │   ├── app-development.md  # 应用项目的开发和配置约定
    │   │   ├── library-development.md  # 可复用库的入口、构建及发布约定
    │   │   ├── monorepo.md  # Monorepo 工作区、依赖与目录组织建议
    │   │   └── setting-up.md  # 工程初始化与基础工具配置
    │   └── SKILL.md  # Antfu 工程工具与编码规范技能入口
    ├── design-taste-frontend/  # 前端视觉方向、界面构成与浏览器验收方法
    │   ├── library/  # 给视觉建议和实现复用的配色与排版样例
    │   │   ├── palettes.json  # 主题配色参考数据
    │   │   └── type.json  # 字体搭配与排版参考数据
    │   ├── references/  # 视觉表现、内容写作与交付验收指南
    │   │   ├── backgrounds.md  # 页面背景表现和使用场景
    │   │   ├── cards.md  # 卡片布局、结构与视觉层次
    │   │   ├── copy-moves.md  # 文案编辑手法及修改示例
    │   │   ├── copy-registers.md  # 不同产品场景的文案语域
    │   │   ├── copy-tells.md  # 常见模板化文案的识别与修订
    │   │   ├── copy-voice.md  # 品牌语气和文案声音的选择
    │   │   ├── copy.md  # 界面文案编写总指南
    │   │   ├── diagrams.md  # 信息图和说明性图示的设计建议
    │   │   ├── effects-creative.md  # 背景以外的创意效果和使用场景
    │   │   ├── effects-objects.md  # 物件、印刷和纹理效果设计参考
    │   │   ├── effects-usage.md  # 效果选型、强度控制与组合约定
    │   │   ├── gate.md  # 完成前的浏览器和视觉检查标准
    │   │   ├── icons.md  # 图标风格、选型及一致性约定
    │   │   ├── layout-v4.md  # 页面区块、首屏、对齐和字排构图
    │   │   ├── moments.md  # 关键交互时刻和反馈设计建议
    │   │   ├── motion.md  # 动效节奏、触发条件与减少动态效果
    │   │   ├── perf.md  # 前端视觉与动效的性能预算
    │   │   ├── photos.md  # 摄影素材选择与使用指南
    │   │   ├── scenes.md  # 大型场景背景与视觉构图参考
    │   │   ├── sections-library.md  # 可复用的页面区块设计样例
    │   │   ├── sections.md  # 页面区块选择与内容编排指南
    │   │   └── system.md  # 设计系统、跨组件一致性与复用约定
    │   ├── scripts/  # 配套的本地分析脚本、浏览器检查与效果实验模板
    │   │   ├── consistency.mjs  # 在浏览器中检查界面视觉一致性
    │   │   ├── copy-lint.mjs  # 检查界面文案模式并报告可疑片段
    │   │   ├── effects.mjs  # 运行配套的效果模板与预览工具
    │   │   ├── fx-gallery.template.html  # 视觉效果样例画廊的 HTML 模板
    │   │   ├── fx-lab.template.html  # 调试视觉效果的实验页 HTML 模板
    │   │   ├── gate.mjs  # 运行并汇总前端交付验收检查
    │   │   ├── icons.mjs  # 检查页面图标使用与表现
    │   │   ├── moments.mjs  # 检查页面交互时刻和反馈
    │   │   ├── perf.mjs  # 收集浏览器性能信息供验收
    │   │   ├── photos.mjs  # 整理摄影素材来源与署名页面
    │   │   ├── shoot.mjs  # 捕获页面截图供视觉对照
    │   │   └── start.mjs  # 从资料库选择配色与字体组合，输出样式与字体链接
    │   └── SKILL.md  # 前端视觉设计与界面交付技能入口
    ├── frontend-design/  # 前端视觉方向与界面实现指南
    │   ├── LICENSE.txt  # 该技能随附的授权条款
    │   └── SKILL.md  # 前端视觉方向、字体、色彩、构图与实现工作约定
    └── impeccable/  # 界面设计、评审、可访问性和改进工具
        ├── reference/  # 各设计命令及平台、模式的参考文档
        │   ├── degraded/  # 辅助工具不可用时的分工与操作指南
        │   │   ├── asset-producer.md  # 辅助工具受限时的素材制作分工
        │   │   ├── documenter.md  # 辅助工具受限时的说明文档分工
        │   │   ├── finish-reviewer.md  # 辅助工具受限时的交付验收分工
        │   │   ├── manual-edit-applier.md  # 辅助工具受限时的手动界面修改分工
        │   │   └── motion-reviewer.md  # 辅助工具受限时的动效审核分工
        │   ├── adapt.md  # Web 界面在不同设备和使用环境下的适配
        │   ├── adapt.native.md  # 原生或跨端应用的尺寸、输入和平台适配
        │   ├── android.md  # Android 平台界面与交互约定
        │   ├── animate.md  # 选择并实现用户操作触发的动效
        │   ├── audit.md  # Web 界面的系统性可用性和实现审核
        │   ├── audit.native.md  # 原生应用界面与平台约定审核
        │   ├── bolder.md  # 增强页面视觉冲击力和层次
        │   ├── clarify.md  # 澄清表单、状态和界面文案
        │   ├── colorize.md  # 规划语义色、强调色和可访问对比度
        │   ├── component-review.md  # 审核组件方案、资源和实现范围
        │   ├── craft-floor.md  # 界面交付的最低质量要求
        │   ├── craft.md  # 旧 craft 命令的兼容说明与跳转
        │   ├── critique-rubric.md  # 界面走查的评分维度与判定依据
        │   ├── critique.md  # 从视觉与交互角度评审页面
        │   ├── delight.md  # 设计恰当的细节反馈和体验亮点
        │   ├── distill.md  # 精简页面内容、组件和操作路径
        │   ├── doctor.md  # 排查技能工具或前端检查环境的问题
        │   ├── document.md  # 提取和记录界面设计约定
        │   ├── extract.md  # 整理可复用设计组件与样式变量
        │   ├── foundations.md  # 色彩、排版、空间等基础设计规则
        │   ├── generate.md  # 发起界面或视觉方向的生成流程
        │   ├── harden.md  # 处理边界、错误状态和健壮性
        │   ├── hooks.md  # 技能的 Hook 配置和生效流程
        │   ├── init.md  # 初始化技能的项目资料和检查流程
        │   ├── ios.md  # iOS 平台的界面和交互约定
        │   ├── layout.md  # 页面布局、网格和留白检查
        │   ├── live-setup.md  # 实时浏览器检查环境的准备步骤
        │   ├── live.md  # 实时浏览器观察和界面迭代工作流
        │   ├── mode-operate.md  # 面向持续操作的界面设计模式
        │   ├── mode-persuade.md  # 传播、展示与体验导向的设计模式
        │   ├── mode-read.md  # 长文、信息阅读和内容呈现模式
        │   ├── new-work-comp.md  # 用静态视觉稿引导新界面的流程
        │   ├── new-work-world.md  # 建立或调整整套视觉方向的流程
        │   ├── new-work.md  # 新界面任务的分析、设计和实施流程
        │   ├── onboard.md  # 引导和初次使用流程的设计指南
        │   ├── operate.md  # 操作型界面的深入检查和实现约定
        │   ├── optimize.md  # 前端性能和交互响应的改进指南
        │   ├── overdrive.md  # 强化表现力的进阶效果与交互指南
        │   ├── polish.md  # 细节打磨、状态统一和最终检查
        │   ├── quieter.md  # 降低界面视觉噪声和强调强度
        │   ├── region-map.md  # 页面区域划分与观察命令使用说明
        │   ├── routing.md  # 依据任务目标选择设计或检查命令
        │   ├── shape.md  # 梳理用户任务、范围与界面方案
        │   ├── typeset.md  # 字族、字号、层级和可读性规范
        │   └── visualize.md  # 界面方向对照与视觉素材制作流程
        ├── scripts/  # 工具启动器、浏览器观察脚本、元数据与校验信息
        │   ├── data/  # 字体数据库和字体索引生成过程中的失败记录
        │   │   ├── font-index-failures.json  # 字体索引建立时失败或遗漏的条目记录
        │   │   └── font-index.json  # 配套字体查找使用的索引数据
        │   ├── command-metadata.json  # 工具子命令的名称、参数或运行元数据
        │   ├── engine-checksums.txt  # 确定版本的工具引擎产物校验摘要
        │   ├── impeccable  # 类 Unix 环境的工具启动器
        │   ├── impeccable.cmd  # Windows 环境的工具启动器
        │   ├── live-browser-dom.js  # 实时观察工具的 DOM 查找和提取逻辑
        │   ├── live-browser-ignores.js  # 实时观察工具使用的忽略项规则
        │   ├── live-browser-session.js  # 实时浏览器会话的状态与交互辅助逻辑
        │   ├── live-browser.js  # 实时浏览器观察的配套入口
        │   ├── modern-screenshot.umd.js  # 随技能附带的浏览器截图依赖
        │   └── VERSION  # 随技能配套的引擎版本标记
        └── SKILL.md  # 界面设计、走查、改进和交付的技能入口及命令路由
```

## 4. 应用装配 `apps/`

```text
apps/  # 启动、平台适配、Host 与 Client 插件装配
├── cli/  # LFAA 命令行应用
│   ├── src/  # 命令行参数分发和进程退出处理
│   │   └── bin.ts  # 解析 LFAA 启动目标并负责在退出信号到来时关闭 Web 服务
│   ├── package.json  # @lfaa/app-cli 应用清单，定义本包依赖、脚本与入口
│   └── tsconfig.json  # cli 的 TypeScript 工程配置，限定参与检查的文件并继承根配置
├── web/  # 本地 Vite Web 应用及 Host/Client 装配入口
│   ├── src/  # 服务端装配、浏览器装配和根页面样式
│   │   ├── app.css  # Web 页面基线，主题颜色由 Shell 管理，页面铺满浏览器视口
│   │   ├── main.tsx  # 浏览器 Cordis 装配入口，挂载四栏工作台、主题、分区、项目与聊天 Client
│   │   └── server.ts  # Node Host 装配入口，注册 Agent、聊天、模型、规则、记忆、工具和工作区服务，挂载 HTTP 路由并管理关停
│   ├── index.html  # LFAA Web 文档入口，挂载由 apps/web/src/main.tsx 装配的工作台插件
│   ├── package.json  # @lfaa/app-web 应用清单，定义本包依赖、脚本与入口
│   ├── README.md  # Web 应用职责、入口和构建说明
│   ├── tsconfig.json  # web 的 TypeScript 工程配置，限定参与检查的文件并继承根配置
│   └── vite.config.ts  # 配置 Web 开发服务器、React 转换和生产构建
└── README.md  # 可执行入口的职责边界和应用目录索引
```

## 5. 工作区包 `packages/`

当前有 **11 个**业务或共享能力包。为了方便浏览，下面按 `core`、`ui`、`workspace` 分开列出。包组和包名以实际目录及包清单为准。

### 包目录入口

```text
packages/
├── core/  # Agent、聊天、模型、记忆、规则和工具
├── ui/  # 四栏布局、共享控件和主题
├── workspace/  # 本地项目与自定义分区
└── README.zh.md  # 中文包目录索引和包边界约定
```

### 核心能力 `packages/core/`

```text
packages/core/  # Agent、聊天、模型、存储、规则和工具等核心能力
├── agent/  # Agent 运行时，负责运行状态、工具审批和流式事件
│   ├── src/  # Host 端服务、领域类型和 HTTP 接口
│   │   ├── agent-loop.ts  # 实现 Agent 核心任务循环，思考（Think）-> 行动（Act）-> 检查（Check）
│   │   ├── builtin-agent-tools.ts  # 为 LFAA 内置 Agent 注册记忆写入与资料库/资产库读写工具（随 AgentService 卸载自动清理）
│   │   ├── http-handler.ts  # 为本机 Web 服务提供 /api/agent/* 任务启动、SSE 轨迹推送、人工审批与任务中止接口
│   │   ├── index.ts  # @lfaa/agent Host 侧 Cordis 服务，连接 llm/tools/memory/rules 四大能力并管理任务运行态、SSE 订阅与工具审批
│   │   ├── permission-policy.ts  # 实现三种权限模式（请求批准 ask / 帮我审批 smart / 完全访问 full）的审批决策、风险识别与 3 次自动放行计数持久化
│   │   ├── stream-journal.ts  # 提供 @lfaa/agent 流式断线续传序号日志、句边界续写裁剪、脱敏日志及可观测性指标统计
│   │   └── types.ts  # 定义 @lfaa/agent 的运行契约，权限模式、运行输入、Think/Act/Check 流式事件与人工审批句柄
│   ├── tests/  # 包级行为与回归测试
│   │   └── agent-loop.test.ts  # 验证 @lfaa/agent 集成四大能力并完成 Think -> Act(含审批) -> Check 任务闭环
│   ├── package.json  # @lfaa/agent 包清单，定义依赖、公开导出和工作区包身份
│   └── tsconfig.json  # agent 的 TypeScript 工程配置，限定参与检查的文件并继承根配置
├── chat/  # 聊天、模型配置界面、资料库界面、Git 和代码审查
│   ├── client/  # 聊天 Client 插件、状态、HTTP 与 SSE 客户端及用户界面
│   │   ├── components/  # 聊天、输入栏、设置、模型、资料库和代码审查组件及样式
│   │   │   ├── AgentContextPanel.module.css  # 右侧栏 Agent 四大核心能力实时状态卡样式
│   │   │   ├── AgentContextPanel.tsx  # 在四栏右侧上下文面板实时展示当前 Agent 的 LLM 大脑、工具沙箱、记忆条数与规则层级状态
│   │   │   ├── AgentSettingsView.module.css  # 设置中心“模型、规则与记忆配置”页面样式
│   │   │   ├── AgentSettingsView.tsx  # 渲染“模型、规则与记忆配置”页面（注册在 settings:config），模型管理采用多提供商卡片网格+居中配置弹窗，并支持规则与长期记忆
│   │   │   ├── Ark-Models.module.css  # 方舟套餐目录沿用模型表单的主题变量，为窄屏保留可换行的模型 ID
│   │   │   ├── Ark-Models.tsx  # 浏览器端方舟公开模型目录，嵌入套餐配置表单并与 Host 共用模型契约
│   │   │   ├── ChatAnchorBar.module.css  # 聊天区左侧导航刻度锚点条样式，Dock 波形悬停放大、液态玻璃预览浮卡与书签高亮
│   │   │   ├── ChatAnchorBar.tsx  # 中央聊天区左侧「导航刻度锚点条」，按对话轮次展示刻度线、悬停波浪放大、预览浮卡、书签标记与点击平滑跳转
│   │   │   ├── ChatWorkspace.module.css  # 中央核心聊天与 Agent 任务工作区样式，对齐深色炭黑与浅色纯白画布层次
│   │   │   ├── ChatWorkspace.tsx  # 渲染中央聊天工作区，空会话引导、流式回复、Agent 思考/行动/检查轨迹卡片与底部输入栏
│   │   │   ├── CodeReviewDiffPane.tsx  # 渲染内置代码审查工作台右侧面板，着色 Unified Diff 查看器、PR 草案预览与代码审查发现列表
│   │   │   ├── CodeReviewListPane.tsx  # 渲染内置代码审查工作台左侧清单面板，工作区变更暂存与提交、提交历史浏览及审查报告列表
│   │   │   ├── CodeReviewSettingsView.tsx  # 渲染设置中心「编码 → 代码审查」配置页，子标签页（偏好设置 / 审查智能体）、真实代码仓库列表与个人偏好
│   │   │   ├── CodeReviewView.module.css  # 内置 Git 与代码审查工作台样式，顶栏分支条、双栏工作区变更/差异视图、提交列表与审查发现卡片
│   │   │   ├── CodeReviewView.tsx  # 渲染内置 Git 与代码审查工作台主界面，仓储分支管理、暂存提交、PR 草案、Diff 查看与代码审查报告
│   │   │   ├── CodingSettingsExtras.module.css  # 编码设置页面（Git 与代码审查）补充控件样式，与 GeneralSettingsView.module.css 配合使用
│   │   │   ├── ComposerAddMenu.module.css  # 输入栏左下角 + 按钮、悬浮提示（添加文件等内容 @）及「添加上下文」弹层样式
│   │   │   ├── ComposerAddMenu.tsx  # 聊天输入框的加号菜单，提供添加文件和其他上下文的入口
│   │   │   ├── ComposerRightActions.module.css  # 输入栏右下角语音输入（Ctrl+M）、三竖条录音波形、发送与停止（Ctrl+D）按钮及快捷键提示样式
│   │   │   ├── ComposerRightActions.tsx  # 渲染输入栏右下角语音输入（Ctrl+M 波形状态）、发送与运行中取消（Ctrl+D）按钮及快捷键提示
│   │   │   ├── ComposerScopeBar.module.css  # 聊天输入框上方挂载的工作位置与项目选择条及弹出浮层样式，消费 @lfaa/ui-theme 语义变量兼容明暗主题
│   │   │   ├── ComposerScopeBar.tsx  # 渲染聊天输入框上方的工作位置（此计算机/云端）与项目选择挂载条及搜索弹出浮层
│   │   │   ├── GeneralSettingsControls.tsx  # 提供设置中心「常规」页复用的分组卡片、条目行、开关与圆角弹出式下拉选择菜单（支持图标、副标题与搜索过滤）
│   │   │   ├── GeneralSettingsGeneralGroup.tsx  # 渲染设置中心「常规」页中的核心「常规」设置分组（项目外聊天目录、Shell、语言、历史、推理强度、开源许可证与插件等）
│   │   │   ├── GeneralSettingsSecondary.tsx  # 渲染设置中心「常规」页下半部分分组，编辑器、弹出窗口、通知与趣味实验
│   │   │   ├── GeneralSettingsView.module.css  # 设置中心「常规」视图样式，高密度原生桌面分组卡片、分隔线、开关滑块、分段选择器与弹窗遮罩
│   │   │   ├── GeneralSettingsView.tsx  # 渲染设置中心「常规」主页面，权限卡片、常规/编辑器/通知子分组装配与开源许可证弹窗
│   │   │   ├── GitSettingsView.tsx  # 渲染设置中心「编码 → Git」配置页，分支前缀、PR 合并策略、强制推送、草稿 PR、/review 展示方式及提交/PR 指令
│   │   │   ├── LibraryView.module.css  # 资料库页面样式，紧凑顶部操作栏、分类标题与数量、主区容器与空态引导
│   │   │   ├── LibraryInspector.tsx  # 资料库右栏检视器，未选中展示存储概览，选中后展示媒体/资产详情与操作
│   │   │   ├── LibraryInspector.module.css  # 检视器样式，头部与顶栏齐平，概览/媒体/资产分区块与操作按钮
│   │   │   ├── LibraryMediaGrid.tsx  # 资料库「图像」分类的全宽缩略图网格与类型筛选，点击卡片交给右栏检视器
│   │   │   ├── LibraryView.tsx  # 渲染「资料库」中心页，按左二分类展示图像/资产/记忆，标题带数量、选中项交给右栏检视器
│   │   │   ├── MarkdownContent.module.css  # 助手消息富文本 Markdown 排版样式，标题层级、列表圆点、表格、语法高亮代码块与行内代码胶囊
│   │   │   ├── MarkdownContent.tsx  # 助手消息富文本 Markdown 渲染组件，消除原始 ** / - 等标记符，提供精美排版、表格、代码块语法高亮与一键复制
│   │   │   ├── MentionPopover.module.css  # 输入框上方 @ 提及与扩展上下文分组列表浮层样式（对应图三至图五）
│   │   │   ├── MentionPopover.tsx  # 渲染输入框上方的 @ 提及浮层，支持「添加 / LFAA 对话 / 插件」分组与键盘上下选择
│   │   │   ├── MessageActionBars.module.css  # 消息操作栏（复制/评价/朗读/更多菜单/编辑消息）与已编辑文件折叠卡片样式
│   │   │   ├── MessageActionBars.tsx  # 消息操作栏与文件变更汇总卡片，提供用户消息复制/编辑、助手消息复制/评价/朗读/分支与记忆引用菜单及已编辑文件折叠卡片
│   │   │   ├── ModelProviderGrid.module.css  # 模型管理卡片网格与弹窗表单样式，配合 @lfaa/ui-primitives 居中弹窗使用
│   │   │   ├── ModelProviderGrid.tsx  # 渲染「模型管理」多提供商卡片网格，支持识别已配置状态与当前激活标识，点击任意卡片弹出居中配置弹窗
│   │   │   ├── ModelProviderModal.tsx  # 浏览器端模型配置表单，通过聊天 Store 调用 Host 查询模型、保存档案和测试连接
│   │   │   ├── ModelReasoningPicker.module.css  # 底部输入栏模型选择与推理强度弹窗组件样式，与 @lfaa/ui-primitives 的 PopoverCard / StepSliderPopover 配合使用
│   │   │   ├── ModelReasoningPicker.tsx  # 浏览器端聊天输入栏的模型选择器，连接当前模型档案、品牌切换和思考强度调节
│   │   │   ├── PermissionModePicker.module.css  # 底部权限模式切换胶囊与三种模式弹出菜单样式（对齐参考图层次与橙色警示态）
│   │   │   ├── PermissionModePicker.tsx  # 渲染输入栏底部的三种 Agent 权限模式切换器（请求批准 / 帮我审批 / 完全访问权限）及说明弹层
│   │   │   ├── Provider-Access.module.css  # 提供商接入方式选择弹窗，复用工作台的浅色和深色主题变量
│   │   │   ├── Provider-Access.tsx  # 浏览器端模型接入选择弹窗，根据品牌套餐目录和已保存档案显示可用入口
│   │   │   ├── SessionActionMenu.module.css  # 聊天会话「⋮」上下文操作菜单样式，自适应深浅主题的毛玻璃弹窗、分隔线、快捷键右对齐与级联子菜单
│   │   │   ├── SessionActionMenu.tsx  # 渲染聊天会话「⋮」完整上下文操作菜单（重命名、置顶、标记未读、项目/分区归属、分叉、分享、复制、新窗口、归档与永久删除）
│   │   │   ├── SessionHoverCard.module.css  # 聊天会话行右侧悬浮详情卡片样式，自适应深浅主题的毛玻璃容器、所属项目、时间与未读小点
│   │   │   ├── SessionHoverCard.tsx  # 渲染左二聊天会话行悬停时右侧弹出的液态玻璃信息卡片，标题、所属项目、更新时间与未读状态
│   │   │   ├── SessionOverlays.tsx  # 聚合渲染左二聊天会话行的右侧悬浮卡片、操作菜单、重命名/删除确认弹窗与全局快捷键
│   │   │   ├── SessionRowActions.module.css  # 聊天会话行悬停快捷操作图标按钮样式，带圆形背景高亮与置顶强调态
│   │   │   ├── SessionRowActions.tsx  # 渲染左二聊天会话行右侧的三个快捷图标按钮（归档对话、置顶、⋮ 更多操作）
│   │   │   ├── StepTraceList.module.css  # Agent Think -> Act -> Check 循环轨迹与审批确认卡片样式
│   │   │   ├── StepTraceList.tsx  # 渲染单条助手回复上的流式状态（正在思考/深度思考/正在探索/正在回复）、思考时长、探索次数与 Think -> Act -> Check 循环轨迹
│   │   │   ├── StorageSettingsView.module.css  # 设置中心「存储」视图样式，统计面板、路径模式单选卡片、自定义目录与迁移回执
│   │   │   └── StorageSettingsView.tsx  # 渲染设置中心「存储」视图，支持默认目录 / 项目推荐目录 / 自定义目录切换，并执行无损数据迁移
│   │   ├── chat-store.ts  # 管理 @lfaa/chat 浏览器端会话列表、流式运行 SSE 订阅、工具审批、权限模式、模型配置、规则与长期记忆状态
│   │   ├── chat-types.ts  # 声明 @lfaa/chat/client 浏览器端状态与 API 数据模型（无 Node 专有依赖）
│   │   ├── coding-settings-client.ts  # 客户端访问「设置 → 编码（Git 与代码审查）」与内置 Git / 审查接口的类型与请求函数
│   │   ├── composer-context.ts  # 管理输入栏附件上下文芯片、@ 提及指令检索提取以及发送前上下文拼装的纯函数（无 DOM 依赖）
│   │   ├── css-modules.d.ts  # 声明 @lfaa/chat/client 中 CSS Modules 的类型定义
│   │   ├── follow-up-suggestions.ts  # 根据最新一轮问答上下文生成 3 条轻量延伸追问建议，显示在助手最新回复下方供一键点击追问
│   │   ├── general-settings-client.ts  # 提供浏览器端通用设置默认结构、长路径中间省略格式化、开源依赖读取及轻量提示音播放辅助
│   │   ├── index.tsx  # 导出 @lfaa/chat/client Cordis 插件，装配主聊天工作台、资料库检视器、能力上下文栏与模型规则设置页
│   │   ├── media-thumb-cache.ts  # 生成素材缩略图缓存：优先宿主缩略图接口，未命中才取原图缩成 480/960px WebP 并回传宿主与浏览器缓存
│   │   ├── library-store.ts  # 资料库中心页与右栏检视器共享的选中项与生成素材列表存储（唯一所有者，删除两处同步）
│   │   ├── local-speech.ts  # 在浏览器端通过 Web Audio 采集麦克风音频并编码为 16kHz 单声道 PCM WAV，供 Host 离线语音识别
│   │   ├── locales.ts  # 管理 @lfaa/chat 浏览器端界面中英文文案字典
│   │   ├── markdown-parser.ts  # 轻量流式安全 Markdown 块级解析与代码语法分词器，用于渲染助手消息中的标题、列表、表格、引用与高亮代码块
│   │   ├── provider-catalog.ts  # 定义「模型管理」提供商卡片目录与官方 API 协议格式映射（OpenAI Chat / Responses / Anthropic Messages / Gemini generateContent）
│   │   ├── provider-plans.ts  # 定义模型管理中可直接用专属 API Key 接入的官方套餐，供浏览器选择与档案匹配
│   │   ├── session-menu-store.ts  # 管理左二聊天会话行的右侧悬浮信息卡与「⋮」操作菜单状态，支持悬停延迟平滑过渡
│   │   ├── stream-client.ts  # 浏览器端高可用流式订阅器，提供按片段序号幂等去重、RAF 节流批量渲染、心跳看门狗、指数退避重连与完整句边界续写辅助
│   │   ├── useLibraryState.ts  # 订阅资料库选中项与素材列表的 React 入口，供中心页与右栏检视器共用
│   │   └── useVoiceDictation.ts  # 管理聊天输入栏的语音听写状态与双引擎切换（优先浏览器在线识别，network 失败自动无缝切换本机离线 WAV 转写）
│   ├── src/  # 聊天 CRUD、语音转写、用户设置、Git 与代码审查服务
│   │   ├── coding-settings.ts  # 管理 LFAA「设置 → 编码（Git 与代码审查）」持久化配置（存于 ~/.lfaa/coding-settings.json）
│   │   ├── general-settings.ts  # 管理 LFAA「设置 → 常规」持久化配置（存于 ~/.lfaa/general-settings.json），并动态检测当前系统用户的默认项目外聊天目录
│   │   ├── git-http-handler.ts  # 为本机 Web 服务提供 /api/chat/coding-settings、/api/git/* 与 /api/code-review/* 内置 Git 与审查接口
│   │   ├── git-service.ts  # 提供 LFAA 内置 Git 服务，仓储探测、状态与差异读取、分支切换/前缀新建、暂存与提交、PR 草案生成
│   │   ├── http-handler.ts  # 为本机 Web 服务提供 /api/chat/* 聊天会话 CRUD 与项目聊天数统计接口
│   │   ├── index.ts  # @lfaa/chat Host 侧 Cordis 服务，基于 @lfaa/memory 暴露聊天会话 CRUD 与项目维度聊天统计
│   │   ├── review-service.ts  # 提供 LFAA 内置代码审查引擎，结合静态/差异规则分析与审查历史持久化（存于 ~/.lfaa/code-reviews.json）
│   │   └── speech-service.ts  # 为 Host 侧提供零外网依赖的本机离线 WAV 语音转文字能力（Windows System.Speech SAPI）
│   ├── tests/  # 包级行为与回归测试
│   │   ├── chat-lifecycle.test.ts  # 验证 @lfaa/chat Host/Client 双端 Cordis 生命周期、最近会话注入与项目聊天计数统计
│   │   └── provider-catalog.test.ts  # 提供商接入预设的回归测试，验证套餐凭据、计费路由和旧档案匹配保持隔离
│   ├── package.json  # @lfaa/chat 包清单，定义依赖、公开导出和工作区包身份
│   └── tsconfig.json  # chat 的 TypeScript 工程配置，限定参与检查的文件并继承根配置
├── llm/  # 模型档案、提供商协议、推理调用与模型能力
│   ├── src/  # 模型提供商适配器、模型档案、调用和能力解析
│   │   ├── anthropic-adapter.ts  # Anthropic Messages API (/v1/messages) 适配器，支持 Claude 官方及 DeepSeek Anthropic 格式接口
│   │   ├── ark-plan.ts  # 方舟个人套餐公开模型目录与思考参数契约，供 Host 请求适配和浏览器模型选择共用
│   │   ├── capabilities.ts  # 解析模型目录中的能力、思考档位和协议兼容信息
│   │   ├── gemini-adapter.ts  # Google Gemini 原生 generateContent / streamGenerateContent 协议适配器
│   │   ├── http-handler.ts  # 模型配置、模型发现、连接测试与推理的 /api/llm/* 路由
│   │   ├── index.ts  # @lfaa/llm Host 侧 Cordis 服务，管理模型配置与安全凭据，并驱动思考与推理调用
│   │   ├── openai-adapter.ts  # Host 侧 Chat Completions 适配器，用统一的 LLM 契约处理方舟、DeepSeek、OpenAI 和 Ollama 的响应
│   │   ├── protocol-utils.ts  # 提供 @lfaa/llm 的协议识别、校验、URL 规范化与 SSE 增量行解析工具
│   │   ├── responses-adapter.ts  # OpenAI Responses API (/responses) 适配器，支持 OpenAI 与 DeepSeek Responses 接口及流式工具调用
│   │   └── types.ts  # 定义 @lfaa/llm 包的 Host 侧无 DOM 公共契约类型，模型配置、API 协议格式、官方模型能力、思考强度与流式事件
│   ├── tests/  # 包级行为与回归测试
│   │   ├── ark-plan.test.ts  # 验证方舟套餐目录、官方思考档位及 OpenAI Chat 适配器发送的实际参数
│   │   └── llm-service.test.ts  # 验证 @lfaa/llm Cordis 服务注册、API Key 脱敏持久化、活跃模型切换及流式/非流式适配器调用
│   ├── package.json  # @lfaa/llm 包清单，定义依赖、公开导出和工作区包身份
│   └── tsconfig.json  # llm 的 TypeScript 工程配置，限定参与检查的文件并继承根配置
├── memory/  # 本地聊天会话、长期记忆、资料库资产和存储根目录
│   ├── src/  # 会话、长期记忆、资产清单及资料库迁移
│   │   ├── asset-store.ts  # 管理资料库本地资产与 Agent 产物存储（<dataRoot>/agent-outputs、user-assets 及 vault-index.json）
│   │   ├── http-handler.ts  # 为本机 Web 服务提供 /api/memory*、/api/library* 与 /api/storage* HTTP 接口，支持记忆、资产库与无损存储迁移
│   │   ├── index.ts  # @lfaa/memory Host 侧 Cordis 服务，统一对外提供短期会话记忆、长期事实记忆、资料库资产/产物及存储迁移服务
│   │   ├── longterm-store.ts  # 管理长期事实记忆存储（~/.lfaa/memory.json），支持按项目/全局写入、列表管理与关键词召回
│   │   ├── session-store.ts  # 管理本地短期会话记忆文件（~/.lfaa/sessions/*.json）与上下文窗口摘要裁剪
│   │   ├── storage-manager.ts  # 管理 LFAA 资料库与资产库本地根路径配置、旧数据接管、统计及无损跨目录迁移（Copy-Verify-Switch）
│   │   ├── types.ts  # 定义 @lfaa/memory 的无 DOM 领域契约，会话消息、思考/行动/检查步骤轨迹及长期记忆条目
│   │   └── vault-layout.ts  # 资料库的目录与文件命名常量，供资产和存储服务共用
│   ├── tests/  # 包级行为与回归测试
│   │   └── memory-service.test.ts  # 验证 @lfaa/memory 短期会话持久化、项目聊天计数（不含归档）、窗口裁剪及长期记忆召回
│   ├── package.json  # @lfaa/memory 包清单，定义依赖、公开导出和工作区包身份
│   └── tsconfig.json  # memory 的 TypeScript 工程配置，限定参与检查的文件并继承根配置
├── rules/  # 系统、项目与用户规则的发现、保存和提示词装配
│   ├── src/  # Host 端服务、领域类型和 HTTP 接口
│   │   ├── http-handler.ts  # 为本机 Web 服务提供 /api/rules* HTTP 接口，用于查看分层规则及保存用户全局规则
│   │   ├── index.ts  # @lfaa/rules Host 侧 Cordis 服务，强制系统规则基线、发现项目规则文件、持久化用户全局规则并按优先级拼装系统提示词
│   │   └── types.ts  # 定义 @lfaa/rules 的无 DOM 领域契约，规则层级、规则文档及提示词装配输出
│   ├── tests/  # 包级行为与回归测试
│   │   └── rules-service.test.ts  # 验证 @lfaa/rules 分层规则加载顺序（系统 > 项目 > 用户）、项目规则自动发现及卸载清理
│   ├── package.json  # @lfaa/rules 包清单，定义依赖、公开导出和工作区包身份
│   └── tsconfig.json  # rules 的 TypeScript 工程配置，限定参与检查的文件并继承根配置
└── tools/  # 工具注册、工具执行边界与内置工作区工具
    ├── src/  # 工具注册、目录路径沙箱及内置工作区工具
    │   ├── builtin-tools.ts  # 提供内置核心工作区工具集（读文件、列目录、文本搜索、写文件、局部替换、命令执行）
    │   ├── index.ts  # @lfaa/tools Host 侧 Cordis 服务，统一管理工具注册表、内置工作区工具与权限安全执行
    │   ├── sandbox.ts  # 解析和校验工具访问路径，约束目录边界并处理符号链接
    │   └── types.ts  # 定义 @lfaa/tools 的无 DOM 领域契约，工具权限级别、参数协议、执行上下文及结果结构
    ├── tests/  # 包级行为与回归测试
    │   └── tools-service.test.ts  # 验证 @lfaa/tools 路径沙箱越界拦截、文件读写/搜索工具执行与 Cordis 插件注册注销
    ├── package.json  # @lfaa/tools 包清单，定义依赖、公开导出和工作区包身份
    └── tsconfig.json  # tools 的 TypeScript 工程配置，限定参与检查的文件并继承根配置
```

### 共享界面 `packages/ui/`

```text
packages/ui/  # 公共 Shell、主题与跨业务交互原语
├── layout/  # 四栏布局、导航、分栏拖拽与 Workbench 贡献契约
│   ├── client/  # 四栏 Shell、主题消费、导航状态和布局交互
│   │   ├── components/  # 左一、左二、顶部、右栏与分隔手柄等 Shell 组件
│   │   │   ├── AppMenu.module.css  # 更多应用弹层与固定到一级栏的图钉操作
│   │   │   ├── AppMenu.tsx  # 展示更多应用。桌面支持固定入口，手机汇总从底栏移入的功能
│   │   │   ├── ContextPanel.module.css  # 四栏右侧菜单栏样式，使用统一主题变量并与左二栏视觉一致
│   │   │   ├── ContextPanel.tsx  # 呈现四栏布局的右侧上下文菜单栏，渲染插件注册的上下文面板
│   │   │   ├── DomainSidebarMenu.tsx  # 根据左一导航栏选中的功能域（资料库含图像分类、定时任务、插件、代码审查与扩展），动态渲染对应的左二功能菜单
│   │   │   ├── GroupHeaderTools.tsx  # 渲染左二分组标题栏右侧按需显现的排序下拉按钮与快捷操作按钮（如新建项目 / 新聊天）
│   │   │   ├── NavigationGroups.module.css  # 工作区侧栏专属“新聊天”按钮与项目排序/创建工具栏样式（其余列表样式复用 SidebarSectionList）
│   │   │   ├── NavigationGroups.tsx  # 管理工作区“新聊天”与置顶、自定义分区、项目、最近聊天分组，并复用 SidebarSectionList 渲染
│   │   │   ├── NavigationIcon.tsx  # 将统一的 Tabler 图标映射为侧栏可复用组件
│   │   │   ├── NavigationRail.module.css  # 一级图标栏及其悬浮菜单，使用 Shell 提供的主题变量
│   │   │   ├── NavigationRail.tsx  # 呈现工作台一级图标栏，负责直接导航、更多菜单及本地工作区状态
│   │   │   ├── NavigationSidebar.module.css  # 左二导航栏顶部工具、模式切换与设置菜单容器
│   │   │   ├── NavigationSidebar.tsx  # 复用同一套左二菜单栏骨架，根据 WorkbenchDomainConfig 切换头部形态与业务菜单内容
│   │   │   ├── ResizeHandle.module.css  # 浏览器工作台的左右栏分隔手柄、高亮反馈及拖拽裁剪
│   │   │   ├── SearchDialog.module.css  # 搜索弹层为 Shell 导航提供聚焦后的快速入口
│   │   │   ├── SearchDialog.tsx  # 本地导航与项目搜索弹层，支持聚焦和键盘操作
│   │   │   ├── SettingsMenu.tsx  # 将设置中心目录映射为通用 SidebarSectionList 配置，复用同一套左二菜单栏组件与样式
│   │   │   ├── SidebarResizeHandle.tsx  # 渲染桌面端左二栏或右侧栏边缘的垂直拖拽调宽手柄
│   │   │   ├── SidebarSectionList.module.css  # 统一的左二菜单栏分组、列表、搜索框与空态样式，供工作区与设置中心共用
│   │   │   ├── SidebarSectionList.tsx  # 统一的左二菜单栏列表原语，复用搜索框、分组标题、折叠能力、拖拽分区、空态与液态玻璃交互样式
│   │   │   ├── UserMenu.module.css  # 用户菜单固定在一级图标栏左下角，并跟随 Shell 主题变量
│   │   │   ├── UserMenu.tsx  # 展示本地用户菜单，并复用现有外观设置入口与主题插件提供的头部快捷操作
│   │   │   ├── WorkbenchShell.module.css  # 四栏可折叠工作区主结构，消费 @lfaa/ui-theme 提供的明暗与玻璃配色变量
│   │   │   ├── WorkbenchShell.tsx  # 装配主题、四栏可折叠骨架，并通过 Cordis workbench 服务响应业务插件贡献
│   │   │   └── WorkspaceBar.tsx  # 渲染工作区顶部栏，左侧栏展开/收起按钮、当前标题、本地模式状态与右侧栏展开/收起按钮
│   │   ├── css-modules.d.ts  # 为 Client 中的 CSS Modules 提供静态类名类型
│   │   ├── index.tsx  # 导出浏览器工作区插件入口与服务类型，不把 React 或 DOM 引入 Host 入口
│   │   ├── locales.ts  # 集中维护 Shell、导航和本地项目界面的中英文文案
│   │   ├── navigation.ts  # 定义浏览器 Shell 共用的导航与最近列表类型，项目类型由公共契约提供
│   │   ├── settings-catalog.ts  # 定义设置中心左二栏的分组目录与中英文标题，保持未接入项状态透明
│   │   ├── sidebar-resize.ts  # 计算左二栏与右侧栏拖拽调宽、弹性阻尼压缩、中心区保护与 50% 阈值磁吸折叠纯函数
│   │   ├── ui-preferences.ts  # 统一管理浏览器端 Shell 交互记忆（路由、左右栏折叠、分组展开、自定义分区折叠、排序与模式），刷新后完整保留用户操作
│   │   ├── usePinnedApps.ts  # 读取并持久化侧栏固定的应用入口，默认固定参考图中的站点
│   │   ├── useSidebarResize.ts  # 管理浏览器工作台的左右栏调宽、弹性吸附和本地宽度偏好
│   │   ├── useViewportMode.ts  # 监听桌面、平板与手机断点，供四栏 Shell 切换侧栏抽屉与移动底栏模式
│   │   ├── workbench-domains.ts  # 按当前视图解析四栏工作台所属功能域、菜单配置与显示标题
│   │   └── workbench-service.ts  # 在浏览器 Cordis 上下文中注册并管理四栏工作台服务与插件贡献生命周期
│   ├── src/  # 无 DOM 的四栏区域与 Workbench 贡献契约
│   │   └── index.ts  # 声明四栏 Shell 的无 DOM 公共区域标识与跨包插件贡献契约，供 Host 与 Client 共同使用
│   ├── tests/  # 包级行为与回归测试
│   │   └── persistence-lifecycle.test.ts  # 验证四栏 Shell 与界面交互偏好的浏览器持久化记忆（导航路由、左右栏折叠、分组收起、分区折叠、排序与模式）
│   ├── package.json  # @lfaa/ui-layout 包清单，定义依赖、公开导出和工作区包身份
│   ├── README.i18n.yaml  # layout 包说明的双语内容源
│   ├── README.md  # layout 包的英文说明，介绍职责、入口与使用方式
│   ├── README.zh.md  # layout 包的中文说明，介绍职责、入口与使用方式
│   └── tsconfig.json  # layout 的 TypeScript 工程配置，限定参与检查的文件并继承根配置
├── primitives/  # 弹窗、提示、浮层、状态横幅、步进滑块等共享控件
│   ├── client/  # 可被业务包复用的弹窗、悬停提示、步进滑块和状态横幅
│   │   ├── ConfirmDialog.module.css  # 共享二次确认弹窗样式，居中液态玻璃卡片、柔和暗红警示按钮与高对比度文本
│   │   ├── ConfirmDialog.tsx  # 共享二次确认弹窗组件，采用居中液态玻璃卡片、柔和暗红警示按钮与高对比度文本，供删除/移除等高风险操作复用
│   │   ├── css-modules.d.ts  # 浏览器组件使用的 CSS Modules 声明，将导入的局部类名暴露为字符串映射
│   │   ├── HoverTip.module.css  # 共享悬停提示胶囊样式，正上方居中对齐、暗色半透明磨砂胶囊与快捷键徽章
│   │   ├── HoverTip.tsx  # 共享悬停提示胶囊组件，统一在触发按钮正上方居中展示暗色圆角提示与快捷键徽章
│   │   ├── index.tsx  # 统一导出 @lfaa/ui-primitives 共享交互组件（居中弹窗、锚点浮窗卡片、步进滑块弹窗）及基础类型
│   │   ├── ModalDialog.module.css  # @lfaa/ui-primitives 居中弹窗通用样式，遮罩、弹窗尺寸与统一进场动效预设（scale / fade / slide-up）
│   │   ├── ModalDialog.tsx  # 提供全局统一的居中弹窗组件，支持 Escape 与遮罩关闭、自定义尺寸、图标头与集中可调进场动画预设
│   │   ├── PopoverCard.module.css  # @lfaa/ui-primitives 锚点浮层弹窗样式，支持上下左右锚点与平滑缩放弹出动效
│   │   ├── PopoverCard.tsx  # 提供可复用的锚点浮层卡片容器，自动处理外部点击关闭与 Escape 退出，供模型选择器和工具浮窗复用
│   │   ├── StatusBanner.module.css  # @lfaa/ui-primitives 语义化提示通知横幅样式，支持 success / error / warning / info / loading 统一对比度与动效
│   │   ├── StatusBanner.tsx  # 提供全站复用的语义化状态通知横幅（success / error / warning / info / loading），统一通知视觉对比度与关闭交互
│   │   ├── StepSliderPopover.module.css  # @lfaa/ui-primitives 步进滑块弹窗样式，带圆点刻度轨道、主题色进度条、大圆手柄及重设按钮
│   │   └── StepSliderPopover.tsx  # 提供可复用的离散档位滑块弹窗内容组件（如推理强度调节），支持平滑拖拽与磁吸阈值、圆点点击、键盘调节、无规则流星粒子流及闪电极强开关
│   ├── src/  # 共享控件可复用类型、默认值与纯计算函数
│   │   └── index.ts  # 定义 @lfaa/ui-primitives 无 DOM 公共契约类型与纯计算工具函数，供 Host 与各业务 UI 包统一复用弹窗尺寸、动效预设及步进计算
│   ├── tests/  # 包级行为与回归测试
│   │   └── primitives-contract.test.ts  # 验证 @lfaa/ui-primitives 共享交互原语包导出、步进比值计算及包边界契约
│   ├── package.json  # @lfaa/ui-primitives 包清单，定义依赖、公开导出和工作区包身份
│   └── tsconfig.json  # primitives 的 TypeScript 工程配置，限定参与检查的文件并继承根配置
└── theme/  # 主题预设、浅深色、强调色和外观设置
    ├── client/  # 浏览器主题变量注入、外观状态与设置页面
    │   ├── components/  # 该包拥有的界面组件与 CSS Modules
    │   │   ├── AccentSelect.module.css  # 强调色下拉菜单与苹果液态玻璃浮层样式
    │   │   ├── AccentSelect.tsx  # 提供带色点预览与自定义取色器的强调色下拉菜单，使用 Portal 挂载到 body 避免被毛玻璃卡片裁切或偏移
    │   │   ├── AppearanceAdvanced.module.css  # 外观页高级设置区的数值输入、分段器、开关与对比度滑块样式
    │   │   ├── AppearanceAdvanced.tsx  # 呈现外观设置页的可折叠“高级”分组，字号、动态效果、独立明暗、侧边栏半透明与对比度等实时调节
    │   │   ├── AppearanceSettings.module.css  # 外观设置页苹果液态玻璃卡片、模式预览胶囊、色值输入、分段器与滑块样式
    │   │   ├── AppearanceSettings.tsx  # 呈现设置中心“外观”页面，模式预览、液态玻璃主题预设、强调色、背景/前景、字体与高级选项
    │   │   ├── ThemeModeQuickSwitch.module.css  # 用户菜单头部右侧的外观模式快捷切换胶囊与三选一液态玻璃浮层样式
    │   │   ├── ThemeModeQuickSwitch.tsx  # 用户账户菜单头部右侧的外观模式快捷切换胶囊与“跟随系统 / 浅色模式 / 深色模式”三选一浮层菜单
    │   │   └── ThemeSelect.tsx  # 通用外观设置页液态玻璃下拉选择器，复用强调色菜单视觉规范，替代原生浏览器 <select> 弹窗
    │   ├── appearance-store.ts  # 在浏览器端管理 LFAA 主题与液态玻璃配置，启动即同步至根元素 CSS 变量并监听系统明暗切换
    │   ├── css-modules.d.ts  # 为主题包 Client 侧 CSS Modules 提供类型声明
    │   ├── index.tsx  # 导出主题包的 Client Cordis 插件入口，启动即同步主题 CSS 变量，并向工作台注册“外观”设置视图
    │   ├── locales.ts  # 集中维护主题与外观设置页面在中英文环境下的展示文案
    │   └── tokens.css  # 主题语义变量定义层：浅色/深色/系统主题成对定义，组件只消费变量
    ├── src/  # 主题预设、外观配置、色值与序列化契约
    │   └── index.ts  # 定义外观与液态玻璃主题系统的数据模型、预设配置及安全序列化工具
    ├── tests/  # 包级行为与回归测试
    │   └── theme-lifecycle.test.ts  # 验证主题包 Host/契约预设导出及 Client 插件在工作台注册与卸载清理
    ├── package.json  # @lfaa/ui-theme 包清单，定义依赖、公开导出和工作区包身份
    ├── README.i18n.yaml  # theme 包说明的双语内容源
    ├── README.md  # theme 包的英文说明，介绍职责、入口与使用方式
    ├── README.zh.md  # theme 包的中文说明，介绍职责、入口与使用方式
    └── tsconfig.json  # theme 的 TypeScript 工程配置，限定参与检查的文件并继承根配置
```

### 工作区能力 `packages/workspace/`

```text
packages/workspace/  # 工作区项目与自定义分区业务包
├── sections/  # 自定义分区的存储、接口、Provider 和浏览器 UI
│   ├── client/  # 分区管理弹窗、菜单动作与浏览器分区 Provider
│   │   ├── components/  # 该包拥有的界面组件与 CSS Modules
│   │   │   ├── SectionDialog.module.css  # 新建/重命名分区整页居中弹窗样式，沿用 LFAA 液态玻璃主题与强调色
│   │   │   ├── SectionDialog.tsx  # 新建或重命名分区的整页居中液态玻璃弹窗
│   │   │   ├── SectionRowActions.module.css  # 自定义分区标题栏操作按钮与弹出管理菜单样式
│   │   │   └── SectionRowActions.tsx  # 渲染左二自定义分区标题行右侧操作按钮（··· 管理菜单与新聊天入口）
│   │   ├── css-modules.d.ts  # 为分区包 Client 侧 CSS Modules 提供类型声明
│   │   ├── index.tsx  # 导出分区包 Client Cordis 插件入口，向工作台注册自定义分区提供方并在删除分区时广播事件
│   │   ├── locales.ts  # 集中维护工作区自定义分区模块在中英文环境下的创建、重命名与管理文案
│   │   └── section-store.ts  # 通过 /api/workspace/sections* 与 Host SectionsService 同步分区列表，并通过本地缓存加快首屏显示
│   ├── src/  # Host 端服务、领域类型和 HTTP 接口
│   │   ├── http-handler.ts  # 为 Web 开发服务提供 /api/workspace/sections* HTTP RPC 路由桥接
│   │   ├── index.ts  # 声明自定义分区包的 Host 侧 Cordis 服务与无 DOM 领域契约
│   │   └── types.ts  # 定义自定义分区包在 Host 与 Client 间共享的无 DOM 领域数据结构
│   ├── tests/  # 包级行为与回归测试
│   │   └── sections-lifecycle.test.ts  # 验证自定义分区包 Host 服务生命周期、CRUD/重名校验、级联清理以及 Client 插件注册与卸载
│   ├── package.json  # @lfaa/sections 包清单，定义依赖、公开导出和工作区包身份
│   ├── README.i18n.yaml  # sections 包说明的双语内容源
│   ├── README.md  # sections 包的英文说明，介绍职责、入口与使用方式
│   ├── README.zh.md  # sections 包的中文说明，介绍职责、入口与使用方式
│   └── tsconfig.json  # sections 的 TypeScript 工程配置，限定参与检查的文件并继承根配置
└── workspace/  # 本地项目、目录选择、项目文件浏览与展示
    ├── client/  # 项目 Provider、业务状态、项目文件视图和管理弹窗
    │   ├── components/  # 该包拥有的界面组件与 CSS Modules
    │   │   ├── EditProjectDialog.module.css  # 编辑项目整页居中弹窗样式，对齐参考设计并沿用 LFAA 液态玻璃主题变量与强调色
    │   │   ├── EditProjectDialog.tsx  # 编辑项目弹窗，支持修改项目名、增删多个本机源文件夹，或从本地列表安全移除项目
    │   │   ├── ProjectActionMenu.module.css  # 点击项目行“···”弹出的操作菜单样式，参考所附菜单结构并复用 LFAA 液态玻璃变量
    │   │   ├── ProjectActionMenu.tsx  # 点击项目行“···”后在按钮下方弹出的操作菜单，支持置顶、编辑、分区、在资源管理器中打开、归档聊天（禁用态）与移除项目
    │   │   ├── ProjectContextPanel.module.css  # 右侧上下文面板卡片样式，复用 Shell 主题与液态玻璃变量
    │   │   ├── ProjectContextPanel.tsx  # 渲染由 @lfaa/workspace 插件贡献到四栏右侧菜单栏的上下文详情与项目目录移除操作
    │   │   ├── ProjectDialog.module.css  # 创建项目与目录信任确认弹窗样式，复用 LFAA 液态玻璃主题变量与强调色
    │   │   ├── ProjectDialog.tsx  # 创建项目弹窗，支持输入名称、本机资源管理器选目录 / 远程说明，以及按“文档/lfaa”生成前的目录信任确认
    │   │   ├── ProjectHoverCard.module.css  # 项目详情悬浮卡布局、边框与主题样式
    │   │   ├── ProjectHoverCard.tsx  # 渲染项目行“···”触发的液态玻璃悬浮信息卡，展示项目名、置顶开关、聊天次数、源文件夹路径与“编辑项目”入口
    │   │   ├── ProjectOverlays.tsx  # 宿主工作区项目悬浮卡片、操作下拉菜单与“编辑项目”整页弹窗的统一挂载宿主
    │   │   ├── ProjectRowActions.module.css  # 左二项目行尾“···”与新建聊天操作按钮样式
    │   │   ├── ProjectRowActions.tsx  # 渲染左二项目行右侧的两个快捷操作图标（··· 详情/操作菜单 与 ✎ 项目内新建聊天）
    │   │   ├── ProjectWorkspace.module.css  # 工作区插件贡献的主工作区视图与真实项目文件树样式，复用液态玻璃变量
    │   │   ├── ProjectWorkspace.tsx  # 渲染由 @lfaa/workspace 插件贡献的项目概览页与绑定真实本地目录的文件工作区
    │   │   ├── RemoveProjectDialog.module.css  # 移出项目二次确认弹窗样式，采用居中液态玻璃卡片、柔和暗红警示按钮与高对比度文本
    │   │   └── RemoveProjectDialog.tsx  # 移出项目二次确认弹窗，复用 @lfaa/ui-primitives 的共享 ConfirmDialog，明确告知仅从应用中移出
    │   ├── css-modules.d.ts  # 为工作区包 Client 侧 CSS Modules 提供类型声明
    │   ├── index.tsx  # 导出工作区包 Client 插件入口，通过 Cordis inject 获取 workbench 服务并贡献项目、悬停/操作卡片及右侧上下文
    │   ├── local-project-store.ts  # 通过同源 /api/workspace/* RPC 与 Host WorkspaceService 同步真实本地项目和目录信息，并缓存快照供首屏显示和后台刷新
    │   ├── locales.ts  # 集中维护工作区插件在中英文环境下的本地项目、资源管理器选择、目录信任及工作区文案
    │   └── project-menu-store.ts  # 管理左二项目行的 Hover 信息卡、Click 操作菜单、抑制滞留悬停与“编辑项目”弹窗状态
    ├── src/  # Host 端服务、领域类型和 HTTP 接口
    │   ├── http-handler.ts  # 为仅监听本机 127.0.0.1 的 Web 开发服务提供 /api/workspace/* HTTP 中间件桥接
    │   ├── index.ts  # 声明工作区包的 Host 侧 Cordis 服务与无 DOM 领域契约
    │   ├── system-paths.ts  # 负责动态解析本机文档目录（含 Windows 重定向路径）、安全目录名及原生文件夹选择器
    │   └── types.ts  # 定义工作区 Host 侧与 RPC 共享的无 DOM 领域数据结构
    ├── tests/  # 包级行为与回归测试
    │   └── cordis-lifecycle.test.ts  # 验证四栏契约、Host 服务注册、项目目录解析与持久化的 Cordis 生命周期
    ├── package.json  # @lfaa/workspace 包清单，定义依赖、公开导出和工作区包身份
    ├── README.i18n.yaml  # workspace 包说明的双语内容源
    ├── README.md  # workspace 包的英文说明，介绍职责、入口与使用方式
    ├── README.zh.md  # workspace 包的中文说明，介绍职责、入口与使用方式
    └── tsconfig.json  # workspace 的 TypeScript 工程配置，限定参与检查的文件并继承根配置
```

## 6. 工程脚本 `scripts/`

```text
scripts/  # Windows 启动、依赖检查及脚本回归测试
├── ensure-dependencies.mjs  # 仓库依赖状态预检与安全增量安装脚本，在 Node 环境中核对 workspace/lockfile，避免破坏性重建
├── ensure-dependencies.test.mjs  # 依赖预检脚本的回归测试，覆盖 Windows 换行与 pnpm 规范化副本的兼容性
├── lfaa.ps1  # Windows 菜单，处理依赖安装、Web 启动以及 GitHub 源码推送和拉取
└── README.md  # 仓库脚本索引，说明 Windows 启动与依赖预检
```

## 7. 项目文档 `docs/`

`docs/updata-log/` 当前有 **125 份**更新记录，下面按文件名及主题逐条列出。逐轮开发记录在 `dev-log` 卷中，可以用任务编号查找。

```text
docs/  # 架构、开发规范、开发日志、更新说明和协作模板
├── architecture/  # 架构基线、实施前设计方案和仓库结构索引
│   ├── extensions.md  # 拟建 skills、plugins 的包边界、二创、装卸与验收方案
│   ├── overview.md  # 项目整体技术栈、包边界、Host/Client 依赖方向与四栏 Shell 决策
│   ├── plan-mode.md  # Plan 模式的交互、契约、持久化与分阶段实施方案
│   ├── README.md  # 架构文档索引，连接基线、现有设计方案和本说明书
│   └── repository-map.md  # 当前工作区的目录总览及逐文件职责说明
├── dev-log/  # 维护者的逐轮变更与验证记录，按编号范围归卷
│   ├── .gitkeep  # Git 目录占位文件，确保日志目录可被版本控制保留
│   └── 000001-000200.md  # 开发日志范围卷，按任务编号收录实际变更、验证和回滚，当前卷覆盖 000001–000200
├── standards/  # 项目工程规则的详细条款
│   └── AI-Agent-Development-Standards.md  # 完整的工程、命名、审批、架构、测试与日志规范
├── templates/  # 开发日志、更新日志的填写模板
│   ├── dev-log.template.md  # 开发日志模板，涵盖变更文件、测试证据和回滚
│   └── updata-log.template.md  # 更新日志模板，用于说明用户能感知到的变化
├── updata-log/  # 面向用户的功能更新与修复说明，按任务编号记录
│   ├── .gitkeep  # Git 目录占位文件，确保更新日志目录可被版本控制保留
│   ├── 000002-20261117-1117-windows-launcher.md  # 更新记录 · Windows 启动菜单
│   ├── 000003-20261117-1123-powershell-encoding-fix.md  # 更新记录 · 修复 Windows 启动器闪退
│   ├── 000004-20261117-1135-web-startup.md  # 更新记录 · Web 工作区可以启动
│   ├── 000005-20261117-1222-appearance-theme.md  # 更新记录 · 工作区外观设置
│   ├── 000006-20261117-1436-user-menu.md  # 更新记录 · 左下角用户菜单
│   ├── 000007-20261117-1521-sidebar-navigation.md  # 更新记录 · 参考图侧栏导航与本地项目
│   ├── 000008-20261117-1842-fix-ensure-dependencies-pnpm11.md  # 更新记录 · 修复 lfaa.bat 选项 2 依赖增量安装报错
│   ├── 000009-20261117-1914-optimize-launcher-cache.md  # 更新记录 · 优化 lfaa.bat 依赖缓存复用并修复选项 1 报错提示
│   ├── 000010-20261117-1938-fix-topbar-alignment-and-settings-sidebar.md  # 更新记录 · 修复三栏顶栏对齐与设置中心左二菜单切换
│   ├── 000011-20261117-1949-install-ui-skills-and-responsive-adaptation.md  # 更新记录 · 支持桌面 / 平板 / 手机全端响应式布局与视觉细节优化
│   ├── 000012-20261117-1959-liquid-glass-appearance-and-settings.md  # 更新记录 · 全新设置中心外观能力与苹果液态玻璃视觉风格
│   ├── 000013-20261117-2002-fix-typography-scale-consistency.md  # 更新记录 · 修复不同设备下字体偏大与字号比例不一致问题
│   ├── 000014-20261117-2005-fix-settings-sidebar-reuse-and-overflow.md  # 更新记录 · 消除设置中心左二菜单栏横向滚动条与重复图标
│   ├── 000015-20261117-2017-unify-workbench-reuse-and-domain-config.md  # 更新记录 · 设置中心直接复用左一/左二/中间三栏布局与统一侧栏菜单
│   ├── 000016-20261117-2020-flush-accent-scrollbar-and-cascade-fix.md  # 更新记录 · 滚动条紧贴右缘并随强调色实时变色
│   ├── 000017-20261117-2021-unify-sidebar-group-hover-row.md  # 更新记录 · 统一左二菜单栏分组标题悬停底色铺满整行
│   ├── 000018-20261117-2026-enable-pin-projects-in-more-menu.md  # 更新记录 · “更多”菜单中的“项目”支持固定到左一图标栏
│   ├── 000019-20261117-2055-add-project-folder-module.md  # 更新记录 · 新增“添加项目与本地目录工作区”功能
│   ├── 000020-20261117-2115-fix-windows-folder-picker-and-path-binding.md  # 更新记录 · 修复“添加”选文件夹失效问题并支持直接输入路径绑定（如 G:\app）
│   ├── 000021-20261117-2143-project-hover-card-and-edit-dialog.md  # 更新记录 · 新增项目悬停信息卡、快速置顶、项目内新聊天与“编辑项目”功能
│   ├── 000022-20261117-2146-prevent-duplicate-project-names.md  # 更新记录 · 修复允许同名项目的问题，新增项目名唯一性校验
│   ├── 000023-20261117-2153-project-more-action-menu.md  # 更新记录 · 新增项目 ··· 点击操作菜单，并优化悬停与点击交互互斥
│   ├── 000024-20261117-2155-hide-project-list-footer-note.md  # 更新记录 · 有项目时隐藏左二列表底部“本地工作区项目”提示
│   ├── 000025-20261117-2158-hover-card-on-entire-project-row.md  # 更新记录 · 移入整个项目行即显示悬浮信息卡片
│   ├── 000026-20261117-2201-fix-more-button-hover-highlight.md  # 更新记录 · 修复悬停项目行时 ··· 按钮误显示高亮底色的问题
│   ├── 000027-20261117-2204-hide-row-actions-until-hover.md  # 更新记录 · 修复项目行右侧操作按钮常驻显示问题，改为移入项目行才显现
│   ├── 000028-20261117-2228-package-split-sections-and-recent-chats.md  # 更新记录 · 新增自定义分区（新建/重命名/删除/项目归类）并修正「最近」仅用于聊天会话
│   ├── 000029-20261117-2243-remove-project-confirm-dialog.md  # 更新记录 · 移出项目增加二次确认弹窗，防止误操作移除工作区项目
│   ├── 000030-20261117-2256-persistent-ui-memory.md  # 更新记录 · 新增工作台持久化记忆，刷新页面不再重置收起状态与当前页面
│   ├── 000031-20261117-2307-zero-flash-silent-reload.md  # 更新记录 · 实现页面刷新零闪烁秒开与后台静默同步
│   ├── 000032-20261117-2322-rail-theme-quick-switch.md  # 更新记录 · 左一菜单栏底部新增外观模式快捷切换（跟随系统 / 浅色模式 / 深色模式）
│   ├── 000033-20261117-2328-move-theme-switch-to-user-menu.md  # 更新记录 · 将主题快捷切换移至用户菜单头部右上角
│   ├── 000034-20261117-2331-fix-theme-submenu-overlap.md  # 更新记录 · 优化主题切换子菜单展开位置并消除重影透字
│   ├── 000035-20261117-2336-unify-theme-select-dropdowns.md  # 更新记录 · 统一外观设置全部下拉菜单为圆角液态玻璃风格
│   ├── 000036-20261117-2341-align-theme-submenu-flush.md  # 更新记录 · 优化主题切换子菜单顶部对齐与窗口缩放实时跟随
│   ├── 000037-20261117-2344-flush-align-theme-menu-with-panel-top.md  # 更新记录 · 主题切换子菜单顶边与用户菜单上沿完全齐平
│   ├── 000038-20261118-0019-hover-reveal-project-group-tools.md  # 更新记录 · 「项目」分组标题行右侧图标改为鼠标移入后显现
│   ├── 000039-20261118-0026-recent-group-hover-tools.md  # 更新记录 · 「最近」分组新增聊天排序与快捷新聊天入口
│   ├── 000040-20261118-0034-drag-resize-and-snap-collapse-panels.md  # 更新记录 · Updata Log 000040 — 左右菜单栏支持拖拽调宽与半阈值吸附收起
│   ├── 000041-20261118-0042-theme-palette-match-reference.md  # 更新记录 · Updata Log 000041 — 深色与浅色主题色板对齐参考视觉效果
│   ├── 000042-20261118-0108-agent-core-and-chat-platform.md  # 更新记录 · Updata Log 000042 — 上线核心聊天功能与 Agent 四大核心能力引擎
│   ├── 000043-20261118-0113-fluid-drag-and-snap-physics.md  # 更新记录 · Updata Log 000043 — 左右菜单栏拖拽拉伸与磁吸折叠动画顺滑优化
│   ├── 000044-20261118-0817-sidebar-click-jump-fix-and-github-push-menu.md  # 更新记录 · Updata Log 000044 — 修复侧边栏分割条点击误移位与新增一键强推 GitHub 菜单
│   ├── 000045-20261118-0820-builtin-browser-rule-and-git-push-options.md  # 更新记录 · Updata Log 000045 — 拆分一键推送/强制推送菜单并完成内置浏览器回归验收
│   ├── 000046-20261118-0823-git-commit-message-prompt-and-memory.md  # 更新记录 · Updata Log 000046 — 推送菜单支持自定义 commit 信息与上次提交提醒
│   ├── 000047-20261118-0827-github-pull-latest-source-menu.md  # 更新记录 · Updata Log 000047 — 新增菜单项 6：一键从 GitHub 拉取最新源码
│   ├── 000048-20261118-0830-push-safety-guard-and-gitignore.md  # 更新记录 · Updata Log 000048 — 推送前自动拦截大文件、大依赖与敏感信息
│   ├── 000049-20261118-0831-pull-commit-preview-confirm.md  # 更新记录 · Updata Log 000049 — 菜单 6 拉取前展示远程最新 commit 说明与 [Y/n] 确认
│   ├── 000050-20261118-0832-cli-menu-categories-and-colors.md  # 更新记录 · Updata Log 000050 — 优化 lfaa.bat 启动菜单【】分组与配色
│   ├── 000051-20261118-0834-keep-terminal-open-on-menu-exit.md  # 更新记录 · Updata Log 000051 — 菜单选择 0 退出后保留终端窗口
│   ├── 000052-20261118-0843-composer-scope-bar-and-project-picker.md  # 更新记录 · Updata Log 000052 — 聊天输入栏新增工作位置与项目选择挂载条
│   ├── 000053-20261118-0855-three-agent-permission-modes.md  # 更新记录 · Updata Log 000053 — 新增三种 Agent 权限模式（请求批准 / 帮我审批 / 完全访问权限）
│   ├── 000054-20261118-0902-composer-add-context-and-mentions.md  # 更新记录 · Updata Log 000054 — 输入栏新增 + 添加上下文菜单与 @ 提及浮层
│   ├── 000055-20261118-0908-composer-voice-and-cancel-shortcuts.md  # 更新记录 · Updata Log 000055 — 输入栏新增语音输入（Ctrl+M）与运行取消（Ctrl+D）交互
│   ├── 000056-20261118-0919-library-assets-and-storage-migration.md  # 更新记录 · Update Log 000056 — 资料库与资产库上线，支持设置中心存储路径切换与无损迁移
│   ├── 000057-20261118-0927-offline-voice-dictation-fallback.md  # 更新记录 · Update Log 000057 — 修复语音输入 network 不可用问题，支持本地离线语音识别
│   ├── 000058-20261118-0929-composer-placeholder-copy.md  # 更新记录 · Update Log 000058 — 更新聊天输入框占位提示文案
│   ├── 000059-20261118-0935-dynamic-storage-paths-and-migration-fix.md  # 更新记录 · Update Log 000059 — 优化项目/用户存储路径自动检测并修复迁移交互问题
│   ├── 000060-20261118-0943-vault-kebab-naming-upgrade.md  # 更新记录 · Update Log 000060 — 优化 data/ 数据目录规范命名并无损自动升级
│   ├── 000061-20261118-0952-fixed-local-sessions-dir.md  # 更新记录 · Update Log 000061 — 历史会话固定存放在本机 ~/.lfaa/sessions，不再跟随项目迁移
│   ├── 000062-20261118-1006-general-settings-and-linkage.md  # 更新记录 · Update Log 000062 — 设置中心「常规」页面正式上线，支持权限、项目外目录与编辑器全项配置
│   ├── 000063-20261118-1018-clarify-project-outside-vs-default-project-dirs.md  # 更新记录 · Update Log 000063 — 清晰区分「项目外聊天（~/.lfaa）」与「默认新建项目目录（文档/lfaa）」
│   ├── 000064-20261118-1026-custom-general-dropdowns.md  # 更新记录 · Update Log 000064 — 优化「常规」设置全部下拉选择器外观与交互体验
│   ├── 000065-20261118-1037-library-ui-and-domain-sidebars.md  # 更新记录 · Update Log 000065 — 重构资料库中心界面并升级各页面专属左二功能菜单
│   ├── 000066-20261118-1057-builtin-git-and-code-review.md  # 更新记录 · Update Log 000066 — 新增 LFAA 内置 Git、编码设置（Git 与代码审查）及代码审查工作台
│   ├── 000067-20261118-1113-ui-primitives-and-model-pickers.md  # 更新记录 · Update Log 000067 — 新增共享交互原语包、输入栏模型/推理强度浮窗及卡片式模型配置居中弹窗
│   ├── 000068-20261118-1118-fix-code-review-horizontal-overflow.md  # 更新记录 · Update Log 000068 — 修复代码审查工作台横向滚动条与长文件路径截断显示问题
│   ├── 000069-20261118-1121-fix-agent-settings-grid-stretch.md  # 更新记录 · Update Log 000069 — 修复「模型、规则与记忆配置」页垂直拉伸与冗余边框布局问题
│   ├── 000070-20261118-1127-status-banner-and-deepseek-e2e.md  # 更新记录 · Update Log 000070 — 升级全站语义化提示通知样式并完成 DeepSeek 真实 API 联调验证
│   ├── 000071-20261118-1146-official-models-effort-and-brand-slots.md  # 更新记录 · Update Log 000071 — 支持官方真实模型与思考强度同步、单品牌模型列表及浮窗原地模型管理卡槽
│   ├── 000072-20261118-1150-relocate-composer-model-picker.md  # 更新记录 · Update Log 000072 — 精简输入栏底栏布局并右移模型选择器至语音/发送区旁
│   ├── 000073-20261118-1226-deepseek-docs-error-guide-and-modal-polish.md  # 更新记录 · 000073 更新日志 — DeepSeek 官方文档对齐、错误码诊断提示与模型弹窗精简
│   ├── 000074-20261118-1229-slider-header-hitbox-and-modal-polish.md  # 更新记录 · 000074 更新日志 — 推理强度顶部整块触发切换与模型列表去重精简
│   ├── 000075-20261118-1234-deepseek-release-version-tags.md  # 更新记录 · 000075 更新日志 — 模型标签完整同步 DeepSeek-V4.1-Flash-1017 与 DeepSeek-V4-Pro-0813
│   ├── 000076-20261118-1243-api-protocols-inline-status.md  # 更新记录 · 000076 更新日志 — 四大 API 协议格式与弹窗原地状态
│   ├── 000077-20261118-1317-protocol-filter-and-composer-sync.md  # 更新记录 · 000077 更新日志 — 按品牌精简协议选项与输入栏设置实时同步
│   ├── 000078-20261118-1320-fix-composer-popover-header-wrap.md  # 更新记录 · 000078 更新日志 — 修复输入栏模型浮窗顶部排版错位
│   ├── 000079-20261118-1327-sync-official-inline-feedback.md  # 更新记录 · 000079 更新日志 — 输入栏「同步官方」按钮原地状态反馈
│   ├── 000080-20261118-1337-chat-session-hover-card-and-action-menu.md  # 更新记录 · 000080 更新日志 — 聊天会话悬停信息卡、快捷操作与「⋮」完整菜单
│   ├── 000081-20261118-1340-double-click-rename-session.md  # 更新记录 · 000081 更新日志 — 支持双击聊天行快速重命名
│   ├── 000082-20261118-1349-composer-hover-tips-and-delete-confirm.md  # 更新记录 · 000082 更新日志 — 输入栏全控件居中悬停提示与删除对话二次确认
│   ├── 000083-20261118-1431-resilient-streaming-architecture.md  # 更新记录 · 000083 更新日志 — 高可用流式输出（断线续传、幂等去重、节流渲染与句边界续写）
│   ├── 000084-20261118-1435-unified-model-picker-pill.md  # 更新记录 · 000084-20261118-1435-unified-model-picker-pill
│   ├── 000085-20261118-1440-unified-confirm-dialog.md  # 更新记录 · 000085-20261118-1440-unified-confirm-dialog
│   ├── 000086-20261118-1446-project-chat-sidebar-grouping.md  # 更新记录 · 000086-20261118-1446-project-chat-sidebar-grouping
│   ├── 000087-20261118-1448-hide-scope-bar-in-active-chat.md  # 更新记录 · 000087-20261118-1448-hide-scope-bar-in-active-chat
│   ├── 000088-20261118-1451-gradient-particle-slider.md  # 更新记录 · 000088-20261118-1451-gradient-particle-slider
│   ├── 000089-20261118-1454-slider-particle-speed-and-bolt-shortcut.md  # 更新记录 · 000089-20261118-1454-slider-particle-speed-and-bolt-shortcut
│   ├── 000090-20261118-1459-markdown-table-code-highlight.md  # 更新记录 · 000090-20261118-1459-markdown-table-code-highlight
│   ├── 000091-20261118-1501-project-row-toggle-expand.md  # 更新记录 · 000091-20261118-1501-project-row-toggle-expand
│   ├── 000092-20261118-1504-session-hover-card-dismiss.md  # 更新记录 · 000092-20261118-1504-session-hover-card-dismiss
│   ├── 000093-20261118-1508-meteor-dot-trails-and-bolt-toggle.md  # 更新记录 · 000093-20261118-1508-meteor-dot-trails-and-bolt-toggle
│   ├── 000094-20261118-1514-chat-message-polish-and-actions.md  # 更新记录 · 000094-20261118-1514-chat-message-polish-and-actions
│   ├── 000095-20261118-1526-topbar-session-title-and-auto-summary.md  # 更新记录 · 000095-20261118-1526-topbar-session-title-and-auto-summary
│   ├── 000096-20261118-1531-mode-switcher-lfaa-branding.md  # 更新记录 · 000096-20261118-1531-mode-switcher-lfaa-branding
│   ├── 000097-20261118-1534-remove-native-sidebar-title-tooltip.md  # 更新记录 · 000097-20261118-1534-remove-native-sidebar-title-tooltip
│   ├── 000098-20261118-1539-draggable-slider-detent-and-dynamic-meteors.md  # 更新记录 · 000098-20261118-1539-draggable-slider-detent-and-dynamic-meteors
│   ├── 000099-20261118-1541-message-weekday-timestamp.md  # 更新记录 · 000099-20261118-1541-message-weekday-timestamp
│   ├── 000100-20261118-1547-follow-up-suggestions.md  # 更新记录 · 000100-20261118-1547-follow-up-suggestions
│   ├── 000101-20261118-1554-mention-cursor-and-slash-commands.md  # 更新记录 · 000101-20261118-1554-mention-cursor-and-slash-commands
│   ├── 000102-20261118-1558-scroll-to-bottom-dock-positioning.md  # 更新记录 · 000102-20261118-1558-scroll-to-bottom-dock-positioning
│   ├── 000103-20261118-1604-lightning-only-fixed-meteors.md  # 更新记录 · 000103-20261118-1604-lightning-only-fixed-meteors
│   ├── 000104-20261118-1609-hover-card-cross-row-and-unread-halo.md  # 更新记录 · 000104-20261118-1609-hover-card-cross-row-and-unread-halo
│   ├── 000105-20261118-1615-streaming-phase-status-and-summary.md  # 更新记录 · 000105-20261118-1615-streaming-phase-status-and-summary
│   ├── 000106-20261118-1621-slash-tab-completion-and-execution.md  # 更新记录 · 000106-20261118-1621-slash-tab-completion-and-execution
│   ├── 000107-20261118-1625-chat-turn-anchor-bar.md  # 更新记录 · 000107-20261118-1625-chat-turn-anchor-bar
│   ├── 000108-20261118-1634-background-unread-accent-dot.md  # 更新记录 · 000108-20261118-1634-background-unread-accent-dot
│   ├── 000109-20261118-1638-thinking-duration-hms.md  # 更新记录 · 000109-20261118-1638-thinking-duration-hms
│   ├── 000110-20261118-1643-file-listing-typography.md  # 更新记录 · 000110-20261118-1643-file-listing-typography
│   ├── 000111-20261118-1702-project-git-init-and-edited-files-linkage.md  # 更新记录 · 000111-20261118-1702-project-git-init-and-edited-files-linkage
│   ├── 000112-20261118-1710-light-theme-css-variables-and-standards.md  # 更新记录 · 000112-20261118-1710-light-theme-css-variables-and-standards
│   ├── 000113-20261118-1839-dependency-lockfile-line-endings.md  # 更新记录 · 000113-20261118-1839-dependency-lockfile-line-endings
│   ├── 000114-20261118-1923-anchor-preview-click.md  # 更新记录 · 聊天锚点预览卡可以点击跳转
│   ├── 000115-20261118-1929-chat-responsive-layout.md  # 更新记录 · 聊天分屏与窄屏布局修复
│   ├── 000117-20261118-2032-compact-icon-rail.md  # 更新记录 · 一级图标导航更紧凑
│   ├── 000118-20261118-2037-mobile-primary-nav.md  # 更新记录 · 手机底栏只保留三个入口
│   ├── 000119-20261118-2107-ark-access-choice.md  # 更新记录 · 火山方舟支持选择 API 或套餐接入
│   ├── 000120-20261118-2112-ark-config-navigation.md  # 更新记录 · 方舟配置新增返回和重配入口
│   ├── 000121-20261118-2133-ark-model-catalog.md  # 更新记录 · UPDATA-000121｜方舟套餐模型和思考强度
│   ├── 000122-20261118-2144-provider-access.md  # 更新记录 · UPDATA-000122｜套餐提供商支持返回与重新配置
│   ├── 000125-20261118-2223-compact-composer.md  # 更新记录 · UPDATA-000125｜窄屏聊天输入工具栏
│   ├── 000126-20261118-2235-workbench-resize.md  # 更新记录 · UPDATA-000126｜右侧上下文支持更宽的拖拽范围
│   ├── 000127-20261118-2258-sidebar-drag.md  # 更新记录 · UPDATA-000127｜修复侧栏拖拽抖动和文字裁切
│   ├── 000128-20261118-2307-sidebar-range.md  # 更新记录 · UPDATA-000128｜左二菜单栏可拉宽到 25%
│   └── 000129-20261118-2311-plugins-entry.md  # 更新记录 · UPDATA-000129｜插件图标直接打开插件页
└── PROMPTS.md  # 提交开发任务时可参考的目标、范围和验收提问模板
```

## 8. 维护这份说明

目录或包结构变动时，按实际变更更新相应目录树和职责说明。盘点可使用 `git ls-files --cached --others --exclude-standard` 枚举 Git 可见路径，再以当前工作区中存在的文件校验。更新说明中的日期和数量随盘点刷新。开发过程与验证结果记录到开发日志卷。
