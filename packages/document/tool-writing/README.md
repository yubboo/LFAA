# 写作工具适配 Owner

持有当前作品的查询、分析、Skill、提案与应用合同；工厂只在有真实 WritingTarget 时产出工具。业务事务与账户/作品隔离继续归 Writing。

公共合同：writingToolsFor(target) 经原 Tools 注册表工厂装配；保留原 writing_* 名称。不因界面分类隐藏方法，也不允许从模型猜测作品目标。

运行位置：Control Plane 的 Cordis 插件或内部合同库，由 base Bundle 装配；不运行在浏览器，不将凭据或节点进程带入客户端。依赖以本包 package.json 为准，真实消费者见生成包清单的静态证据。源码/装配声明与现场运行验收分别记录。

设置：复用 plugins.enabled（第三方扩展）、plugins.skillDirectories（Skill 来源）、permissions.mode、Provider/模型及 aiRuntime 的输出/请求/上下文/工具/委派预算；领域工具读取原 minecraftRuntime、设备存储位置及节点覆盖。没有新增设置或默认值，不重置用户偏好。内置方法不因第三方开关关闭而成为虚假不可用，用户内容仍受原范围与开关约束。

安全与数据：目录/方法不构成授权；真实动作经过原 Permission、参数、账户、作品/项目/节点和领域事务。加载不执行外部文档指令，不自动重放未知副作用。注册随所属 Fiber 撤销，异步正文加载前后检查登记，Run 工具选择不进入全局状态；子任务只继承父 Run 提供的范围。

构建输出：根 dist/packages/document/tool-writing/。直接回归见 apps/cli/tests/package-owner-lazy-capabilities.test.mjs、harness-runtime-wiring.test.mjs 与各领域长期测试；具体已运行结果见本轮任务合同及交付报告，不能据包存在宣称 Provider/桌面/远端已实测。

跨界面按需读取 writing_get_context 后，Run 从 Writing Owner 的轻量元数据绑定当前账户已选作品；正文只在该明确读取动作返回，不预加载，也不接受模型指定其他作品。父任务欲让专家执行领域动作，须先加载供其继承的工具；角色正文不扩权。
