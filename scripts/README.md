# scripts：开发、治理和 Windows 工具脚本

> `scripts/` 不是业务模块。它负责“怎么开发、怎么检查、怎么同步、怎么推送”。

## 根脚本

| 文件 | 作用 |
|---|---|
| `governance-check.mjs` | 项目治理和关键约束。 |
| `import-path-check.mjs` | 导入路径边界。 |
| `runtime-import-resolution-check.mjs` | Workspace 公共 Export / Subpath Export 运行时解析门禁。 |
| `dev-log-check.mjs` | 单文件开发日志编号与当前任务状态。 |
| `docs-check.mjs` | docs 固定长期文档结构，阻止碎片 Markdown 回归。 |
| `root-layout-check.mjs` | 根目录 Markdown / 长期文档归位 / 临时 ZIP·LOG·TMP 防回归。 |
| `comment-check.mjs` | 关键代码中文文件头 / CSS 分区注释。 |
| `check-node-pty.mjs` | node-pty 实际加载检查。 |
| `node-dependency-health-check.mjs` | 从 pnpm-workspace.yaml 发现全部 importer，校验 workspace 链接、外部 Node 依赖真实解析与 importer 级 lockfile 覆盖，防止 capability-family 深层 package 漏检。 |
| `pnpm-only.mjs` | 强制 pnpm，并拒绝与项目锁定版本不一致的 pnpm。 |
| `quality-not-configured.mjs` | 历史占位失败入口；根级真实质量命令已不再依赖它。 |
| `release-name.mjs` | 发布名。 |
| `release-environment-check.mjs` | Node 24.x / pnpm 11.17.0 / lockfile 正式发布环境门禁。 |
| `release-rust-check.mjs` | Rust workspace check + test 发布门禁。 |
| `release-gates-check.mjs` | 防止 quality:quick / quality:full / release:full 与 Setup 分层检查入口回退。 |
| `ui-contract-check.mjs` | 检查 Web Shell Tooltip、响应式与交互静态契约。 |
| `prompt-lifecycle-check.mjs` | 检查 Prompt → AI 验证 → 用户验收生命周期及当前版本记录一致性。 |

## Windows

```text
windows/lfaa-setup.ps1   ← LFAA-Setup.bat
windows/lfaa-sync.ps1    ← LFAA-Sync.bat
windows/lfaa-github.ps1  ← LFAA-GitHub.bat
windows/lfaa-update.ps1  ← LFAA-Update.bat
```

根 BAT 是稳定入口，Windows 环境写操作与交互放 PowerShell；跨平台项目质量能力通过根 `quality:*` / `release:*` 命令复用，菜单编号不是 API。


## 发布与 Windows 编码门禁

| 文件 | 作用 |
|---|---|
| `windows-script-encoding-check.mjs` | 检查 Windows PowerShell `.ps1` 必须 UTF-8 with BOM，并核对 BAT launcher。 |
| `release-consistency-check.mjs` | 检查 `lfaa.release.json` 与 package / crate / README / CHANGELOG / Release 的版本一致性。 |


> 当前候选版本：v0.1.16（#22.22，pending-user-acceptance）。

## 版本策略

- `version-policy.mjs`：LFAA 显示版本格式与 0-99 进位规则的唯一代码 Owner；`0.0.99` 后返回 `0.1.0`，并拒绝 `0.0.100`。
- `release-consistency-check.mjs`：读取 `lfaa.release.json` 后调用版本策略，并核对所有 package/Cargo/文档版本一致性。

- `tsconfig-reference-check.mjs`：校验 apps / capability-family packages 的 `tsconfig extends` 能真实指向根级 base，并阻止私有 `@/*` paths alias 回流。
