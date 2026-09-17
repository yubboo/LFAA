//! LFAA Rust crate: secret-store
//!
//! 作用：OS Credential Store / Keychain Secret Broker。
//! v0.0.1 仅建立模块边界。

/// 返回模块标识，用于 v0.0.1 workspace 骨架测试。
pub fn module_name() -> &'static str {
    "lfaa-secret-store"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposes_module_name() {
        assert_eq!(module_name(), "lfaa-secret-store");
    }
}
