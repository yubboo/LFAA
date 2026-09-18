# LFAA 项目级资源安装规范

## 1. 唯一安装作用域

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

## 2. 禁止用户级事实源

禁止从 `%USERPROFILE%/.lfaa/`、`~/.lfaa/` 或系统级共享扩展目录隐式安装、继承或覆盖项目资源。

## 3. 项目根识别

从当前工作目录向上寻找明确项目标记；不得依赖固定盘符或用户名。

## 4. 执行边界

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

## 5. Secret

`.lfaa/` 禁止保存 Secret 明文，只保存 `credential_ref`。

## 6. 运行时目录

```text
.lfaa/cache/
.lfaa/state/
.lfaa/tmp/
.lfaa/logs/
```

属于项目本机运行数据，不属于可提交事实源。
