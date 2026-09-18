# LFAA-v0.0.28 Release

## 状态

`delivered`

## 任务

- #19.5 Rust 工具链分层
- #21.4 Web 端口复用

## 关键变化

- `rust-toolchain.toml` 锁定 Rust 1.98.1；
- Rust toolchain 共享安装，不复制到每个项目；
- Cargo/Rustup Home 可放非系统盘；
- Web 5173 冲突自动复用/换端口。
