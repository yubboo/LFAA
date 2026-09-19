# crates：Rust 原生系统能力

> `crates/` 放必须靠原生层访问 OS 的能力。React / Model / Plugin 不允许直接绕过权限链调用这里。

```text
native-core          原生能力总入口
native-protocol      TS/Rust 协议
fs-broker            文件系统
process-broker       进程
pty-broker           Terminal / PTY
sandbox              隔离
secret-store         Rust Secret Broker / OS Credential Store（Windows Generic Credential）
workspace-security   路径和项目安全
file-watcher         文件监听
```

完整执行链：

```text
Tool Runtime → Policy → Permission → Rust Broker → OS
```

详细说明：`ARCHITECTURE.md` 和 `docs/项目结构与代码地图.md`。
