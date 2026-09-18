# #8 用户首次配置 Git origin

## 主模块

`project-foundation`

## 目标

GitHub / Git 一键推送脚本不得写死仓库地址。

首次运行时，如果 `.git/config` 中没有 `origin`：

1. 提示用户输入 Git 仓库地址；
2. 显示并确认；
3. 执行 `git remote add origin <地址>`；
4. 保存到 `.git/config`；
5. 后续运行自动读取，不再次要求输入。

## 原则

`origin` 的唯一事实源：

```text
.git/config
```

不再额外创建 LFAA 自定义 origin 配置文件。

## 支持地址

- HTTPS
- SSH URL
- SCP 风格 SSH
- file://

## 不修改

- config-system 业务；
- Agent Runtime；
- Rust Broker。
