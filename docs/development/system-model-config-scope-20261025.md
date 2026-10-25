# 登录账号与系统模型配置分离（2026-10-25）

## 用户目标与当前问题

- 用户明确：LFAA 登录账号只让用户进入系统；大模型与 Provider 凭据属于系统层配置，登录账号不应各自持有一套 Provider。
- 当前 UI 与服务此前以 `user_id` 隔离 `ai_accounts`，导致登录账户、模型凭据与运行模型耦合；旧账户加密密钥丢失后也缺少在原系统配置上恢复 API Key 的入口。
- 目标：所有登录账户读取同一组系统模型；管理员管理 Provider/API Key/模型和活动项；成员使用系统当前模型；凭据留在控制端加密存储，并可原位替换。

## Owner、运行入口与设置

- 页面入口：设置中心「AI 与模型」及 `/work`；Web/Desktop 共用 `packages/client/ui-settings` 与 `packages/client/connection`。
- 配置/凭据唯一 Owner：`packages/settings/settings`；持久化由 `packages/storage/storage-domain` 写入 `configuration_records` 的 `ai_accounts` system scope（`user_id: null`），凭据继续由控制端 `credentials/settings.key` AES-256-GCM 加密。
- 认证与系统配置编辑由 `packages/api/settings-controller` 通过现有登录认证和 `requireRole("admin")` 执行；读取需要认证。聊天与模型路由消费相同 system-scope 配置，不在 Agent Loop 复制规则。
- 旧数据迁移：只在没有 system-scope 模型时，把已有超级管理员的 `ai_accounts` 原 ID、模型、活动状态、选项和密文原样迁入；不解密、不删除普通成员的旧个人记录。发现已经有系统配置时不覆盖或搬移其他记录。
- 相关用户设置：Provider 选项和当前模型在系统配置；`aiRuntime` 的运行参数及图片/视频模型选择偏好继续按登录账户保存，`permissions.mode` 与 Permission Owner 不变。无需新增设置项或改变现有设置值。

## 允许与禁止

- 允许：把模型配置改为 system scope、服务端执行一次性保留式迁移、管理员编辑控制、成员只读共享模型目录、在同一配置 ID 上测试并替换 API Key；保留用户 `aiRuntime` 与插件凭据归属。
- 禁止：按登录用户复制系统 API Key、把密钥返回浏览器、自动删除旧个人记录、无模型测试地宣称恢复成功、改变 `admin / 123456` 登录账号、重置用户偏好或权限模式。

## 可观察验收条件

- 两个不同认证用户读到相同 system-scope 账户、模型和活动项；改变 system 模型后由所有聊天请求解析到同一活动模型。
- 只有管理员可新增、更新、激活、删除或测试已保存的系统模型；成员无法通过 API 绕过设置页写权限。
- 迁移只搬运超级管理员旧配置且保持 ID/密文；普通成员旧记录保留且不会显示为个人活动模型。
- 更新 API Key 保持同一配置 ID、名称、Provider、模型和活动状态；先向当前模型发送真实测试请求，测试成功后再加密写入。密钥和请求体不出现在 API 响应、日志或浏览器持久存储。
- 运行相关 service/API 回归、类型检查、Control Plane/Web 构建；在内置浏览器验收设置页桌面和窄分栏布局，并通过 `/work` 的真实只读对话验证模型调用（仅当有效系统 API Key 可用）。说明实际页面、视口与 Provider 未测范围。

## 实施记录

- 已完成。Provider、API Key、目录、活动模型和模型路由统一使用 `ai_accounts.user_id: null`；只读 API 仍要求登录，写 API 统一要求管理员。旧数据仅在尚无 system-scope 配置时把超级管理员记录原 ID/密文/模型状态迁入；成员旧记录保留。API Key 可在原配置 ID 上单独测试并加密替换，不创建用户副本。缺少 `settings.key` 时读取不再生成替代密钥，错配错误指向系统配置修复。
- 设置中心没有新增配置项：使用现有「AI 与模型」中的系统 Provider、活动模型和加密 API Key；`aiRuntime` 用户运行偏好、图像/视频模型偏好、权限模式及登录账户保持原归属。本轮未改动已有模型或凭据。
- 实际验证：`node --test apps/cli/tests/system-model-config-scope.test.mjs apps/cli/tests/ai-model-catalog-refresh.test.mjs apps/cli/tests/file-storage.test.mjs` 11/11；`pnpm run typecheck`、`pnpm run build:control-plane`、`pnpm run build:web` 通过，Web/Control Plane `runtime-build-state` 均为 `[]`。`git diff --check` 通过。`pnpm run check:workspace` 未通过，唯一错误是并行改动引用了不存在的 `#lfaa-compact-application-center-anchor-20261025` 合同锚点，本轮保留该范围外改动。
- ChatGPT 内置浏览器：`/settings?section=ai` 桌面 1355×925 与窄屏 390×740 均显示系统共享说明和 DeepSeek Flash 当前模型；`/work` 主聊天使用现存系统 Provider 返回“LFAA 主聊天测试成功。”，约 1 秒，页面标注 `deepseek / deepseek-flash`。另用主聊天调用 Skill 发现/按需加载工具，成功读到随包内置 `minecraft-server-setup`。此前 409 本轮未复现；本轮没有替换 API Key，所以无法判断此前与本轮之间的运行状态变化来源。实际响应证实当前凭据可用；没有测试成员账号的真实浏览器登录或 API Key 替换 UI。
- 响应式与交互限制：设置页桌面/窄屏通过内置浏览器目视检查；没有测短屏以外的其他设备、Desktop WebView 或帧时间。Minecraft Skill 读取答复指出当前 Run 工具目录未提供 `minecraft_*`/`runtime_*` 工具，因此没有执行 Minecraft 服务器动作；随包 Skill 已可发现和加载，无需再安装同一份。
