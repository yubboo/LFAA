# LFAA 项目级资源与热插拔规范

## 1. 唯一项目资源根

LFAA 项目资源只允许位于：

```text
<project>/.lfaa/
├── skills/
├── experts/
├── plugins/
├── extensions/
├── mcp/
├── manifest.json
└── lock.json
```

禁止同时使用：

```text
<project>/skills/
<project>/plugins/
```

作为 LFAA 项目资源目录。

这样可以避免用户项目自身已经存在同名目录时发生冲突，也避免出现多个事实源。

## 2. `.lfaa` 的含义

`.lfaa` 是 LFAA 在项目中的专属 namespace，类似 `.git`、`.vscode`。

点号本身不会阻止程序访问：

- Windows：点号目录不是天然不可访问；
- Electron / Node.js：可以通过普通文件 API 读取和监听；
- Rust：可以通过普通 Path/File Watcher 读取和监听；
- macOS/Linux：默认文件管理器可能不展示点号目录，但程序访问不受影响。

Desktop UI 必须提供“打开项目资源目录”和资源管理界面，因此普通用户不需要依赖文件管理器显示隐藏文件。

## 3. 热插拔目录

后续 Resource Registry / File Watcher 必须显式监听：

```text
.lfaa/skills/
.lfaa/experts/
.lfaa/plugins/
.lfaa/extensions/
.lfaa/mcp/
```

文件变化处理流程：

```text
filesystem event
→ debounce
→ rescan changed resource
→ schema / manifest validation
→ source / version / hash / license validation
→ capability validation
→ build new registry generation
→ atomic publish
```

## 4. 运行中任务的一致性

热插拔不能直接修改正在执行中的资源对象。

规则：

- 新资源或新版本生成新的 registry generation；
- 新 Run 使用最新 generation；
- 已经开始的 Run 保持原 generation 引用直到结束；
- 删除资源只阻止新 Run 获取它；
- 正在执行的实例必须安全完成或按运行时取消协议退出。

这样可以避免用户替换 Plugin/Skill 时破坏正在运行的 Agent。

## 5. manifest / lock

```text
manifest.json
→ 项目声明希望使用哪些资源

lock.json
→ 实际解析到的来源、版本、哈希、许可证
```

资源安装和更新必须原子化，不能写到一半就被 Registry 加载。

## 6. 本机运行数据

```text
.lfaa/cache/
.lfaa/state/
.lfaa/tmp/
.lfaa/logs/
```

属于本机运行数据，不作为项目资源事实源，不进入正式发布包中的运行时内容。

## 7. Secret

Secret 明文禁止进入 `.lfaa/`。

只允许保存：

```text
credential_ref
```

真实 Secret 由 OS Credential Store / Rust Secret Broker 持有。
