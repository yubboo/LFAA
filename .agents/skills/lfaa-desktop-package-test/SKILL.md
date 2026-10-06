---
name: lfaa-desktop-package-test
description: 按 LFAA-Harness Windows/macOS Electron 产品目标核对桌面构建入口、纯净发行内容和隔离安装。仓库当前默认仍指向 Tauri，Electron 仅配置 Windows x64，必须报告迁移差距。
---

# LFAA 桌面安装包与测试流程

本技能提供 LFAA 当前桌面安装包的操作核对顺序，不授权发布或修改产品代码。先遵循根目录 `AGENTS.md`、`开发规范.md`、`docs/系统总体架构.md` 和当前任务合同。

## 目标与版本

1. 先从当前开发计划、根 `package.json`、Electron/Tauri 清单与打包脚本确认产品目标、实际构建入口、产物路径及清理范围；不要按历史命令或其他项目的包名推断。
2. LFAA-Harness 桌面产品目标为 Windows/macOS Electron。当前根 `pnpm run build:desktop:win` 仍调用 `apps/desktop-tauri/scripts/package-windows.mjs`，这是待迁移的现行偏差；`pnpm run build:desktop:electron:win` 仅登记 Windows x64 NSIS 包。macOS 构建入口与签名未建立前不得报告已支持。
3. 正式版本以 `docs/updata-log.md` 的“LFAA x.y.z”为项目版本依据。核对实际目标对应的 `package.json`、Electron/Tauri 配置、安装包命名和文档；工具要求的 `package.json` 仍使用纯 SemVer。
4. 现有 Tauri 打包脚本把预期安装包路径中的 `0.1.1` 写死。若检查或维护该旧入口，版本变化时先核对脚本路径与实际配置是否一致；不一致则停止该入口并登记修复，不能靠猜测文件名或通配符掩盖错配。

## 构建与产物核对

1. 运行本次合同和根规范要求的直接相关检查；根据根 `package.json` 与当前 Gate 清单选择真实命令。仓库没有相应 preflight / quality / release 入口时如实记录，不自造“通过”结果。
2. Windows Electron 候选包使用 `pnpm run build:desktop:electron:win`，输出应位于 `dist/apps/desktop-electron/`，临时组装位于 `dist/.tmp/desktop-electron/`。不得把当前 Tauri 默认脚本误称为 Electron 正式入口。所有编译、组装和平台封装输出必须位于根目录 `dist/`。
3. 构建前检查实际脚本会删除或覆盖的精确目标。只允许覆盖脚本明确管理的根 `dist/` 产物；不清理整个 `dist/`，不触及源码、用户数据、密钥、真实 `.env` 或运行中的服务。
4. 构建后核对退出码、产物真实路径、文件大小/时间、版本信息和必要的包清单。签名检查结果只说明签名状态；没有签名不能报告成已签名，构建成功也不等于安装和运行通过。
5. 将安装包与源码备份区分开：若任务需要纯净源码 ZIP，使用根目录 `scripts/backup-project.ps1` 的现行规则，输出 `dist/backups/LFAA <版本>.zip` 并排除整个 `dist/`、依赖、运行数据、密钥和真实 `.env`。不要把源码 ZIP 当作安装包或正式发布资产。

## 纯净产品包验收

- 发行物只包含 LFAA 仓库正式登记的第一方内置 Profile/Bundle 和锁定的运行依赖。Electron Builder 的暂存清单不得从开发机 `LFAA_DATA_DIR`、插件安装目录、用户 Home 或安装现存目录复制内容。
- 核对最终源 ZIP/安装包文件清单，排除外部安装的插件及其数据、用户账号/凭据、Provider 密钥、游戏实例/存档、数据库、缓存、日志和开发机绝对路径。必要的第三方运行库不是外部插件。
- 从干净 Git 克隆重新安装依赖并构建，再把安装包安装到开发盘之外的位置；首次运行须为空白账户、数据及外部插件状态。只读暂存清单或构建成功不等于最终归档和异盘验收通过。

## 隔离安装测试与平台边界

- 安装、启动、升级和卸载测试放在可丢弃的 Windows 测试环境/独立账户中，验证基本启动、必要服务和退出行为；不要用可能含真实 `LFAA_DATA_DIR`、账户凭据或 Minecraft 实例的主环境做破坏性安装/卸载测试。
- 分别记录静态检查、构建产物核对、签名检查、安装启动测试和真实设备验收。没有实际执行的步骤必须标为未运行。
- macOS 是正式桌面目标，但当前仓库尚无 Electron 构建与安装测试链；Linux 和 Android 为后续平台目标。缺少对应实现或真实设备时报告缺口，不套用 Windows 命令，也不宣称平台包可用。
- 安装包构建本身不等于正式发布。上传、签名、创建版本、推送、商店提交或外部发布只在用户明确授权后进行。
