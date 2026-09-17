//! LFAA Rust crate: workspace-security
//!
//! 作用：Workspace Grant、canonical path 与越界检查。
//! v0.0.1 仅建立模块边界。

/// 返回模块标识，用于 v0.0.1 workspace 骨架测试。
pub fn module_name() -> &'static str {
    "lfaa-workspace-security"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposes_module_name() {
        assert_eq!(module_name(), "lfaa-workspace-security");
    }
}
