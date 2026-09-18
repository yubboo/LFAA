# LFAA 测试策略

## 强制门禁

- 测试命令必须执行真实测试，禁止占位成功；
- 缺陷修复必须有回归用例或可重复验证证据；
- 安全关键模块必须覆盖允许、询问、拒绝、超时、取消和篡改路径；
- 性能测试必须记录数据集、环境、P50/P95/P99 和资源消耗；
- CI 中失败、取消、跳过都不算通过。

## TypeScript

- Unit
- Integration
- Protocol contract
- Fake Model
- Event replay

## React

- Component
- Feature
- Web E2E
- Desktop smoke E2E

## Rust

- Unit
- Broker integration
- Path boundary
- Process cancellation
- Secret redaction
- symlink/junction/path traversal/TOCTOU
- command argument injection
- resource limit and child-process cleanup

## Agent

- Fixture
- Repeated run
- Verifier
- Cost
- Latency
- Pass rate
- Regression baseline

## Durable Run

必须覆盖：

- model stream 中断
- tool 执行中断
- tool 已完成但下一步未执行
- runtime 重启
- UI reload

## Config / Migration

必须覆盖：

- 空库初始化；
- 连续跨版本迁移；
- 迁移中断和事务回滚；
- 损坏数据与未知字段；
- 并发读取/写入；
- Secret 明文不进入 SQLite、日志、Trace 和错误信息；
- 目标数据规模下的迁移时间与空间预算。

## Project Resources

必须覆盖：

- 只从最近项目根 `.lfaa/` 解析；
- 不读取用户级安装；
- 来源、版本、哈希、许可证校验；
- capability 越权拒绝；
- 项目移动后仍可解析；
- 嵌套项目不隐式合并父资源。
