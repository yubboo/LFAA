# Minecraft bundled Skill Owner

迁移并复用原 registerMinecraftSetupSkill Provider 与原 SKILL.md，不另写执行器。Minecraft App 服务不再负责挂载 Skill。

公共合同：minecraft-server-setup、lfaa-minecraft Provider；元数据跨界面发现，正文经 lfaa_skill_load 的 registry 来源异步读取。AI 扩展登记的 `skillId` 使用相同 `minecraft-server-setup` 名称，设置中心与插件工作区因此展示同一条能力并共用停用状态。

运行位置：Control Plane 的 Cordis 插件或内部合同库，由 base Bundle 装配；不运行在浏览器，不将凭据或节点进程带入客户端。依赖以本包 package.json 为准，真实消费者见生成包清单的静态证据。源码/装配声明与现场运行验收分别记录。

设置：复用 plugins.enabled（第三方扩展）、plugins.skillDirectories（Skill 来源）、permissions.mode、Provider/模型及 aiRuntime 的输出/请求/上下文/工具/委派预算；领域工具读取原 minecraftRuntime、设备存储位置及节点覆盖。没有新增设置或默认值，不重置用户偏好。内置方法不因第三方开关关闭而成为虚假不可用，用户内容仍受原范围与开关约束。

安全与数据：目录/方法不构成授权；真实动作经过原 Permission、参数、账户、作品/项目/节点和领域事务。加载不执行外部文档指令，不自动重放未知副作用。注册随所属 Fiber 撤销，异步正文加载前后检查登记，Run 工具选择不进入全局状态；子任务只继承父 Run 提供的范围。

构建输出：根 dist/packages/skill/minecraft/。直接回归见 apps/cli/tests/package-owner-lazy-capabilities.test.mjs、harness-runtime-wiring.test.mjs 与各领域长期测试；具体已运行结果见本轮任务合同及交付报告，不能据包存在宣称 Provider/桌面/远端已实测。

## 小鱼共享工作入口（2026-10-14）

开服 Skill 增加共享工作、核心/实际模组插件安装与证据的区分；现有领域/通用工具按模型选择，不把说明文本冒充专用安装器。

用户点名核心或提出插件/模组目标时，Skill 指导模型按需读取 `minecraft_list_cores` 的 `serverType` 与 `compatibleContent`，保留指定核心并用 `minecraft_provision_server` 复用现有 Java 自动准备与部署链。该分类和兼容性只由 Minecraft Core Sources Owner 维护。

需要可见桌面操作时，Skill 复用现有 `computer_use_observe`/动作工具，并遵守 `computerControl.enabled` 与 Permission Owner；不自行开启设置，也不把点击回执当成 Minecraft 服务已就绪。

构建只写仓库根 dist/packages/skill/minecraft/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。
