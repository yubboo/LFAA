# LFAA Project Plan — current v0.1.12

## 当前里程碑

**v0.1.12 / #22.18 Local Identity Gate / App Hub / User RBAC（implementation complete · pending-user-acceptance）**

目标：在 v0.1.11 Project/Session 真值上补齐“没有钥匙不能使用软件”的实例级访问边界。首次启动创建唯一超级管理员；后续必须登录才能进入 App Hub/Workbench；Host HTTP API 再次校验 AuthSession；设置中心提供用户、角色、权限管理。

本版新增：

- `@lfaa/identity` / `@lfaa/identity-host-node` / `@lfaa/identity-controller`；
- scrypt 密码散列、HttpOnly Auth Cookie、First Run 一次性初始化；
- 登录后的 App Hub 大展台；未实现 App Pack 明确 disabled；
- Settings“用户与权限”管理；
- Workbench Profile 使用真实登录用户，不再写死个人信息；
- v0.1.11 Chat/Work/Manual/Session/Infinite Canvas 行为保持不变。

## 当前冻结行为

本阶段不主动重做：

- Workbench 视觉布局；
- Chat/Work 模式；
- Infinite Canvas 行为；
- Composer/Reasoning/模型切换/动画参数；
- Provider/Account 已有设置语义；
- Plugin lifecycle 语义；
- Secret Broker 协议；
- Windows 工具总体交互。

迁移发现真实 bug 时修复，但不能借架构迁移顺手重写产品。

## 下一阶段顺序

### Phase 2 — Access Boundary 收口

把当前 HTTP AuthSession Gate 扩展到 Vite dev WebSocket / Terminal / Runtime Event 通道；在这一步完成前，不宣称本地访问边界已经覆盖全部传输面。

### Phase 3 — App Pack Runtime 化

让现有 `app-pack` Capability 从协议升级为真实业务入口边界：Web Bundle 只装配一份共享 Plugin Registry，App Hub 从 Registry + 当前用户权限生成入口；Project 增加 App Pack 归属，Agent Run 由 Host 解析 Capability Scope，而不是让 Client 传入的 capability IDs 成为授权真值。

### Phase 4 — 第一个真实 App Pack

只选一个真实 Consumer（优先 Minecraft 或 AI Writing）贯通 Primary Agent / Skill / Tool / Workbench Node / Artifact Renderer；验证完扩展模型后再复制到其他入口，禁止提前创建四套空业务 package。

### Phase 5 — Runtime / Desktop / CLI 复用

只有第二个真实 Host Consumer 出现后再抽可复用 Bundle/Runtime seam；继续遵守“有真实 Consumer + 独立生命周期才拆 package”。

## 架构决策原则

1. packages-first；
2. App 薄；
3. Bundle 装配；
4. Native 少；
5. 有 Consumer 才拆包；
6. package name 稳定优先于物理路径稳定；
7. contract test 是重构护栏；
8. 新文档描述当前真相，历史日志只用于追溯。
