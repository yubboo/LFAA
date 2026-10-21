# Project Files Host

本机/Daemon 共用的受限项目文件执行实现。调用方必须先确定真实目标根并沿既有 Permission Owner 授权；本包校验路径边界、符号链接、LFAA 数据目录、普通 UTF-8 文本大小与 SHA-256 并发修改。`read` 操作可由调用方指定 1–100000 字符的读取上限，未指定时沿用既有默认值。Agent 本机仓库由 LFAA 本机 Host 调用，目标节点由 Daemon 调用同一实现。认证 Workspace Controller 可通过固定操作动态解析系统“文档”目录并创建默认工作区；既有路径登记错误时只创建规范目录并更新项目登记，不复制或改写旧目录内容，也不访问 LFAA 业务数据目录。

本包不持有 Agent 会话、仓库登记或权限，也不接受工具调用者提供的权限模式。Daemon 只保留 stdin/stdout 适配器，不复制文件业务规则。

本机 Host 可为当前可信项目根中的普通 HTML/HTM 建立只读短期预览服务：仅绑定 `127.0.0.1` 的临时端口，只响应 GET/HEAD，不提供目录列表或写入；每个 HTML、脚本、样式和媒体资源请求都会重新校验真实路径、符号链接与 LFAA 数据目录边界，并限制单文件大小。返回的关闭句柄由 Browser Session Owner 持有，Session 结束或空闲过期时回收服务。

构建只写仓库根 `dist/packages/host/project-files/`。

项目 Git 差异对根目录省略空 pathspec，并将未跟踪普通 UTF-8 文本与已跟踪差异一起返回；执行器禁用外部 diff/textconv，路径按 literal 传给 Git。差异输出最多 2 MiB、未跟踪文本最多 200 个文件/1 MiB，超过上限以 `diffTruncated` 标记；二进制、符号链接和无效 UTF-8 不按文本内容返回。
