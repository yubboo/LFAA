# AI 配置 Core

这里是 Provider 无关的配置领域核心。

只允许放：

- Provider 插件公共契约；
- Registry / 注册与查找；
- Account/Auth/Model/Secret 引用等跨厂商规则；
- `AiAccountService`：探测、保存、重测、选模、删除与 Secret/元数据一致性回滚；
- Host Port：Repository / Secret Store / HTTP JSON Adapter / Managed Auth Adapter；
- 与厂商无关的校验。

禁止放：

- OpenAI / DeepSeek / Kimi 等厂商 URL；
- `if (provider === ...)` / `switch(provider)`；
- React / DOM / Web Host；
- Secret 明文；
- 模型推理 Runtime。
