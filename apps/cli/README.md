# LFAA CLI

仓库源码 CLI 从根目录 `pnpm lfaa <组合>` 进入 `apps/cli/src/bin.ts`，由 `node --import tsx/esm` 运行，并加载 LFAA 包解析器；它转交给与 npm CLI 共用的运行器 `apps/cli/bin/lfaa.mjs`。Web 使用 `dist/apps/control-plane` 和 `dist/apps/web`；正式 Web 默认端口 3000，读取 `SERVER_PORT`。插件装配前会先探测所配置的 Web 端口；端口被占用时立即给出端口及 `.env` 调整提示，不启动半成品服务。Windows Web 默认由现有监督器托管一个本机 Daemon；`--no-local-daemon` 关闭此托管。独立节点使用 `pnpm lfaa daemon`。所有模式装配当前能力包，不读取旧 `dist/server`、`dist/frontend` 或 `dist/daemon`。

`lfaa.bat` → `scripts/project-menu.mjs` → `scripts/install-dependencies.ps1` 始终按脚本自身位置定位当前源码根，可从任意工作目录和盘符运行，不依赖历史安装路径。菜单 2 启动前使用 `scripts/runtime-build-state.mjs` 对账源码指纹及关键产物（控制端入口、工作区清单、App Boot 入口和 Web 静态资源）；任一缺失或过期即重建对应职责。构建期间源码变化会拒绝完成记录。菜单和仓库源码 CLI 启动完整 Web 时都会检查当前 `LFAA_DATA_DIR` 的写锁；只有确认由 LFAA Web CLI 持有时才结束该进程并继续启动，无法确认的占用会停止启动。直接调用 `pnpm lfaa` 前由开发者执行 `pnpm run build`，入口缺失时错误会给出当前解析到的路径和具体构建命令。Web 验收默认由当前源码工作区启动到 `http://127.0.0.1:3000`，并在 ChatGPT 内置浏览器打开实际页面。开发模式额外使用 Vite 5173，它不是正式 Web 入口。

启动子菜单中，1 或回车启动完整 Web；2 仅启动独立 Daemon，要求配置绝对路径 `LFAA_DATA_DIR`；4 只启动 Vite 前端并等待已运行的控制端，不能代替 Web 启动。

菜单 5 使用 `scripts/backup-project.ps1`，名称来自 `docs/updata-log.md`，仅输出根 `dist/backups`。备份排除 Git 历史/工作树指针、依赖、整个 dist、实际配置的数据目录、数据库、秘密和日志；保留 `.env.example`、源码静态资源和上游占位。并发备份互斥，显示复制/压缩/验证进度，失败撤销本轮暂存，不覆盖正式 ZIP。源码 ZIP 不含用户运行数据，不能当作运行数据恢复副本。

菜单 6 只向已核验的项目 GitHub `origin/main` 做普通快进推送；不会强制覆盖远端历史，也不会改写现有 origin/push URL。每次推送前安全读取 GitHub `main` 最近 50 条提交，从最近的版本提交显示上次源码推送版本；提交说明必须以更高的三段版本号开头，可附简短说明。更新日志中的产品版本单独显示，不与源码推送版本混用；成功推送后把版本缓存到仓库本地 Git 配置，远端历史仍是优先来源。提交前列出文件并扫描密钥、运行数据、数据库、构建产物和大文件；固定路径规则之外，还会调用 `resolve-data-directory.mjs` 排除当前 `.env`/环境变量实际选中的自定义数据根。用户数据、`.env`、数据库、凭据、备份 ZIP 不应推送，GitHub 仓库只接收可重建的源码、静态资源、配置模板、锁文件、文档和长期测试。首次推送前还会扫描本地 Git 历史，历史中含敏感路径/密钥或超大文件时阻止推送。

菜单 8 使用 `scripts/update-project.ps1`：按菜单脚本自身位置定位仓库，仅 fetch `origin/main`，工作区有未提交变化、分支分叉、远端改动触及当前数据根或远端历史回退时停止；否则展示待更新内容并只执行 `merge --ff-only`。它不运行 `reset`、`clean`、强制推送或数据迁移；选项 7 当前未定义。更新后仍需按项目要求安装依赖、重建/启动和验收；源码更新不会自动替换或清理本机运行数据。

数据路径由 `packages/util/home-paths` 和启动配置统一解析。菜单 4 显示当前 `LFAA_HOME`、插件安装目录和唯一有效 `LFAA_DATA_DIR`，并标出未选用的默认目录；例如当前 `.env` 选择仓库 `data` 时，`%USERPROFILE%\.lfaa\data` 不会再生成一份空数据。Profile 覆盖位于 `<LFAA_HOME>/profiles/<Profile>/cordis.patch.yml`，插件安装源码位于 `<LFAA_HOME>/plugins/profiles/<Profile>`，运行数据分类位于所选 `LFAA_DATA_DIR`；两类根互不合并。权限、用户会话和节点凭据继续由领域 Owner 校验。日志级别读取 `LOG_LEVEL`；成功的节点领取/心跳为 debug，失败保持可见。

长期回归在 `tests/`，通过根 `pnpm test` 执行。全仓维护记录见 [审计](../../docs/archive/audits/workspace-audit.md)，性能合同见 [性能维护](../../docs/development/performance.zh.md)。
