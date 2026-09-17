//! LFAA Rust crate: fs-broker
//!
//! 作用：文件系统受控读取、写入、路径规范化。
//! v0.0.1 仅建立模块边界。

/// 返回模块标识，用于 v0.0.1 workspace 骨架测试。
pub fn module_name() -> &'static str {
    "lfaa-fs-broker"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposes_module_name() {
        assert_eq!(module_name(), "lfaa-fs-broker");
    }
}
