# 桌面端安装包：新增免安装 zip，并查明安装失败原因

- 日期：2026-11-21 23:58 +0800
- 类型：Bug 修复 / 分发改进

## 问题

双击 `LFAA-0.1.0-setup.exe` 安装时，进度条接近完成后弹出：

```
不能打开要写入的文件:
"D:\软件\LFAA\Uninstall LFAA.exe"
[中止] [重试] [忽略]
```

## 原因

不是安装包内容坏了。实测：把同一个安装包装进**新的空目录**（含中文路径）可以完整安装（20,328 个文件、卸载器生成、程序可启动），耗时约 2 分 35 秒。

失败的那次把安装目录选成了 `D:\软件\LFAA`，而这个文件夹里已经有**另一个程序的数据**（`bin`、`locales`，以及 10 月 28 日的 `data`，里面有 games/models/credentials 等目录）。安装器最后要往该目录写 `Uninstall LFAA.exe`，被这个既有环境占用/拒绝，于是反复提示；此时点「中止」会留下半安装状态。

## 处理

- 安装包本身不变，仍为 NSIS（仅当前用户、可选安装目录）。
- 新增**免安装 zip** 产物：`LFAA-0.1.0-win.zip`，解压后直接运行 `LFAA.exe`，不依赖安装器与卸载器。
- 文档补充安装目录要求：必须装到空目录；默认 `%LOCALAPPDATA%\Programs\LFAA` 或新建目录；不要装进 `D:\软件\LFAA`（那是别的程序的数据）。
- 文档补充耗时提示：首次安装约 2–3 分钟（约 2 万个小文件，安全软件逐文件扫描），进度接近完成时不要中止。

## 验收

- 同一安装包装进新目录 `D:\软件\LFAA-Setup-Test`：成功，卸载器与 `LFAA.exe` 都在，程序启动后窗口「LFAA 工作区」、宿主子进程独占端口、`/api/workspace/sections` 返回 200。
- 免安装 zip 解压到 `D:\软件\LFAA-Desktop`：窗口、宿主与接口均正常。
- 验收用的测试目录、临时注册表卸载项已清理；`D:\软件\LFAA`（对方程序的数据）保持原样未动。
- 顺带记录：`asar: true` 版本安装很快（74 个文件），但应用启动失败（ESM + Cordis Loader 在 asar 内的解析问题），因此仍保持 `asar: false`。

## 文件

- `apps/desktop/electron-builder.config.mjs`（新增 zip target）
- `apps/desktop/README.md`、`docs/architecture/desktop.md`
- `docs/dev-log/000201-000400.md`、`docs/updata-log/000335-20261121-2358-desktop-installer-folder-conflict.md`

Git 未提交或推送；工作区原有未提交改动均保留。