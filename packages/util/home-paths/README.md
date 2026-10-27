# 数据根与私有目录工具

`resolveHomeDirectory()` 是本机账户/控制数据 Home Owner：`LFAA_HOME` 必须是绝对路径；留空默认 `%USERPROFILE%\.lfaa`（非 Windows 使用 `~/.lfaa`）。`resolveDataDirectory()` 是业务 Data 根 Owner：显式部署 `LFAA_DATA_DIR` 优先；否则读取设置中心“项目与存储”选择，首次默认 `<LFAA_HOME>/data`。控制配置文件 `<LFAA_HOME>/storages/data-directory.json` 保存这一唯一选择。Home 承载数据库、账户文件、会话、凭据、控制配置与 Skill 来源；Data 根承载账户业务文件、游戏、运行环境、工具、缓存、临时文件、日志、备份、模型与联机配置。应用推荐位置按当前项目/安装根动态解析为 `data`。切换 Data 根只登记新路径并创建分类；旧根和其中的文件保留，重启后控制端与本机 Daemon 读取同一个选择。App Boot 的 Profile Cordis Patch 与 Plugin Manager 的插件源码/清单位于 `<LFAA_HOME>/profiles/<Profile>`；受控 Wallpaper Engine 运行副本和默认私有运行数据位于该 Profile 的 `runtime-adapters/<plugin-id>/` 与 `runtime-data/<plugin-id>/`。插件自有存储位置配置由对应 Plugin/Runtime Owner 解释；旧 `<LFAA_HOME>/plugins` 与 `<LFAA_DATA_DIR>/plugins` 不再作为入口，也不由系统 data 初始化或迁移接管。系统账户数据、业务 Data 与 Profile 目录不会互相扫描或合并。自动化回归只使用合成数据；浏览器验收复用现有 `admin` 测试账号，不提供临时存储模式或独立临时 Web 服务。Profile 配置不创建 `node_modules`，也不会在用户目录运行任意依赖安装脚本。

`private-directory.mjs` 保护真实凭据目录：POSIX 0700；Windows 受保护继承 ACL 只允许当前 OS 账户、SYSTEM 和 Administrators。路径经环境变量进入固定 PowerShell/.NET 脚本，不插入命令文本；符号链接拒绝，权限设置失败阻止密钥访问或创建。每进程成功保护后缓存，避免在请求链反复同步启动辅助进程。

账户设置与外观素材位于 `<LFAA_HOME>/users/<账户 SHA-256>/`；外观上传素材由 Settings Owner 放在 `assets/backgrounds/`，文件名来自用户上传原名，账户内重名时使用可读序号区分。`LFAA_DATA_DIR` 是业务数据根，不承载外观偏好或账户私有外观图。

由 launch-environment、Settings 和 Daemon 的既有凭据路径调用；它不负责用户认证、加密或权限审批。测试检查真实目录和既有文件 ACL，不使用产品凭据。

2026-10-23 路径说明：`.lfaa` 是账户/控制 Home，`LFAA_DATA_DIR` 默认指向 `.lfaa/data`。`ensureHomeDirectories()` 只创建 Home 的账户与控制分类；`ensureDataDirectories()` 只在有效 Data 根创建业务分类，并初始化共享 `models/`、`input/`、`output/`。LFAA 模型目录由自身适配器合同定义，分类为 `models/text/`、`image/`、`video/`、`audio/`、`encoders/`、`vae/`、`adapters/`、`acceleration/`、`upscalers/`。完整 Hugging Face / Diffusers 模型目录保留其原生组件结构，分别落入 `models/image/<模型>/` 或 `models/video/<模型>/`；目录类别不意味着采用其他推理引擎的权重格式。`input/` 与 `output/` 下按账户 SHA-256 分目录；AI Video 用户上传的图片/视频/音频素材镜像到 `input/<账户哈希>/`，本机模型成功生成并提交项目的图片/视频镜像到 `output/<账户哈希>/`，不会把远程 Provider 输出写入本机输出目录。它们是用户管理的文件库，不自动清理；AI Video 项目自身的素材副本仍由项目 Owner 管理。历史上创建的 `diffusion_models/`、`text_encoders/`、`loras/`、`model_patches/`、`upscale_models/` 目录不会被清理或自动识别，既有文件保留。Veo3 是远程 Provider，不登记为本机模型。账户设置与业务项目文件继续由各自 Owner 持有。

`ensureHomeDirectories()` 与 `ensureDataDirectories()` 由控制端和本机 Daemon 启动时分别调用：前者在 Home 创建账户/控制分类、Skill 根并保护凭据；若 `<LFAA_HOME>/目录说明.txt` 不存在，还会创建仅含相对目录用途的说明文件，不覆盖用户已有文件。后者只在 Data 根创建业务分类。两者不创建账户、作品或游戏实例；重复调用安全。Profile 根由各自 Owner 管理，不由两种分类初始化接管。

`<LFAA_HOME>/skills/` 是本机用户级 Skill 根。小鱼安装和用户手动放置的 Skill 均使用 `<技能名>/SKILL.md`，由 Skill Registry 发现。本机 GitHub Skill 安装的来源和逐文件 SHA-256 清单仍由 Knowledge Library Owner 记录；旧版 `skills/account-installed/<账户 SHA-256>/<技能名>/` 和 `<LFAA_DATA_DIR>/users/<账户 SHA-256>/knowledge/skills/` 安装仍可回读/按 ID 卸载。项目 Skill 独立位于项目 `.lfaa/skills/` 或 `.agents/skills/`；软件内置 Skill 直接随 `packages/skill/*` 装配，不复制到用户目录。`目录说明.txt` 概述这些路径，但不列出实际账户 ID、绝对路径、凭据或会话内容。
