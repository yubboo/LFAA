# Dev Log 000048 — 补强 .gitignore 与推送前 4/5 大文件/依赖/敏感信息双层拦截

- **时间**：2026-11-18 08:30:31 +08:00
- **任务编号**：000048
- **任务目标**：防止通过 `lfaa.bat` 选项 `4`（普通推送）与 `5`（强制推送）把大依赖、构建产物、大文件及敏感凭据/明文密钥推送到 GitHub。

## 变更文件清单

- `e:\lfaa\.gitignore`：补充忽略规则，覆盖 `.pnpm/`、`.pnpm-store/`、`.npm/`、`.yarn/`、`build/`、`out/`、`.vite/`、各类构建/调试日志；敏感凭据文件（`*.pem`、`*.key`、`*.p12`、`*.pfx`、`*.jks`、`*.keystore`、`id_rsa*`、`id_ed25519*`、`*credentials*.json`、`*secret*.json`、`.lfaa/`、`*.db`/`*.sqlite*`）；以及大型压缩包、二进制安装包与模型权重文件（`*.zip`/`*.7z`/`*.rar`/`*.exe`/`*.dmg`/`*.iso`/`*.bin`/`*.gguf`/`*.onnx`/`*.safetensors`/`*.pt` 等）。
- `e:\lfaa\scripts\lfaa.ps1`：
  - 新增 `Test-PushSafety` 检查函数，拦截：
    1. 依赖/构建产物路径（`node_modules/`、`.pnpm/`、`dist/`、`build/`、`coverage/`、`*.tsbuildinfo` 等）；
    2. 超过 `5MB` 的大文件；
    3. 敏感文件名（`.env`、私钥证书、`*credentials*.json`、`*secret*.json`、`.lfaa/`、`*.db`/`*.sqlite*`）；
    4. 非测试文件中的疑似明文密钥/Token（私钥头、`ghp_`/`github_pat_`、`AKIA`、`AIza`、`sk-...` 长密钥）。
  - 在 `Push-ToGitHub` 中分别于 `git commit` 前（`Scope = "staged"`，不通过时自动 `git reset -q` 撤回暂存）与 `git push` 前（`Scope = "tracked"`）执行校验，菜单 `4` 与 `5` 均受保护。
- `e:\lfaa\scripts\README.md`：补充选项 `4`/`5` 推送前安全拦截说明。

## 验证结果

1. **PowerShell 语法校验**：`[System.Management.Automation.Language.Parser]::ParseFile("e:\lfaa\scripts\lfaa.ps1", ...)` 输出 `PS1_SYNTAX_OK`。
2. **安全检查实测**：在当前工作区对全部 `git ls-files` 已跟踪文件运行 `Test-PushSafety -Scope "tracked"`，返回 `TRACKED_SAFETY_CHECK=True`（零误报）。
3. **说明**：本轮未涉及 Web UI 改动，未运行内置浏览器，也未代执行 `git commit` / `git push`。
