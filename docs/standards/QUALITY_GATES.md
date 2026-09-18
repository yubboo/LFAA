# LFAA 质量门禁规范

## 1. 禁止假成功

`build`、`typecheck`、`test`、`lint`、`security` 等质量命令必须执行真实检查。尚未实现时必须明确返回失败。

## 2. 最小合入门禁

- 治理一致性；
- 格式化；
- lint 零 warning；
- TypeScript `tsc --noEmit`；
- 单元/集成/协议契约测试；
- 真实 build；
- Rust 相关检查；
- 依赖边界；
- 安全扫描和依赖审计；
- 无无关文件修改。

## 3. Node.js 工具链

Node.js 依赖安装和 workspace 任务统一使用 pnpm。CI、本地脚本和文档命令不得混用 npm/npx/yarn/bun。

## 4. 变更分级

A：架构、安全、协议、数据库。  
B：普通功能。  
C：局部缺陷、文档和低风险脚本修复。
