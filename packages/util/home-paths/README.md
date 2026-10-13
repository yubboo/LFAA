# 数据根与私有目录工具

路径解析继续遵循现有 LFAA_HOME/LFAA_DATA_DIR 与运行入口合同，不搬迁其他 checkout 或用户数据。

`private-directory.mjs` 保护真实凭据目录：POSIX 0700；Windows 受保护继承 ACL 只允许当前 OS 账户、SYSTEM 和 Administrators。路径经环境变量进入固定 PowerShell/.NET 脚本，不插入命令文本；符号链接拒绝，权限设置失败阻止密钥访问或创建。每进程成功保护后缓存，避免在请求链反复同步启动辅助进程。

由 launch-environment、Settings 和 Daemon 的既有凭据路径调用；它不负责用户认证、加密或权限审批。测试检查真实目录和既有文件 ACL，不使用产品凭据。
