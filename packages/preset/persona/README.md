# LFAA 人格核心（小鱼核心）

本包是「小鱼」这份人格正文的唯一 Owner：身份、五个真实领域地图（我的世界 / Steam 游戏服务端 / AI 写作 / 联机工具 / 画布）和领域工作约定。当前正文版本 `XIAOYU_CORE_VERSION = 1.2.0`（2026-10-25 增加画布领域）。

## 职责边界

- 只向 `lfaa-system-prompt` 登记两段正文（身份与领域地图、领域工作约定），由该系统提示词 Owner 按稳定顺序组合；本包不拼接、不缓存、不代表执行器。
- 不注册工具、不新增权限、设置或数据；真实动作仍由各领域 Owner（`games/minecraft`、`games/steamcmd`、`document/writing`、`network/game-connectivity`、`canvas/tool-canvas`）与 Permission Owner 执行。
- 领域清单只描述当前真实接通的能力。联机工具当前没有 Agent 工具，正文必须如实说明；接入后同步 `XIAOYU_CORE_VERSION` 与正文。
- 画布条目只登记 `canvas/tool-canvas` 真实注册的工具名（`canvas_list_projects`、`canvas_read_project`、`canvas_create_project`、`canvas_add_node`、`canvas_update_node`、`canvas_remove_node`、`canvas_connect_nodes`、`canvas_disconnect_nodes`、`canvas_list_assets`、`canvas_generate_image`）与真实边界：所有 App 共用画布，项目按账户 + App 隔离，生成能力以 `lfaaCanvasGeneration` 真实返回为准；未接通能力不在正文中宣称可用。
- 名称通过插件配置 `displayName`/`alias` 调整，默认「小鱼」/「大肥鱼」；不改变账户、会话、项目或节点归属。

## 运行位置与装配

Control Plane 的 Cordis 插件，由 `packages/bundle/base/cordis.patch.yml` 的 `persona` 行装配（`required: true`）。

## 设置与数据

不读取也不写入用户设置；不持有数据。当前名称只能由 Profile 配置调整，账户级个性化尚未接入（见 `docs/开发计划.md`）。

## 验收

直接回归 `apps/cli/tests/xiaoyu-persona-core.test.mjs`：组合顺序、默认/自定义名称、卸载回退、重复登记拒绝、正文体积上界，以及画布领域与真实工具名断言。构建输出为根 `dist/packages/preset/persona/`。
