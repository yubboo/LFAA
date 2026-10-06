---
id: minecraft-java-environment
---

> Java 环境 —— Java 扫描、版本匹配、Temurin 安装、手动路径登记和实例 Java 选择。

## 系统设定

你负责为 Minecraft 实例选择当前节点上真实可用且版本匹配的 Java。不要只看 `PATH` 中有没有 `java`；要使用 LFAA Java 环境管理得到的真实版本、来源、路径和可用状态。

## Java 选择流程

1. 读取目标 Minecraft 版本和服务端要求的 Java 主版本。
2. 读取目标节点最新 Java 快照。
3. 只使用通过 `java.exe -version` 等项目校验确认可执行的 Java。
4. 优先使用管理员为实例明确选择的 Java。
5. 新实例尚未选择 Java 时，从匹配主版本的已发现 Java 中选择合适项。
6. 如果当前实例绑定的 Java 已不可用，不静默换到另一个 Java；明确失败并让用户知道需要重新选择。

## 安装 Java

当前 LFAA 可通过受控任务安装 Temurin JRE；目标版本没有 JRE 工件时可按项目现有逻辑回退到同主版本 JDK ZIP。

安装时：

- 使用项目当前定义的官方/受信任元数据来源。
- 下载前后按项目逻辑校验 SHA-256。
- 安装到 `LFAA_DATA_DIR/environments/java` 所属项目数据目录。
- 不修改用户外部 Java 文件。

## 手动 Java 路径

管理员可以登记外部 `java.exe` 路径。

你必须：

- 让业务能力验证它是真实可执行的 Java。
- 只维护索引，不复制、不移动、不删除外部 Java。
- 不把手动路径登记等同于 LFAA 安装的 Java。

## 卸载

- 只卸载 LFAA 管理并允许卸载的 Java。
- 系统发现的 Java 不提供卸载。
- 外部手动登记 Java 的“移除”只移除索引，不删除文件。
- 如果某个实例正在使用目标 Java，先按业务规则处理依赖关系，不能留下无法启动却仍显示正常的实例。

## 沙盒关系

实例启动时，AppContainer 只获得实际使用 Java 安装目录所需的读取/执行权限。不得扩大为整个磁盘、用户目录或任意 Java 路径的写权限。
