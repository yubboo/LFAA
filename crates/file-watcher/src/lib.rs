//! LFAA Rust crate: file-watcher
//!
//! 作用：工作区文件变化监听。
//! v0.0.1 仅建立模块边界。

/// 返回模块标识，用于 v0.0.1 workspace 骨架测试。
pub fn module_name() -> &'static str {
    "lfaa-file-watcher"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposes_module_name() {
        assert_eq!(module_name(), "lfaa-file-watcher");
    }
}
