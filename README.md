# LFAA

面向独立新项目的 TypeScript + React + Cordis 插件式 Monorepo。当前 Web 提供截图约定的三栏工作区、侧栏导航与搜索、活动入口、ChatGPT/Codex 模式菜单、可固定的应用入口、本地项目列表，以及浅色/深色/系统外观设置和左下角用户菜单。

## 工程约定

- AI 协作入口：[`AGENTS.md`](AGENTS.md)
- 完整规范：[`docs/standards/AI-Agent-Development-Standards.md`](docs/standards/AI-Agent-Development-Standards.md)
- 架构基线与待确认决策：[`docs/architecture/overview.md`](docs/architecture/overview.md)
- [仓库目录说明书](docs/architecture/repository-map.md) · 按路径查找文件和目录的用途
- 包路径：`packages/<group>/<package>`；pnpm workspace 已包含 `apps/*` 与 `packages/*/*`
- Windows 启动菜单：根目录 `lfaa.bat`；启动逻辑和依赖检查位于 `scripts/`
- UI 与领域包同属一个 package，Host 放在 `src/`，需要 UI 时再增加 `client/`
- 开发与更新日志模板位于 `docs/templates/`

## 当前状态

当前图像、定时任务、资料库、插件、站点、地图、GPT、代码审查和外部服务尚未接入；侧栏会显示清楚的未接入状态。项目数据仅保存在当前浏览器。后续功能应以真实 workspace 纵切片接入，验证 Cordis 生命周期、Host/Client 隔离及构建流程后再扩展包结构。

Windows 用户可双击 `lfaa.bat`，选择 `2` 启动 Web；也可运行 `pnpm lfaa web`。开发服务器只监听本机地址，端口由 Vite 选择。
