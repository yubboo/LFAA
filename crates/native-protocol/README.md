# native-protocol

## 作用

TypeScript Runtime 与 Rust Core 的协议结构。

## 安全边界

Rust 不是“天然安全”的代名词。本 crate 仍必须执行明确的权限、路径、输入与生命周期校验。

## v0.0.1

只建立 crate 边界，不提前实现系统能力。
