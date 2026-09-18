# LFAA 项目级资源根

此目录只属于当前项目，不属于当前操作系统用户。

Skills、Experts、Plugins、Extensions、MCP 等资源必须从这里解析，不得隐式读取用户级全局安装。

完整规则见 `docs/standards/PROJECT_RESOURCES.md`。

Secret 明文禁止进入本目录。

- `manifest.json`：项目直接资源声明；
- `lock.json`：解析后的版本、来源、哈希和许可证锁定；
- 当前空清单表示尚未声明外部项目资源。
