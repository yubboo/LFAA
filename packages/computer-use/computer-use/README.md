# LFAA 本机电脑操控

只在 Windows `desktop` Profile 中注册本机屏幕观察、点击、文本输入、组合键和滚动工具。工具使用 `@trycua/cua-driver` TypeScript SDK 在当前 Control Plane 进程内调用系统驱动，不启动独立 CUA Daemon，也不把桌面访问放到 Web 或远程 Daemon Profile。

账户设置 `computerControl.enabled` 默认关闭。“设置中心 > 电脑操控”只读写账户授权开关，不加载或启动桌面驱动，也不执行桌面动作；开关打开后，模型才可在当前 Profile 已装配工具的范围内按任务自行选择调用。截图仅在当前 Agent Run 内存中保留并作为标准图像输入发送给当前 Provider；会话请求、工具轨迹和模型历史只保存截图已省略的标记。每次鼠标或键盘操作都按设置中心 `permissions.mode` 走 LFAA 现有审批合同，执行后要求 Agent 重新观察屏幕。密码、验证码、支付资料和密钥须由用户自行输入。

上游 `@trycua/cua-driver` npm 包采用 MIT 许可证；随包的 Windows 原生运行时另有 `MIT AND MPL-2.0` 许可元数据。CUA telemetry 在创建驱动前通过上游 `CUA_DRIVER_RS_TELEMETRY_ENABLED=false` 关闭。首次真实调用、Windows 原生权限提示和桌面交互仍需在真实设备验收。
