// 功能：连接 Tauri 配置与 Windows 桌面程序构建。
// 作用：在 Cargo 编译期间加载 tauri.conf.json，生成运行时所需的应用资源与权限元数据。
// 关联文件：apps/desktop-tauri/src-tauri/tauri.conf.json、apps/desktop-tauri/src-tauri/src/main.rs。
fn main() {
    // Tauri 上游固定写 gen/schemas，先把此目录接到根 dist，避免产生包内构建输出。
    let source = std::path::PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    // 不传 Windows canonicalize 产生的 \\?\ 前缀，Node 对驱动器根路径的解析不接受该形式。
    let root = source.join("../../..");
    let mut command = std::process::Command::new("node");
    command.arg(root.join("scripts/configure-tauri-output.mjs"));
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let status = command.status().expect("无法配置 Tauri 根 dist 生成目录");
    assert!(status.success(), "Tauri 生成目录配置失败");
    tauri_build::build()
}
