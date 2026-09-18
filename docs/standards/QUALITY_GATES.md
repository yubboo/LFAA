# LFAA 质量门禁规范

## 1. 禁止假成功

`build`、`typecheck`、`test`、`lint`、`security` 等质量命令必须执行真实检查。

尚未实现时必须明确返回失败或使用带 `placeholder` 的名称；禁止打印提示后以成功码冒充通过。

## 2. 最小合入门禁

任何业务模块进入 `deliverable` 前必须通过：

- 文档与治理一致性检查；
- 格式化检查；
- lint，零 warning；
- TypeScript `tsc --noEmit`；
- 相关单元、集成和协议契约测试；
- 真实 build；
- 涉及 Rust 时执行 `cargo fmt --check`、`cargo clippy -- -D warnings`、`cargo test`、`cargo check`；
- 依赖边界与循环依赖检查；
- 安全扫描和依赖审计；
- 无无关文件修改检查。

本地脚本与 CI 必须调用同一组底层命令，避免两套标准。

## 3. CI 规则

- 受保护分支不得绕过必需检查；
- 失败、取消、跳过都不算通过；
- 不得为了合并临时删除测试或降低安全门禁；
- 工具链版本和 lockfile 必须固定；
- CI 使用全新环境验证可复现安装。

## 4. 测试门禁

- 修复缺陷必须先有可复现用例或等价回归测试；
- Policy、Permission、Broker、Secret、Migration 必须覆盖拒绝路径和失败路径；
- 安全关键决策表不得仅靠覆盖率替代；
- changed-code coverage 的具体阈值由模块 Plan 固定，降低阈值必须记录原因；
- flaky test 不得简单重跑掩盖，必须隔离并跟踪修复。

## 5. Package / Crate 创建门禁

新增 workspace 或 crate 必须至少满足一项：

- 独立安全边界；
- 独立依赖生命周期；
- 独立发布/API 兼容责任；
- 可被多个模块稳定复用；
- 必须独立测试或隔离执行。

否则先作为现有 package 的内部模块，避免空 package 扩张。

## 6. 变更分级

### A：架构、安全、协议、数据库

必须有 Prompt、Plan、ADR/设计说明、威胁分析、迁移/兼容计划、完整测试和 Changelog。

### B：普通功能

必须有 Prompt、Plan/Progress、测试和 Changelog。

### C：局部缺陷、文档和低风险脚本修复

必须有任务记录、回归验证和 Changelog；不强制制造无意义的重复设计文档。

## 7. 豁免

任何门禁豁免必须记录：责任人、原因、风险、范围、失效日期和补救任务。永久口头豁免无效。
