# LFAA 项目级资源安装规范

## 1. 唯一安装作用域

Skills、Experts、Plugins、Extensions、MCP 配置和同类扩展只能安装到当前项目根：

```text
<project>/.lfaa/
├── skills/
├── experts/
├── plugins/
├── extensions/
├── mcp/
├── manifest.json        # 直接依赖声明
└── lock.json            # 解析版本、哈希、来源和许可证锁定
```

项目移动到其他目录或磁盘时，资源解析结果必须仍然有效。

## 2. 禁止用户级事实源

禁止从以下位置隐式安装、继承或覆盖项目资源：

```text
%USERPROFILE%/.lfaa/
~/.lfaa/
AppData 下的全局 skills/plugins 目录
系统级共享扩展目录
```

用户目录只能保存不属于项目真值的应用偏好、凭据句柄或下载缓存；不得成为项目资源解析结果的隐藏输入。

## 3. 项目根识别

运行时必须从当前工作目录向上寻找明确的 LFAA 项目标记，找到后停止。

不得通过固定盘符、固定用户名或全局最近项目推测项目根。

嵌套项目默认使用最近的项目根，不自动合并父项目资源。

## 4. 解析与执行边界

```text
Project .lfaa resource
↓ metadata/schema validation
Resource Registry
↓ explicit capability declaration
Tool Runtime
↓ Policy → Permission
Rust Broker
↓ OS
```

资源文件位于项目内不代表可信。第三方资源仍按不可信输入处理。

## 5. 安装记录

资源安装器必须记录：

- 类型与唯一 ID；
- 名称、版本和发布者；
- 下载来源；
- 内容哈希；
- 许可证与 NOTICE；
- 请求的 capability；
- 安装时间和更新来源。

没有来源、哈希或许可证信息的远程资源默认拒绝安装。

## 6. Secret 与运行时数据

`.lfaa/` 禁止保存 Secret 明文。

Secret 只保存不可反查的引用，真实值进入 OS Credential Store / Secret Broker。

以下运行时目录仍位于项目内，但不属于可提交事实源：

```text
.lfaa/cache/
.lfaa/state/
.lfaa/tmp/
.lfaa/logs/
```

## 7. 同步与复现

第一方资源可以直接随项目提交。

第三方资源必须同时具有可审查的 manifest/lock/NOTICE；是否提交实体文件由许可证和仓库策略决定，但不得依赖用户级安装才能运行。

项目在全新机器上应能通过项目内锁文件恢复同一资源集合。
