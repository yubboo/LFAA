# 附件合同

附件类型的唯一 Owner：媒体类型嗅探（按魔数）、8 MiB 大小上限、名称归一化、摘要与 data URL 生成。存储由 `attachment-local` 实现，账户隔离与路径围栏由提供方负责。

- 不持有文件、不写设置、不注册工具。
- `ATTACHMENT_MEDIA_TYPES` 是唯一白名单；不在其中的内容一律拒绝，不静默截断。

构建输出：根 `dist/packages/attachment/attachment/`。
