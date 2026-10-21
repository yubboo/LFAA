# 共享工具合同与注册 Owner

持有工具类型/参数辅助、可撤销注册/上下文工厂与 Run 摘要目录。领域工具和正文不再集中在 business-tools。

公共合同：registerAiBusinessTool、registerAiBusinessToolFactory、listAiBusinessTools、createToolDiscoveryTools。`lfaa_tools_list` 支持按名称、说明或领域做多词任一命中搜索，结果先按完整查询命中、再按命中词数量排序，并返回 `matchedTerms`；空查询保留注册顺序和分页。`lfaa_tools_load` 仍只按精确工具名加载已有合同，不执行业务。

Skill 附属文本资源通过 `lfaa_skill_load` 按当前 Skill Provider 或项目文件 Owner 读取；项目文件工具的 `read.limit` 可限制为 1–100000 个字符，不改变原有根目录、节点、身份与权限检查。

运行位置：Control Plane 的 Cordis 插件或内部合同库，由 base Bundle 装配；不运行在浏览器，不将凭据或节点进程带入客户端。依赖以本包 package.json 为准，真实消费者见生成包清单的静态证据。源码/装配声明与现场运行验收分别记录。

设置：复用 plugins.enabled（第三方扩展）、plugins.skillDirectories（Skill 来源）、permissions.mode、Provider/模型及 aiRuntime 的输出/请求/上下文/工具/委派预算；领域工具读取原 minecraftRuntime、设备存储位置及节点覆盖。没有新增设置或默认值，不重置用户偏好。内置方法不因第三方开关关闭而成为虚假不可用，用户内容仍受原范围与开关约束。

`capabilities.settings-status` 对 Browser Use 区分主开关、已登记工具和待接入提供方，不能以 `enabledProviderIds` 为空误报浏览器工具未登记。设置变更仍通过统一 Permission Owner；具体 Host 是否有可启动浏览器由 Browser Owner 的提供方目录确认。

安全与数据：目录/方法不构成授权；真实动作经过原 Permission、参数、账户、作品/项目/节点和领域事务。本机项目只由 `nodeId: null` 或精确匹配受保护本机 Daemon 身份的目录进入本机 Host；身份未知的非空节点 ID 不会被当作本机。加载不执行外部文档指令，不自动重放未知副作用。注册随所属 Fiber 撤销，异步正文加载前后检查登记，Run 工具选择不进入全局状态；子任务只继承父 Run 提供的范围。

构建输出：根 dist/packages/core/tools/。直接回归见 apps/cli/tests/package-owner-lazy-capabilities.test.mjs、harness-runtime-wiring.test.mjs 与各领域长期测试；具体已运行结果见本轮任务合同及交付报告，不能据包存在宣称 Provider/桌面/远端已实测。
