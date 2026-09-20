/**
 * 文件：index.ts
 * 作用：@lfaa/config-system 的唯一公开导出入口。
 * 负责：导出 Config Schema v1 类型、默认值与运行时校验 API。
 * 不负责：暴露内部实现细节、持久化、Secret、UI 或执行层逻辑。
 * 状态归属：无独立状态；公开 API 由 config-schema.ts / config-validator.ts 共同定义。
 * 对外接口：本文件全部 exports。
 * 关联文件：config-schema.ts、config-validator.ts、../README.md。
 * 修改注意事项：包外只能从 @lfaa/config-system 导入；禁止新增跨 package internal export。
 */

export * from "./config-schema.ts";
export * from "./config-validator.ts";
export * from "./settings/ai/index.ts";
