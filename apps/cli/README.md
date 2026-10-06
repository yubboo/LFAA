# LFAA CLI

源码入口为根目录 `pnpm lfaa web`，使用 `dist/apps/control-plane` 和 `dist/apps/web`；正式 Web 默认端口 3000，读取 `SERVER_PORT`。Windows Web 默认由现有监督器托管一个本机 Daemon；`--no-local-daemon` 关闭此托管。独立节点使用 `pnpm lfaa daemon`。所有模式装配当前能力包，不读取旧 `dist/server`、`dist/frontend` 或 `dist/daemon`。

`lfaa.bat` → `scripts/project-menu.mjs` → `scripts/install-dependencies.ps1` 在当前终端运行菜单。菜单 2 启动前使用 `scripts/runtime-build-state.mjs` 对账源码和输出，只构建过期的 Web/控制端职责；构建期间源码变化会拒绝完成记录。直接调用 `pnpm lfaa` 前由开发者执行 `pnpm run build`。开发模式额外使用 Vite 5173，它不是正式 Web 入口。

菜单 5 使用 `scripts/backup-project.ps1`，名称来自 `docs/updata-log.md`，仅输出根 `dist/backups`。备份排除 Git 历史/工作树指针、依赖、整个 dist、实际配置的数据目录、数据库、秘密和日志；保留 `.env.example`、源码静态资源和上游占位。并发备份互斥，显示复制/压缩/验证进度，失败撤销本轮暂存，不覆盖正式 ZIP。源码 ZIP 不含用户运行数据，不能当作运行数据恢复副本。

数据路径由 `packages/util/home-paths` 和启动配置统一解析，权限、用户会话和节点凭据继续由领域 Owner 校验。日志级别读取 `LOG_LEVEL`；成功的节点领取/心跳为 debug，失败保持可见。

长期回归在 `tests/`，通过根 `pnpm test` 执行。全仓维护记录见 [审计](../../docs/workspace-audit.md)，性能合同见 [性能维护](../../docs/performance.md)。
