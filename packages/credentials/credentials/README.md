# @lfaa/credentials

Credential Service Definition。只定义安全引用/读写 seam，不绑定 Windows、Rust 或具体存储实现。

Secret 明文禁止进入普通 JSON、Git、Plugin Manifest、日志、argv、普通 env、模型上下文和可同步项目资源。Host/Adapter 只通过 credential reference 访问实际 Secret。
