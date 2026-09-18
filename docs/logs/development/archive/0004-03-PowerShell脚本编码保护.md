# #4.3 PowerShell 脚本编码保护

- **主编号：** #4
- **名称：** 工作区同步与推送
- **记录版本：** #4.3
- **状态：** delivered
- **交付版本：** v0.0.42
- **关键词：** 同步、PowerShell、UTF-8、BOM、Windows PowerShell 5.1、编码、治理

## 变更原因

v0.0.41 为 Windows PowerShell 脚本补结构化中文注释时，文件被重新保存成 UTF-8 without BOM。根 BAT 使用 `powershell.exe -File` 启动这些脚本，而 Windows PowerShell 5.1 对无 BOM UTF-8 脚本的自动识别不可靠，因此 Sync / GitHub / Setup / Update 都产生兼容性回归风险。

## 当前结论

1. `scripts/windows/*.ps1` 必须使用 UTF-8 with BOM；
2. 中文注释规范不能覆盖可执行编码契约；
3. 发布前必须由 `windows-script-encoding-check.mjs` 检查 BOM 与严格 UTF-8；
4. 根 BAT 继续通过 `powershell.exe` 调用对应 `.ps1`；
5. v0.0.42 不改变 v0.0.40 已修复的同步目标推导、路径保护和镜像算法。

## 验证结果

- 4 个 Windows PowerShell 脚本均恢复 `EF BB BF`；
- 编码检查进入治理链路；
- ZIP 解压 Round-trip 后 BOM 必须保持；
- v0.0.41 作为历史缺陷版本保留，不覆盖。

## 原始来源

- `docs/prompts/archive/v0.0.42/0004-03-PowerShell脚本编码保护.md`
- `docs/changelog/v0.0.42.md`
- `docs/releases/v0.0.42/RELEASE.md`
- `docs/standards/WORKSPACE_SYNC.md`
