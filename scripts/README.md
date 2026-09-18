# scripts：开发、治理和 Windows 工具脚本

> `scripts/` 不是业务模块。它负责“怎么开发、怎么检查、怎么同步、怎么推送”。

## 根脚本

| 文件 | 作用 |
|---|---|
| `governance-check.mjs` | 项目治理和关键约束。 |
| `import-path-check.mjs` | 导入路径边界。 |
| `dev-log-check.mjs` | 开发日志结构。 |
| `docs-check.mjs` | docs 目录结构。 |
| `comment-check.mjs` | 关键代码中文文件头 / CSS 分区注释。 |
| `check-node-pty.mjs` | node-pty 实际加载检查。 |
| `pnpm-only.mjs` | 强制 pnpm。 |
| `quality-not-configured.mjs` | 未配置质量项明确失败。 |
| `release-name.mjs` | 发布名。 |

## Windows

```text
windows/lfaa-setup.ps1   ← LFAA-Setup.bat
windows/lfaa-sync.ps1    ← LFAA-Sync.bat
windows/lfaa-github.ps1  ← LFAA-GitHub.bat
windows/lfaa-update.ps1  ← LFAA-Update.bat
```

根 BAT 是稳定入口，复杂逻辑全部放 PowerShell。


## 发布与 Windows 编码门禁

| 文件 | 作用 |
|---|---|
| `windows-script-encoding-check.mjs` | 检查 Windows PowerShell `.ps1` 必须 UTF-8 with BOM，并核对 BAT launcher。 |
| `release-consistency-check.mjs` | 检查 `lfaa.release.json` 与 package / crate / README / CHANGELOG / Release 的版本一致性。 |
