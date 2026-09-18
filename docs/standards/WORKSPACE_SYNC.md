# LFAA 稳定工作区同步规范

## 1. 固定目录

正式开发结构：

```text
H:\lfaa\
├── lfaa\                 # 唯一稳定工作区 / 唯一 .git
├── LFAA-v0.0.2\          # 版本快照
├── LFAA-v0.0.3\          # 版本快照
└── LFAA-v0.0.3.zip
```

## 2. 唯一 Git 工作区

`.git` 只允许长期存在于：

```text
H:\lfaa\lfaa\.git
```

版本快照不重新初始化独立 Git 历史。

## 3. 每个版本包自带

```text
LFAA-Sync.bat
LFAA-GitHub.bat
LFAA-Update.bat
LFAA-Setup.bat

scripts/windows/
├── lfaa-sync.ps1
├── lfaa-github.ps1
├── lfaa-update.ps1
└── lfaa-setup.ps1
```

BAT 只负责启动 PowerShell，不承载复杂逻辑。

## 4. 同步要求

同步前必须真实比较：

- 新增文件；
- 修改文件；
- 删除文件；
- 未变化文件数量。

输出完整相对路径，并使用：

```text
【新增】【ADD】
【修改】【MOD】
【删除】【DEL】
```

颜色区分。

确认后才能执行。

## 5. 完整性

除明确的本地保护项外，版本包项目文件必须完整镜像到稳定工作区。

同步完成后必须再次执行 SHA-256 校验。

任何剩余差异都视为失败。

## 6. 永久保护

目标工作区以下内容不参与版本镜像删除：

```text
.git/

node_modules/
target/
dist/
coverage/
.cache/
.tmp/

.lfaa/cache/
.lfaa/state/
.lfaa/tmp/
.lfaa/logs/

.env
.env.local
.env.development.local
.env.production.local
.env.test.local
```

其中：

- `.git` 保存唯一 Git 历史；
- - `docs/logs/workspace-sync/*.log` 保存本机同步留痕，并从镜像差异判断中排除；
- `.env*` 保存本机 Secret/环境差异；
- build/cache 目录属于本机产物。
- `.lfaa/skills`、`.lfaa/experts`、`.lfaa/plugins`、`.lfaa/extensions`、`.lfaa/mcp` 属于项目级资源，不得改为用户级全局目录；其中运行时 cache/state/tmp/logs 单独保护。

`/.env.example` 仍然属于项目文件，必须正常同步。

## 7. 删除语义

如果某个普通项目文件：

- 存在于稳定工作区；
- 不存在于新版本包；
- 不属于保护范围；

则同步计划中显示：

```text
【删除】【DEL】 relative/path
```

用户确认后才删除。

因此稳定工作区最终与版本包保持精确一致。

## 8. 同步日志

每次实际同步记录到项目文档日志目录：

```text
H:\lfaa\lfaa\docs\logs\workspace-sync\
```

记录：

- 时间；
- 版本；
- 来源；
- 目标；
- ADD；
- MOD；
- DEL；
- 最终状态。

该目录不进入 Git。


## 9. GitHub 一键推送

GitHub 脚本：

```text
LFAA-GitHub.bat
→ scripts/windows/lfaa-github.ps1
```

必须遵循和同步脚本相同的可观察性原则：

1. 检测当前 Git 变化；
2. 彩色列出新增 / 修改 / 删除 / 重命名；
3. `git add -A` 后再次列出真正 staged 文件；
4. Commit 名称由用户手工输入；
5. 首次 Commit 也不强制使用固定 `first commit`；
6. 用户输入 Commit 名称后直接创建本地 Commit，不再二次确认；
7. Push 前保留确认；
8. 默认禁止 `git push --force`；
9. 远程已有 main 时先 `git pull --rebase`；
10. 生成本机日志到 `docs/logs/github-push/`。

`.git` 只初始化一次，之后必须复用。


## 10. Git 原生命令输出规范

GitHub 脚本默认控制台使用中文。

规则：

- 成功的 Git 原始输出不直接显示；
- 首次无 `origin` 属于正常状态，不得当作错误；
- 先 `git remote` 判断，再新增/读取 `origin`；
- 失败时原始 Git 技术输出写入 `docs/logs/github-push/*.log`；
- 控制台给用户显示中文错误摘要；
- 禁止把 Git 大段英文帮助页直接暴露给普通用户。


## 11. origin 配置

远程仓库地址不得写死在 LFAA 脚本。

第一次运行 Git 推送时：

```text
无 origin
→ 用户输入仓库地址
→ 用户确认
→ git remote add origin
→ 保存到 .git/config
```

以后：

```text
已有 origin
→ 自动读取
→ 不再询问
```

`.git/config` 是 origin 的唯一事实源。

禁止另外创建：

```text
origin.json
github.config.json
```

等重复配置。


## 12. 终端结束状态

所有 Windows 一键脚本必须明确告诉用户流程是否已经结束。

成功必须显示：

```text
【提示】【可关闭】全部操作已完成，现在可以安全关闭终端窗口。
```

失败也必须说明：

```text
【提示】【可关闭】错误信息已经保留，现在可以关闭窗口；处理问题后再重新运行。
```

BAT 只负责启动 PowerShell。

最终状态、颜色、等待按键全部由 PowerShell 统一处理，避免：

- 用户不知道是否还能关闭；
- BAT/PowerShell 双重 pause；
- 中英文提示混杂。


## 13. Commit 名称输入即确认

GitHub 一键推送中：

```text
【输入】【提交名称】
```

用户完成提交名称输入后，即视为确认创建本地 Commit。

禁止再次出现：

```text
【确认】【创建提交】
```

避免重复交互。

远程 Push 仍保留独立确认，因为 Push 会改变远程仓库状态。


## 14. Git Clone 后的源码更新

`git clone` 只用于第一次获取仓库。

以后更新已经克隆的源码使用：

```text
LFAA-Update.bat
→ scripts/windows/lfaa-update.ps1
```

更新脚本必须：

1. 找到真实 `.git` 工作区；
2. 使用 `.git/config` 中的 `origin`；
3. 检测本地未提交修改；
4. 有未提交修改时停止，禁止覆盖；
5. `git fetch --prune origin`；
6. 比较本地/远程 ahead/behind；
7. 已是最新则直接结束；
8. 本地领先时不 pull，提示 Push；
9. 本地/远程分叉时停止，不自动 merge/rebase；
10. 仅在“本地纯落后”状态下使用 `git pull --ff-only`；
11. 拉取前列出远程新增/修改/删除/重命名文件；
12. 拉取后校验本地 HEAD 与远程一致；
13. 生成 `docs/logs/source-update/*.log`；
14. 成功后明确提示可以关闭终端。

禁止更新脚本默认执行：

```text
git reset --hard
git clean -fd
git pull --force
```

等可能破坏用户本地工作的操作。


## 15. Windows 工具菜单

LFAA 的 Windows BAT 启动器双击后不得直接执行写操作。

必须先进入数字菜单：

```text
LFAA-Update.bat
LFAA-GitHub.bat
LFAA-Sync.bat
LFAA-Setup.bat
```

菜单至少必须包含：

- 执行主操作；
- 只读检查/预览；
- 相关配置或安全高级操作；
- 退出。

## 16. 强制拉取

强制拉取属于明确用户选择的高级操作。

执行前必须：

- fetch 最新远程；
- 显示本地/远程差异；
- 建立本地 backup branch；
- 将未提交和未跟踪文件保存到 stash；
- 用户确认后才 reset；
- 不使用 `git clean -fdx`，避免删除 ignored 的本地 Secret/缓存；
- 完成后显示恢复点。


## 17. Git 工作区路径无关

Git 拉取/更新工具严禁写死：

```text
C:\
D:\
H:\
H:\lfaa\lfaa
```

等路径。

更新脚本必须优先通过：

```text
git rev-parse --show-toplevel
```

确定真实 Git 根目录。

自动发现失败时才允许用户输入项目路径。

目录名称、磁盘盘符、移动硬盘/U盘位置均不能成为脚本运行前提。


## 18. Update 状态判断顺序

源码更新必须先判断 Git Commit 状态，再决定是否读取文件差异。

```text
ahead=0 / behind=0
→ 已是最新
→ 禁止继续 diff

ahead>0 / behind=0
→ 本地领先
→ 安全模式不读取远程 diff

ahead>0 / behind>0
→ 已分叉
→ 安全模式直接停止

behind>0
→ 才读取远程文件变化
```

文件差异优先使用两个明确 tree-ish：

```text
git diff <local-commit> <remote-ref>
```

不要依赖拼接 revision-range 字符串作为唯一实现。
