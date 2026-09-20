# native — Frozen Rust Native Kernel

`native/` 只承载 TypeScript 不适合承担的 OS / Security / Native primitive。

当前只有 `secret-store/`。普通产品、Agent、Provider、Workspace、Plugin 业务不得复制到 Rust。新增 crate 必须有真实 native 必要性和当前 Consumer。
