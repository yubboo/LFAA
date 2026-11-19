---
name: minecraft-plugin-dev
description: 我的世界（Minecraft）服务端插件开发规范与避坑指南（Paper / Spigot / Purpur / Folia 1.20.x–1.21.x），包含 LFAA 工具调用策略、Java/Maven/Gradle 环境定位、Adventure/API 规范、线程安全、持久化与实测验收要求。
---

# 我的世界（Minecraft）服务端插件开发与工具调用规范

当用户要求新建、重构、排查或编译 Minecraft 服务端插件（Bukkit / Spigot / Paper / Purpur / Folia / Velocity）时，必须先按本技能核对环境与架构，再并行落地代码与构建验证。

## 一、LFAA 工具调用与工程效率准则

1. **先核查再动工，严禁凭空编造目录或产物**
   - 先用 `list_dir` 检查当前工作区根目录；若为空目录或未绑定项目，明确告知状态并先确定目标工程路径，不编造“已有结构”。
   - 对既有项目，先并行调用 `read_file` 读取 `pom.xml` / `build.gradle(.kts)`、`plugin.yml` / `paper-plugin.yml` 与入口主类，确认目标 MC 版本与 Java 版本。
2. **并行批处理工具调用，避免耗尽步数**
   - 创建新插件或修改多个互不依赖的文件时，**在同一轮并行发起多个 `write_file` / `edit_file` / `read_file` 调用**（例如同轮写出 `pom.xml`、`plugin.yml`、`config.yml`、`messages.yml` 与各业务类），禁止每个文件单独占用一轮对话。
3. **一次探测本机工具链，严格区分终端语法**
   - 构建前用一条只读 `run_command` 探测环境：`java -version`、`mvn -v`、`gradle -v`。
   - Windows 下若 `java` 或 `mvn` 不在 `PATH`：
     - 优先检查项目自带 wrapper（`.\mvnw.cmd` / `.\gradlew.bat`）；
     - 否则探测常见安装位：`C:\Program Files\Java\*`（注意下级 `jdk-21` 等子目录才是有效 `JAVA_HOME`）以及 `%USERPROFILE%\.m2\wrapper\dists\apache-maven-*\*\bin\mvn.cmd`。
   - **严格匹配当前 Shell 语法**：PowerShell 使用 `$env:JAVA_HOME="..."` 和 `& "..."`；Windows CMD 使用 `set "JAVA_HOME=..."` 与双引号路径。给用户复现命令时**严禁混用 PowerShell 与 CMD 语法**，也不得用 `&` 串联命令后依赖 `%ERRORLEVEL%`（CMD 会提前展开）。
4. **必须实跑构建并核验产物，禁止把“静态自审”说成可用**
   - 写完代码后直接运行 `mvn clean package`（推荐带 `-B` 批处理参数）或 `./gradlew build`，直接读取标准输出/错误，不要无故重定向吞掉错误信息。
   - 若本机有测试框架，同步运行 `mvn test` / `./gradlew test`。
   - 构建成功后核验 JAR 内容（例如 `jar tf target/<plugin>.jar`），确认包含 `plugin.yml`、配置资源与编译 `.class`，且**未误打入 `org.bukkit` / `io.papermc` 类**。
   - 未实际编译或未在真实服务端跑通的逻辑，必须在最终汇报中明确标注“未编译 / 未上服实测”。

---

## 二、版本、JDK 与构建配置注意事项

1. **Java 与服务端版本对齐**
   - MC `1.20.5+` / `1.21.x`（Paper / Spigot）：强制 **Java 21**（Maven 配置 `<maven.compiler.release>21</maven.compiler.release>`）。
   - MC `1.18–1.20.4`：使用 **Java 17**。
2. **依赖仓库与 `provided` 作用域**
   - PaperMC 官方仓库：`https://repo.papermc.io/repository/maven-public/`。
   - `io.papermc.paper:paper-api:<mc-version>-R0.1-SNAPSHOT`（或 `spigot-api`）**必须声明 `<scope>provided</scope>`**，避免打包进插件 JAR 导致服务端 `LinkageError` / 类冲突。
   - 引入第三方依赖（SQLite、HikariCP、Gson 新版、Configurate 等）时，使用 `maven-shade-plugin` 或 Gradle `ShadowJar` 并将包路径 `<relocation>` 到插件私有命名空间下，防止与其他插件冲突。
3. **`plugin.yml` / `paper-plugin.yml` 关键项**
   - `api-version: '1.21'` 务必加单引号作为字符串，防止 YAML 解析为浮点数或截断小数。
   - 完整声明 `name`、`version`、`main`（全限定主类名）、`commands`（含 `usage` / `permission`）、`permissions`（含 `default: op` / `true`）及 `softdepend`（如 `[Vault, PlaceholderAPI]`）。

---

## 三、Java 编译陷阱与 Paper 1.21 API 规范

1. **规避 `Comparator.comparingXxx(...).reversed()` 泛型推断失败**
   - 错误写法：`Comparator.comparingInt(PlayerData::streak).reversed()` 直接作为 `thenComparing(...)` 或链式接收者参数时，会打断多态赋值上下文导致类型变量 `T` 退化为 `Object` 而编译报错。
   - 正确写法：先赋给具名变量再反转，或使用显式类型见证：
     ```java
     final Comparator<PlayerData> byStreak = Comparator.comparingInt(PlayerData::streak);
     final Comparator<PlayerData> byTotal = Comparator.comparingLong(PlayerData::total);
     list.sort(byStreak.reversed().thenComparing(byTotal.reversed()));
     ```
2. **避免已废弃的 `org.bukkit.ChatColor`**
   - Paper 1.21 已标记 `org.bukkit.ChatColor` 为废弃 API，编译会产生 `-Xlint:deprecation` 告警。
   - Paper 插件优先使用 Kyori Adventure（`Component`、`NamedTextColor`、`MiniMessage` 或 `LegacyComponentSerializer.legacyAmpersand()`）；若需同时兼容 Spigot 控制台/旧接口且不引入额外依赖，避免直接 import 废弃的 `org.bukkit.ChatColor`。
3. **集合 `subList` 视图陷阱**
   - `list.subList(0, n)` 返回的是底层列表的视图，长期持有或并发修改会触发 `ConcurrentModificationException` 并阻塞 GC。返回前务必包一层 `new ArrayList<>(list.subList(...))`。
4. **命令与 Tab 补全健壮性**
   - 获取 `getCommand("...")` 后必须判空再绑定 `Executor` 与 `TabCompleter`。
   - `onTabComplete` 应按当前输入参数前缀过滤候选（`StringUtil.copyPartialMatches`），且只返回发送者有权限执行的子命令。

---

## 四、线程安全、时间边界与数据持久化

1. **主线程与异步边界（兼容 Paper 与 Folia）**
   - **严禁在异步线程直接读写世界方块、实体、玩家背包或触发非线程安全事件**。
   - 文件 I/O、HTTP 请求、数据库查询放异步线程；回调修改玩家状态或发放物品时必须切回主线程（Bukkit `runTask`，或面向 Folia 时使用 `player.getScheduler()` / `GlobalRegionScheduler`）。
2. **跨日 / 周期时间计算与单元测试**
   - 签到、每日限次、冷却重置必须使用 `java.time`（`ZonedDateTime` / `LocalDate` / `toEpochDay()`），例如按可配置 `resetHour` 做 `now.minusHours(resetHour).toLocalDate().toEpochDay()`，**禁止用本地日期字符串拼接比较**。
   - **优先为时间计算与连签边界类补充 JUnit 单元测试**，实测跨日（如 03:59 vs 04:00）、跨月、跨年、闰年与时区行为。
3. **持久化防丢与软依赖安全**
   - 仅靠内存缓存 + 长周期定时保存，在服务端意外崩溃或强杀时会丢最近数据。关键写入（签到成功、资产变更）应在业务提交后及时异步落盘，并在 `onDisable()` 同步刷盘；中大型服优先提供 SQLite / MySQL（HikariCP）存储并确保 `onDisable()` 关闭数据源。
   - 对接 Vault / PlaceholderAPI 时，先通过 `Bukkit.getPluginManager().isPluginEnabled("Vault")` 检查，并将桥接代码隔离在独立 Hook 类中（延迟加载或反射），确保未装前置插件时零崩溃启动，并在缺少前置时打印清晰一次性警告。
