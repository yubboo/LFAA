# LFAA AI Runtime Hook 协议

本包为 LFAA Host 内受信任 Cordis 扩展提供类型化推理生命周期事件。`beforeInference`/`afterInference` 用于观测；`requestRoute` 每次真实模型调用前可建议当前用户已配置的模型账户 ID 和该模型目录支持的思考档位。

路由事件只暴露最近一条用户文本（最多 4,000 字符）、最多 128 条无秘密模型账户目录和可取消信号；不暴露 Provider 地址、密钥、权限模式、工具或完整会话。Agent Loop 逐条通过 `lfaaAgentDefaultModel.resolveRoute`/Settings Owner 重验账户归属和思考能力，未配置或不支持的提议会被忽略。注册由 Cordis owner effect 管理，插件卸载时自动撤销。

协议本身不安装、导入或隔离第三方包；DSH bundle 到 LFAA Hook 的转换及通用 DSH Runtime 仍需由 Plugin Manager/宿主装配批次实现。
