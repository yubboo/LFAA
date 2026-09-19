# Config System

## 目录

`packages/config-system`

## 定位

LFAA **配置设置业务的唯一归属域**。UI、Web、Desktop、CLI 都只能调用这里的公开配置能力，不得各自维护第二套 Config / Account / Auth 业务。

## 当前负责

- `LfaaConfig` 根配置契约与 Config Schema Version；
- App Settings / Runtime / Permission Default；
- Provider / Model / Account 元数据与 `credentialRef`；
- 默认配置与运行时校验；
- 后续 `settings/*` 子域；
- AI 设置业务：Account/Auth/Model/SecretRef/Provider Registry 与各厂商**配置插件**。
- 模型目录与 Model Capability：模型 ID 优先来自官方运行时目录 API；高级参数必须来自 Provider 官方资料并由 Core 白名单校验。

AI 设置固定结构：

```text
src/settings/ai/
├── core/
├── transports/        # 只有出现真实共享传输时才建立实现
└── providers/
    └── <provider>/
```

## Provider 配置插件 vs Runtime Provider

本包的 Provider 插件负责“如何配置、认证方式声明、配置期校验/模型发现契约、错误映射”。
模型实际推理/流式生成 Runtime Adapter 仍属于模型运行域（例如 `model-providers`），不能因为厂商相同就把 Runtime 塞进 Config System。

## 不负责

- React / DOM / 页面布局；
- Web / Electron / CLI 宿主代码；
- API Key / Token / Password 明文普通配置持久化；
- Rust Secret Store 的 OS 实现；
- Agent / Tool / Policy / Permission 执行；
- 模型推理 Runtime。

## 对外 API

统一从 `src/index.ts` 导出。包外禁止直接引用内部文件。

## 安全边界

普通配置只保存 `credentialRef`。真实 Secret 最终由 Rust Secret Broker / OS Credential Store 持有。

## 修改要求

修改前读取 `AGENTS.md`、`DEVELOPMENT.md`、当前 Prompt、`docs/MODULES.md` 和 `docs/项目结构与代码地图.md`；新增 AI Provider 必须放进 `src/settings/ai/providers/<provider>`，不得散落在 App/UI。
