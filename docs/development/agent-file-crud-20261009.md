# LFAA Agent 通用文件 CRUD 合同

## 目标、入口与 Owner

让模型驱动的 Agent 在所有已登记 App 中，能通过自然语言目标选择真实文件工具，查询/读取、新建、整篇更新、局部修复和删除普通项目文件，并根据 Daemon 返回的执行证据继续判断。文件 CRUD 是通用 Agent 能力，不按具体 App 写关键词流程。

- 运行入口：`packages/core/agent-loop`，模型可见工具由 `packages/fs/tool-fs`、`packages/fs/tool-fs-search`、`packages/fs/tool-str-replace-editor` 注册。
- 模型参数翻译与权限接入由 `packages/core/tools/src/project-tools.ts` 维护；共享受限文件执行器位于 `packages/host/project-files`。Agent 会话绑定独立本机 Git 仓库时，由 LFAA 本机 Host 执行；模型明确选择节点目标时，Daemon 作为可选执行适配器调用同一实现。
- 本机 Agent 仓库、可选 `WorkspaceProject` 与 Daemon 节点目标是分开的上下文。复用 `permissions.mode`、Permission Owner、`general.taskFolder` 和现有数据/路径边界，不新增设置项、工具外审批规则或 App 专属授权。
- 所有 `APPLICATION_IDS` 均可发现通用文件工具；执行时目标项目/节点及其真实文件系统状态仍由现有 Owner 校验。

## 范围与边界

- 保留 `lfaa_list_directory`、`lfaa_search_files`、`lfaa_grep_search`、`lfaa_read_file`、`lfaa_read_image`、`lfaa_write_file` 与 `lfaa_str_replace`；新增模型可见的 `lfaa_delete_file`，实现创建、查询/读取、更新/修复和删除闭环。
- 整篇新建不得覆盖已有文件；修改已有文本须携带最新读取的 SHA-256；局部替换要求唯一锚点，重复锚点由模型读取更多上下文后修复。
- 删除仅接受目标根目录内的普通文件，符号链接、目录、LFAA_DATA_DIR 及越界路径继续由执行 Owner 拒绝；不递归删除目录。删除风险交给现有三种 `permissions.mode` 处理，不新增第二个确认流程。
- 保持文本读写 2 MiB、搜索有界结果和单次 Agent Run 的真实工具结果回传。只调整文件工具模型说明以准确描述目标 Daemon；不改模型选择、权限存储、界面、主题或无关业务。

## 验收

- 在完整隔离 Web Profile Harness 回归中真实登记并调用新增删除工具，穿过 Agent Loop、统一权限路由、AI Host Daemon 队列和真实 `executeProjectFile`，核验工具结果回到下一次 Provider 请求且文件确实消失。
- 回归验证跨 App 工具可发现、创建/读取/修改/搜索/删除、缺失文件/目录/符号链接/根目录外路径拒绝；保留现有超限与项目文件回归。
- 运行相关 Agent/Daemon/FS 回归、类型检查、受影响包/当前运行入口构建、`check:workspace` 与差异检查；所有产物只进入仓库根 `dist/`。
- 本次无界面交互、订阅或轮询变化；记录文件工具调用的静态工作量边界。静态、夹具与构建通过不代表真实 Provider、用户节点、浏览器/桌面交互已验。

## 实施记录

- 新增 `lfaa_delete_file` 并由已有跨 App 文件工具注册流程登记；危险风险进入现有 `permissions.mode`。Daemon 只 unlink 单个普通文件，路径仍经原项目根目录与数据根目录核验。
- 验证：CLI 定向回归 5/5（含完整隔离 Web Profile Harness、跨 App 工具登记、Provider 工具选择→Daemon 文件任务→删除回执→助手最终答复）；客户端与 Host TypeScript 检查通过；根 `pnpm run build`、`pnpm check:workspace` 通过。
- 未实测：真实 Provider、真实用户节点文件操作和浏览器/桌面交互。
