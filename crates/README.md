# crates

Rust 是 LFAA 的 **Frozen Native Kernel**，不是第二套业务层。

当前 Cargo workspace 只保留 `lfaa-secret-store`：Windows 使用 Credential Manager 保存 Secret，并通过受控 stdin/stdout Broker 提供给宿主。其它 Native primitive（Process / PTY / Sandbox / OS）只有在 TypeScript/现有宿主无法安全表达且存在真实 Consumer 时才新增。

禁止为了“以后可能需要”创建空壳 crate；禁止让 Rust 认识 OpenAI、DeepSeek、Codex、Minecraft、Workbench 等厂商或产品场景业务名。
