# AI 配置 Core

这里是 Provider 无关的配置领域核心。

只允许放：

- Provider 插件公共契约；
- Registry / 注册与查找；
- Account/Auth/Model/Secret 引用等跨厂商规则（后续阶段）；
- 与厂商无关的校验。

禁止放：

- OpenAI / DeepSeek / Kimi 等厂商 URL；
- `if (provider === ...)` / `switch(provider)`；
- React / DOM / Web Host；
- Secret 明文；
- 模型推理 Runtime。
