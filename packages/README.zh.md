# 包目录索引

所有可复用能力按 `packages/<group>/<package>` 组织。第二层目录是实际 pnpm package，包组目录不单独作为 package。
**一个大功能就是一个包**；包内再按职责分小文件夹（`src/run/`、`client/conversation/` 等），不把整块功能塞进单个文件，也不为两三个文件单独建包。

```text
packages/
├── api/            # 接口边界：gateway 统一登记 HTTP 路由与本机鉴权
├── bundle/         # 装配组合：web 按序挂载 Host 能力与 Loader
├── host/           # 宿主服务：web-server 运行时、静态托管与 Vite 托管
├── core/           # Agent 内核：agent、llm、tools、context、memory、session、rules、guard、fs、storage、settings、metrics、jobs、subagent、browser、system-prompt、tool-todo
├── chat/           # 聊天工作台领域
│   ├── chat/       # (@lfaa/chat) 对话、输入栏、会话、右栏工作台、模型与常规/通知设置；对外提供 chatStore 客户端服务
│   ├── library/    # (@lfaa/library) 资料库页面、右栏检视器与存储位置设置页
│   └── review/     # (@lfaa/review) 代码审查工作台、Git/审查设置页 + Git/审查 Host 服务
├── ui/             # 通用界面：layout（四栏 Shell）、primitives（弹窗/浮层/滑块/设置中心控件与外观）、theme（主题令牌）、icons（文件图标）
├── workspace/      # 工作区领域：workspace（项目 CRUD）、sections（自定义分区）、worktree（工作树隔离）
├── extension/      # 扩展生态：plugins（插件生命周期）、skills（技能目录）
├── shell/          # 命令执行：shell 服务 + Bash/PowerShell/CMD 方言解析 + 输出解码
├── sandbox/        # 安全边界：sandbox 契约 + 逐次策略 + 工具层后端
├── web/            # 联网能力：web（抓取 seam + HTTP 实现 + fetch_url 工具）
├── media/          # 媒体生成：tool-media（生图工具 + 浏览器端媒体 UI：素材库、生成卡片、比例/风格选择器）
├── goal/ plan/ schedule/ interaction/ feedback/ attachment/ session/ media/ fs/ guard/ spill/ compaction/  # 目标、计划模式、定时任务、斜杠命令、消息反馈、附件、会话标题、媒体生成、写前必读、超时策略、长结果落盘、上下文治理（各为单包）
│                   # 各自单一能力的小分组（目标、计划模式、定时任务、斜杠命令、消息反馈、附件、会话标题、媒体生成、写前必读、超时策略、长结果落盘、上下文压缩）
└── util/           # 至少有两个真实消费者时才提取的纯工具
```

包的内部约定：

- `src/`：Host 侧入口（默认导出 Cordis 插件）与领域实现；`client/`：浏览器入口与 React 界面；`tests/`：包级回归测试；`contract/`：无 Node/DOM 依赖的公开契约（需要时才有）。
- 客户端插件在 `client/index.tsx` 导出 `xxxClientPlugin`，由 `apps/web` 或装配包挂载；跨包协作只走 Cordis 服务或公开 contract。
- 每个包具备双语文档三件套（`README.md` / `README.zh.md` / `README.i18n.yaml`）与独立 `package.json`、`tsconfig.json`（由 `pnpm sync` 生成）。