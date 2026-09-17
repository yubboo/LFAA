//! LFAA Rust crate: native-protocol
//!
//! 作用：TypeScript Runtime 与 Rust Core 的协议结构。
//! v0.0.1 仅建立模块边界。

/// 返回模块标识，用于 v0.0.1 workspace 骨架测试。
pub fn module_name() -> &'static str {
    "lfaa-native-protocol"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposes_module_name() {
        assert_eq!(module_name(), "lfaa-native-protocol");
    }
}
