# 领域与写作专家内容 Owner

持有 SteamCMD/Minecraft/写作/通用画布/AI 漫剧领域角色和六个作品角色的元数据及方法。作品角色 ID 只作为偏好，不自动把全文注入主请求。

公共合同：expert.minecraft-hosting（目录名称“Minecraft 应用维护员工”，稳定 ID 保持兼容）、expert.steamcmd-hosting、expert.ai-writing、expert.canvas-director、expert.aivideo-director（仅 aivideo App）、expert.writing.<原角色 ID>；writing-catalog 只提供稳定 ID 校验，正文加载与实际委派分别由扩展注册表和原 Agent Loop 完成。Minecraft 员工覆盖 LFAA Minecraft App 源码/问题维护与实际 Minecraft 环境运维；它仅依据本 Run 已登记和继承的工具协作，浏览器来源不可用时可重新发现已接入的 Runtime/Core/领域工具，复杂任务按需复用现有子 Agent，并不新增身份、执行器、权限或数据 Owner。`expert.canvas-director` 使用通用 `canvas_*` 工具；`expert.aivideo-director` 使用 `packages/video/tool-ai-video` 的漫剧 Owner 工具，画布 UI 背后的项目仍是聊天共用的同一份 AI Video 数据，不新建第二套画布项目。

运行位置：Control Plane 的 Cordis 插件或内部合同库，由 base Bundle 装配；不运行在浏览器，不将凭据或节点进程带入客户端。依赖以本包 package.json 为准，真实消费者见生成包清单的静态证据。源码/装配声明与现场运行验收分别记录。

设置：复用 plugins.enabled（第三方扩展）、plugins.skillDirectories（Skill 来源）、permissions.mode、Provider/模型及 aiRuntime 的输出/请求/上下文/工具/委派预算；领域工具读取原 minecraftRuntime、设备存储位置及节点覆盖。没有新增设置或默认值，不重置用户偏好。内置方法不因第三方开关关闭而成为虚假不可用，用户内容仍受原范围与开关约束。

安全与数据：目录/方法不构成授权；真实动作经过原 Permission、参数、账户、作品/项目/节点和领域事务。加载不执行外部文档指令，不自动重放未知副作用。注册随所属 Fiber 撤销，异步正文加载前后检查登记，Run 工具选择不进入全局状态；子任务只继承父 Run 提供的范围。

构建输出：根 dist/packages/preset/domain-experts/。直接回归见 apps/cli/tests/package-owner-lazy-capabilities.test.mjs、harness-runtime-wiring.test.mjs 与各领域长期测试；具体已运行结果见本轮任务合同及交付报告，不能据包存在宣称 Provider/桌面/远端已实测。
