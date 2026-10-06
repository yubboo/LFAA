# LFAA Harness CLI 启动与打包

## 命令与产物

运行环境：Node.js >= 24.15.0，源码工作区使用 pnpm 11.17.0。

```sh
git clone https://github.com/yubboo/LFAA.git lfaa
cd lfaa
pnpm install
pnpm run build
pnpm lfaa web
```

`apps/cli/bin/lfaa.mjs` 读取编译后的 Cordis 装配和前端资源；构建缺失时明确失败。Web 默认同源提供页面、API 和 Socket.IO，地址 `http://127.0.0.1:3000`，实际监听读取环境配置。`Ctrl+C` 通过插件生命周期关闭服务、数据库和文件写锁。Windows x64 本机模式且没有配置远程节点连接时，控制端托管本机 Daemon；通过 `--no-local-daemon` 可显式关闭该行为。

工作区构建把能力包写入 `dist/packages/<领域>/<包名>/`，把 Web、控制端和 Daemon 入口分别写入 `dist/apps/web/`、`dist/apps/control-plane/`、`dist/apps/daemon/`；桌面产物位于各自 `dist/apps/desktop-*` 子目录，临时组装位于 `dist/.tmp/<入口>/`。可单独构建 Web 与控制端：`pnpm run build:web`、`pnpm run build:control-plane`。

## Windows 工作台

双击根目录 `lfaa.bat`，菜单及服务使用当前终端；Node 启动的 PowerShell 辅助进程继承输入输出并禁止额外控制台窗口。缺少 Node 时仍可打开 PowerShell 菜单检查环境，但安装、构建和运行必须先满足根清单的 Node 版本要求。

| 编号 | 实际操作 |
|---|---|
| 1 | `pnpm install`，安装已声明的工作区包 |
| 2 | 子菜单 1/Enter：`pnpm lfaa web`；2：`pnpm lfaa daemon`；3：完整开发启动器；4：`pnpm --filter lfaa-web run dev`；0：返回 |
| 3 | `pnpm run build`，输出到根 `dist/`，普通 Web 不构建节点原生 Host |
| 4 | 检查 Node/pnpm、可选 Rust 工具链，并列出实际包清单；占位目录不算安装包 |
| 5 | 生成 `dist/backups/LFAA 版本号.zip` 源码备份，排除运行数据及凭据 |
| 6 | 经版本确认、暂存检查和凭据检查后正常提交并推送 GitHub main |
| 7 | 先输入 `FORCE main` 确认覆盖，再执行版本和安全检查后强制推送；取消不改 Git |
| 0 | 退出工作台 |

首次本地 Web 使用顺序为 1 → 3 → 2 → Enter。Web 使用编译后的控制端与前端；Windows x64 本机模式按上文规则托管本机 Daemon。需要源码热更新时，在启动子菜单选择 4：等待当前控制端 `/api/health` 就绪后运行 `pnpm --filter lfaa-web run dev`，Vite 固定监听 `127.0.0.1:5173`，将 API 与 Socket.IO 代理到现有控制端，并读取 DSH 页面注入。此入口只启动前端，不重启控制端或 Daemon；用 `http://127.0.0.1:5173` 打开页面，按 `Ctrl+C` 停止 Vite。若 5173 已由本工作区 Vite 占用，菜单核对进程身份和 AI Work 页面响应后复用现有实例；其他占用会报告进程名和 PID 并停止，不会杀进程或静默换端口。节点原生 Host 先通过 `pnpm run build:daemon` 单独构建。

Web 启动前检查当前数据目录的配置写锁：若锁 PID 仍对应 LFAA Web CLI，只结束该 PID 后按原命令启动；锁已陈旧时交由存储模块安全回收。进程身份无法确认或停止失败时中止启动；不会删除锁文件或结束整棵进程树。

已有数据目录迁移计划时，菜单禁止正式 CLI 继续写旧目录；先停止服务，再选择开发模式或运行 `pnpm dev` 完成迁移。开发模式保留热更新、当前项目进程识别和设置中心的数据目录迁移能力；正式本机 CLI 的数据位置来自既有环境配置。

2026-09-30 菜单修复实际检查：从 `C:/Windows` 调用批处理并选择 0 正常退出；选项 4、启动取消、无效模式、普通推送版本取消与强推取消正常返回；选项 3 完整构建通过，输出位于根 `dist/`；脚本语法检查通过。未通过可见桌面双击复验窗口数量，未重新执行真实节点任务或 GitHub 推送。

随后启动验收发现：生产包解析器只从 CLI 解析外部依赖，无法找到 Tools 包已声明的 `ajv`，导致 Agent Loop 与会话 API 未就绪。现已改为按所属能力包解析外部依赖；发布清单汇总全部运行包的外部依赖，版本冲突明确失败。插件导入失败会报告插件 ID 和真实错误，并释放已装配资源。

启动子菜单统一使用数字：1 Web、2 Daemon、3 开发模式、0 返回，回车默认 Web。通过真实终端运行 `lfaa.bat` → 2 → 1，得到 `LFAA Web 已就绪：http://127.0.0.1:3000`；页面和健康接口返回 200，未登录会话接口返回 401；Ctrl+C 后端口 3000 无监听。长期测试增加生产 CLI 启停与重启、导入失败清理和发布依赖覆盖三项；纳入并行 Agent 工作新增的完整 Web 测试后，最新完整测试共 37 项通过。测试通过专用 IPC 辅助文件触发真实 SIGINT 生命周期，该文件仅属于测试、不进入产品或发布包；本次回归测试的隔离目录清理完成。

## 本地打包

用户已选择暂不发布 npm。本地产物为 `H:/LFAA/dist/npm/yubboo-lfaa-0.1.1.tgz`；在线 `npx @yubboo/lfaa web` 需要将来另行发布。当前通过独立目录安装此 tarball，再执行本地 `npx --offline lfaa web` 验证发布内容。

```sh
pnpm run pack:cli
# 将来获得发布授权并完成 npm 登录后：
pnpm run publish:cli
```

发布名从 `apps/cli/package.json` 读取，固定为 `@yubboo/lfaa`。源码清单是私有工作区包；生成的 `dist/npm/lfaa/package.json` 才是公共发布清单，去除 `workspace:*` 依赖。包只携带编译后的产品运行树、前端资源、CLI 和长期路径工具；不携带测试支持、真实数据、凭据、备份和原生 Windows Sandbox Host。

## 配置与数据

| 项目 | 来源及行为 |
|---|---|
| 地址、端口 | `SERVER_HOST`、`SERVER_PORT`；沿用现有服务端校验 |
| 数据根目录 | `LFAA_DATA_DIR`；源码沿用既有磁盘/用户目录解析；npm 默认 `~/.lfaa/data`，显式相对路径按调用目录解析 |
| 环境文件 | 源码读仓库 `.env`；npm 读调用目录 `.env`；显式环境变量优先 |
| 本机启动 | CLI 为本机 Web 提供 `LFAA_LOCAL_MODE` 默认值；仅回环监听允许自动持久化 JWT 密钥 |
| 公网生产 | 仍要求强 `JWT_SECRET` 与绝对持久数据目录；本机开关不豁免外部监听 |
| 通行密钥 | 沿用 `WEBAUTHN_RP_ID` 与 `WEBAUTHN_ORIGIN` 配置，不伪造可用状态 |
| 用户设置 | 全部现有设置读取混合存储，不重置默认值或用户偏好，详见存储文档 |

`LFAA_LOCAL_MODE` 是启动部署配置，未新增设置中心控件。首次访问沿用真实超级管理员初始化流程，不生成测试账户。

## Daemon

节点通过独立 Cordis Context 装配 `lfaa-host-daemon/daemon`，领取控制端任务并回报真实结果。Provider 推理由控制端 Agent Runtime 负责；节点不另起一套模型决策层。

```sh
pnpm run build:daemon
pnpm lfaa daemon
```

当前 Windows x64 节点需要 Rust/MSVC Sandbox Host；普通 Web 构建不要求 Rust。远程节点使用各自主机上的数据根目录；控制端和本机节点才共享同一数据根目录。文件管理保护 `credentials/`、`database/`、`storages/`、`sessions/`；完全权限 Shell 仍按现有账户权限合同执行。

## 验证与范围

存储与 CLI 首次交付时 30 项长期测试通过，原始构建与启动记录见[交付记录](harness-delivery.md)；本次启动修复后的最新 37 项测试与菜单启动验收见上文。未发布 npm，未重新构建桌面安装包，也未执行真实模型请求、Minecraft 开服或系统沙盒验收。

所有构建与组装输出仅位于根 `dist/`。每个包只清理自己的输出；正式备份、真实运行数据和长期测试保留。
