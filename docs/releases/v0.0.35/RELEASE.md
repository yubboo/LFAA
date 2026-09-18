# LFAA-v0.0.35 Release

## 状态

```text
delivered
```

## 任务

```text
#19.10 Rustup Windows Target 缺失修复
```

## 主要变化

- 恢复 `Get-WindowsRustupTarget`；
- x64 Windows 使用 `x86_64-pc-windows-msvc`；
- ARM64 Windows 使用 `aarch64-pc-windows-msvc`；
- 32 位 x86 Windows 使用 `i686-pc-windows-msvc`；
- 未知架构不猜测，直接中文失败；
- 官方 SHA-256 校验保持。

## 实机验证重点

```text
LFAA-Setup.bat
→ 1 一键依赖
```

新机器 Rust 未安装时，应先显示：

```text
【检测】【Rust 平台】 <target tuple>
```

然后进入 Rust 官方安装器下载与 SHA-256 校验。
