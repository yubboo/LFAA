# 客户端附件上传

输入框选文件/粘贴截图后调用：校验类型（PNG/JPEG/GIF/WebP/纯文本）与大小（≤8 MiB）→ base64 → `POST /api/attachments` → 返回附件元数据。

- 前端校验只为快速反馈，服务端仍会重新校验；失败一律抛错，不返回假成功。
- 只返回元数据（id/name/mediaType/bytes/sha256），字节由服务端附件 Owner 持有。
- 组件与输入框接线在下一批加入；本包当前只提供上传函数。
