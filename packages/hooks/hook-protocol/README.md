# LFAA AI Runtime Hook 协议

本包为 LFAA Host 内受信任 Cordis 扩展提供类型化推理生命周期事件。`beforeInference`/`afterInference` 用于观测；`requestRoute` 每次真实模型调用前可建议当前用户已配置的模型账户 ID、该账户 Provider 目录中已保存的模型 ID，以及该模型目录支持的思考档位。

路由事件只暴露最近一条用户文本（最多 4,000 字符）、最多 128 条无秘密账户/模型路由项和可取消信号；不暴露 Provider 地址、密钥、权限模式、工具或完整会话。Agent Loop 逐条通过 `lfaaAgentDefaultModel.resolveRoute`/Settings Owner 重验用户/账户归属、模型是否存在于账户保存的 Provider 目录及其思考能力，再由 Credential Owner 按同一账户解析凭据；跨到该账户的另一个模型时默认使用 Provider 思考默认值，不更改账户选择。未配置或不支持的提议会被忽略。注册由 Cordis owner effect 管理，插件卸载时自动撤销。

协议本身不安装、导入或隔离第三方包；DSH bundle 到 LFAA Hook 的转换及通用 DSH Runtime 仍需由 Plugin Manager/宿主装配批次实现。
