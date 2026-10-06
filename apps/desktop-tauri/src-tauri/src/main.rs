/*
 * 功能：启动 Windows 本机一体版 LFAA 桌面应用。
 * 作用：从安装资源目录启动本机控制端与 Daemon，等待健康检查通过后再用系统 WebView2 打开同源工作台。
 * 关联文件：apps/desktop-tauri/src-tauri/tauri.conf.json、apps/desktop-tauri/src-tauri/capabilities/local-server-ui.json、apps/desktop-tauri/scripts/package-windows.mjs、packages/client/connection/src/api.ts、apps/cli/src/index.ts、scripts/apply-data-directory-migration.mjs。
 */
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::{json, Value};
use std::env;
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::webview::WebviewWindowBuilder;
use tauri::{Manager, RunEvent, WebviewUrl};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use url::Url;

const APP_FOLDER_NAME: &str = "lfaa-desktop-electron";
const HIDDEN_WINDOW_FLAG: u32 = 0x08000000;

#[derive(Default)]
struct LocalServices {
    daemon: Option<Child>,
    server: Option<Child>,
}

fn log_line(log_file: &Arc<Mutex<File>>, source: &str, message: &str) {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    if let Ok(mut file) = log_file.lock() {
        let _ = writeln!(file, "[{timestamp}] [{source}] {message}");
        let _ = file.flush();
    }
}

fn app_data_directory() -> Result<PathBuf, String> {
    if let Some(app_data) = env::var_os("APPDATA") {
        return Ok(PathBuf::from(app_data).join(APP_FOLDER_NAME));
    }
    let user_profile = env::var_os("USERPROFILE")
        .ok_or_else(|| "Windows 未提供 APPDATA 或 USERPROFILE 路径。".to_string())?;
    Ok(PathBuf::from(user_profile)
        .join("AppData")
        .join("Roaming")
        .join(APP_FOLDER_NAME))
}

fn configuration_paths() -> Result<(PathBuf, PathBuf, PathBuf), String> {
    let app_data = app_data_directory()?;
    Ok((
        app_data.join("storage.json"),
        app_data.join(".lfaa-data-directory.pending.json"),
        app_data.join("logs").join("desktop.log"),
    ))
}

fn open_log_file() -> Result<(PathBuf, Arc<Mutex<File>>), String> {
    let (_, _, log_path) = configuration_paths()?;
    let log_directory = log_path
        .parent()
        .ok_or_else(|| "桌面日志路径无效。".to_string())?;
    fs::create_dir_all(log_directory).map_err(|error| format!("无法创建桌面日志目录：{error}"))?;
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|error| format!("无法写入桌面日志：{error}"))?;
    Ok((log_path, Arc::new(Mutex::new(file))))
}

fn read_saved_data_directory(configuration_path: &Path) -> Result<Option<PathBuf>, String> {
    let content = match fs::read_to_string(configuration_path) {
        Ok(content) => content,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("桌面端的数据目录配置无法读取：{error}")),
    };
    let settings: Value = serde_json::from_str(&content)
        .map_err(|error| format!("桌面端的数据目录配置格式错误：{error}"))?;
    Ok(settings
        .get("dataDirectory")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from))
}

fn save_data_directory(configuration_path: &Path, directory: &Path) -> Result<(), String> {
    if let Some(parent) = configuration_path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("无法创建桌面配置目录：{error}"))?;
    }
    let mut settings = match fs::read_to_string(configuration_path) {
        Ok(content) => serde_json::from_str::<Value>(&content)
            .map_err(|error| format!("桌面端的数据目录配置格式错误：{error}"))?,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => json!({}),
        Err(error) => return Err(format!("桌面端的数据目录配置无法读取：{error}")),
    };
    if !settings.is_object() {
        settings = json!({});
    }
    settings["dataDirectory"] = json!(directory.to_string_lossy());
    let temporary_path = configuration_path.with_extension(format!("{}.tmp", std::process::id()));
    let serialized = serde_json::to_vec_pretty(&settings)
        .map_err(|error| format!("无法序列化桌面配置：{error}"))?;
    fs::write(&temporary_path, serialized).map_err(|error| format!("无法写入桌面配置：{error}"))?;
    if let Err(error) = fs::rename(&temporary_path, configuration_path) {
        let _ = fs::remove_file(&temporary_path);
        return Err(format!("无法更新桌面配置：{error}"));
    }
    Ok(())
}

fn writable_data_directory(directory: &Path) -> bool {
    if fs::create_dir_all(directory).is_err() {
        return false;
    }
    let probe_path = directory.join(format!(".lfaa-write-check-{}", std::process::id()));
    match OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&probe_path)
    {
        Ok(_) => fs::remove_file(probe_path).is_ok(),
        Err(_) => false,
    }
}

fn resolve_data_directory(
    runtime_root: &Path,
    configuration_path: &Path,
) -> Result<(PathBuf, bool), String> {
    if let Some(directory) = env::var_os("LFAA_DATA_DIR") {
        let external_directory = directory.to_string_lossy().trim().to_string();
        if !external_directory.is_empty() {
            return Ok((PathBuf::from(external_directory), false));
        }
    }
    if let Some(saved_directory) = read_saved_data_directory(configuration_path)? {
        if !saved_directory.exists() || !writable_data_directory(&saved_directory) {
            return Err(format!(
                "已保存的数据目录不可用或不可写：{}。请连接原磁盘后重启，或修复目录权限。",
                saved_directory.display()
            ));
        }
        return Ok((saved_directory, true));
    }

    let install_directory = env::current_exe()
        .map_err(|error| format!("无法读取 LFAA 安装目录：{error}"))?
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| "LFAA 安装目录无效。".to_string())?;
    let preferred_directory = if cfg!(debug_assertions) {
        runtime_root.join("data")
    } else {
        install_directory.join("data")
    };
    if writable_data_directory(&preferred_directory) {
        let preferred_directory =
            fs::canonicalize(&preferred_directory).unwrap_or(preferred_directory);
        save_data_directory(configuration_path, &preferred_directory)?;
        return Ok((preferred_directory, true));
    }

    let fallback_directory = app_data_directory()?.join("data");
    if writable_data_directory(&fallback_directory) {
        let fallback_directory =
            fs::canonicalize(&fallback_directory).unwrap_or(fallback_directory);
        save_data_directory(configuration_path, &fallback_directory)?;
        return Ok((fallback_directory, true));
    }
    Err("无法在应用安装目录或当前账户的应用数据目录创建可写 LFAA 数据目录。请检查磁盘权限或设置 LFAA_DATA_DIR。".to_string())
}

fn run_pending_data_migration(
    runtime_root: &Path,
    node_path: &Path,
    configuration_path: &Path,
    request_path: &Path,
    log_file: &Arc<Mutex<File>>,
) {
    if !request_path.exists() {
        return;
    }
    if env::var("LFAA_DATA_DIR")
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
    {
        log_line(
            log_file,
            "数据迁移",
            "发现待迁移请求，但系统环境变量 LFAA_DATA_DIR 优先；保留请求并继续使用环境变量目录。",
        );
        return;
    }
    let migration_script = runtime_root
        .join("scripts")
        .join("apply-data-directory-migration.mjs");
    let output = Command::new(node_path)
        .arg(migration_script)
        .arg(runtime_root)
        .arg("--desktop-config")
        .arg(configuration_path)
        .arg("--request")
        .arg(request_path)
        .env("LFAA_DESKTOP_MODE", "true")
        .env("LFAA_DATA_DIRECTORY_MIGRATION_SUPPORTED", "1")
        .output();
    match output {
        Ok(result) => {
            if !result.stdout.is_empty() {
                log_line(
                    log_file,
                    "数据迁移",
                    &String::from_utf8_lossy(&result.stdout),
                );
            }
            if !result.stderr.is_empty() {
                log_line(
                    log_file,
                    "数据迁移 错误",
                    &String::from_utf8_lossy(&result.stderr),
                );
            }
            if !result.status.success() {
                log_line(
                    log_file,
                    "数据迁移",
                    "本次未切换数据目录，应用会继续从原目录启动；可在设置中心处理原因后重试。",
                );
            }
        }
        Err(error) => log_line(
            log_file,
            "数据迁移 错误",
            &format!("无法启动数据迁移程序：{error}"),
        ),
    }
}

fn service_environment(
    port: u16,
    data_directory: &Path,
    managed_by_desktop: bool,
    app_data: &Path,
) -> Vec<(String, String)> {
    vec![
        ("NODE_ENV".to_string(), "production".to_string()),
        ("LFAA_DESKTOP_MODE".to_string(), "true".to_string()),
        ("LFAA_SERVE_FRONTEND".to_string(), "true".to_string()),
        ("JWT_SECRET".to_string(), String::new()),
        (
            "LFAA_DATA_DIR".to_string(),
            data_directory.to_string_lossy().into_owned(),
        ),
        (
            "LFAA_DATA_DIR_MANAGED_BY_DESKTOP".to_string(),
            if managed_by_desktop { "1" } else { "0" }.to_string(),
        ),
        (
            "LFAA_DATA_DIRECTORY_MIGRATION_SUPPORTED".to_string(),
            if managed_by_desktop { "1" } else { "0" }.to_string(),
        ),
        (
            "LFAA_DESKTOP_INSTALL_DIRECTORY".to_string(),
            env::current_exe()
                .ok()
                .and_then(|path| path.parent().map(Path::to_path_buf))
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned(),
        ),
        (
            "LFAA_DESKTOP_DATA_DIRECTORY_CONFIG".to_string(),
            app_data.join("storage.json").to_string_lossy().into_owned(),
        ),
        (
            "LFAA_DATA_DIRECTORY_MIGRATION_REQUEST_PATH".to_string(),
            app_data
                .join(".lfaa-data-directory.pending.json")
                .to_string_lossy()
                .into_owned(),
        ),
        ("SERVER_HOST".to_string(), "localhost".to_string()),
        ("SERVER_PORT".to_string(), port.to_string()),
        ("WEBAUTHN_RP_ID".to_string(), "localhost".to_string()),
        (
            "WEBAUTHN_ORIGIN".to_string(),
            format!("http://localhost:{port}"),
        ),
    ]
}

fn capture_output<R: Read + Send + 'static>(reader: R, log_file: Arc<Mutex<File>>, source: String) {
    thread::spawn(move || {
        for line in BufReader::new(reader).lines() {
            match line {
                Ok(line) => log_line(&log_file, &source, &line),
                Err(_) => break,
            }
        }
    });
}

fn spawn_node(
    node_path: &Path,
    args: &[String],
    runtime_root: &Path,
    environment: &[(String, String)],
    log_file: &Arc<Mutex<File>>,
    source: &str,
) -> Result<Child, String> {
    let mut command = Command::new(node_path);
    command
        .args(args)
        .current_dir(runtime_root)
        .envs(
            environment
                .iter()
                .map(|(key, value)| (key.as_str(), value.as_str())),
        )
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(HIDDEN_WINDOW_FLAG);
    }
    let mut child = command
        .spawn()
        .map_err(|error| format!("无法启动{source}：{error}"))?;
    if let Some(stdout) = child.stdout.take() {
        capture_output(stdout, Arc::clone(log_file), source.to_string());
    }
    if let Some(stderr) = child.stderr.take() {
        capture_output(stderr, Arc::clone(log_file), format!("{source} 错误"));
    }
    Ok(child)
}

fn control_plane_is_ready(port: u16) -> bool {
    let address = format!("localhost:{port}");
    let mut stream = match TcpStream::connect_timeout(
        &address
            .to_socket_addrs()
            .ok()
            .and_then(|mut addresses| addresses.next())
            .unwrap_or_else(|| "127.0.0.1:0".parse().expect("固定回环地址有效")),
        Duration::from_millis(700),
    ) {
        Ok(stream) => stream,
        Err(_) => return false,
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(900)));
    let request =
        format!("GET /api/health HTTP/1.1\r\nHost: {address}\r\nConnection: close\r\n\r\n");
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut response = Vec::new();
    if stream.read_to_end(&mut response).is_err() {
        return false;
    }
    let response = String::from_utf8_lossy(&response);
    let Some((headers, body)) = response.split_once("\r\n\r\n") else {
        return false;
    };
    headers.starts_with("HTTP/1.1 200")
        && serde_json::from_str::<Value>(body)
            .map(|health| health["status"] == "ok" && health["service"] == "lfaa-server")
            .unwrap_or(false)
}

fn wait_for_control_plane(
    child: &mut Child,
    port: u16,
    log_file: &Arc<Mutex<File>>,
) -> Result<(), String> {
    let deadline = SystemTime::now() + Duration::from_secs(45);
    while SystemTime::now() < deadline {
        if let Some(status) = child
            .try_wait()
            .map_err(|error| format!("无法检查本机控制端状态：{error}"))?
        {
            return Err(format!(
                "本机控制端提前退出，代码为 {status}；请查看桌面日志。"
            ));
        }
        if control_plane_is_ready(port) {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(300));
    }
    log_line(log_file, "桌面端 错误", "等待本机控制端健康检查超时。");
    Err("等待本机控制端就绪超时；请查看桌面日志。".to_string())
}

fn start_local_services(
    runtime_root: &Path,
    app_data: &Path,
    configuration_path: &Path,
    request_path: &Path,
    log_file: &Arc<Mutex<File>>,
) -> Result<(LocalServices, u16), String> {
    let node_path = runtime_root.join("node.exe");
    run_pending_data_migration(
        runtime_root,
        &node_path,
        configuration_path,
        request_path,
        log_file,
    );
    let (data_directory, managed_by_desktop) =
        resolve_data_directory(runtime_root, configuration_path)?;
    let listener = TcpListener::bind(("localhost", 0))
        .map_err(|error| format!("无法分配本机服务端口：{error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("无法读取本机服务端口：{error}"))?
        .port();
    drop(listener);

    let environment = service_environment(port, &data_directory, managed_by_desktop, app_data);
    let server_entry = runtime_root.join("dist").join("apps").join("control-plane").join("index.js");
    let server_loader = Url::from_file_path(
        runtime_root
            .join("apps")
            .join("cli")
            .join("register-package-loader.mjs"),
    )
    .map_err(|_| "控制端依赖加载器路径无效。".to_string())?;
    log_line(
        log_file,
        "桌面端",
        &format!("正在启动本机控制端，监听端口 {port}。"),
    );
    let mut server = spawn_node(
        &node_path,
        &[
            "--import".to_string(),
            server_loader.to_string(),
            server_entry.to_string_lossy().into_owned(),
            "--profile".to_string(),
            "desktop".to_string(),
        ],
        runtime_root,
        &environment,
        log_file,
        "控制端",
    )?;
    if let Err(error) = wait_for_control_plane(&mut server, port, log_file) {
        let _ = server.kill();
        let _ = server.wait();
        return Err(error);
    }

    log_line(log_file, "桌面端", "控制端已就绪，正在启动本机 Daemon。");
    let daemon_entry = server_entry.clone();
    let daemon = match spawn_node(
        &node_path,
        &["--import".to_string(), server_loader.to_string(), daemon_entry.to_string_lossy().into_owned(), "--profile".to_string(), "daemon".to_string()],
        runtime_root,
        &environment,
        log_file,
        "本机 Daemon",
    ) {
        Ok(daemon) => daemon,
        Err(error) => {
            let _ = server.kill();
            let _ = server.wait();
            return Err(error);
        }
    };
    log_line(log_file, "桌面端", "本机控制端和 Daemon 已启动。");
    Ok((
        LocalServices {
            daemon: Some(daemon),
            server: Some(server),
        },
        port,
    ))
}

fn stop_services(services: &mut LocalServices, log_file: &Arc<Mutex<File>>) {
    for (service, name) in [
        (&mut services.daemon, "本机 Daemon"),
        (&mut services.server, "本机控制端"),
    ] {
        if let Some(mut child) = service.take() {
            if child.try_wait().ok().flatten().is_none() {
                log_line(log_file, "桌面端", &format!("正在关闭{name}。"));
                let _ = child.kill();
            }
            let _ = child.wait();
        }
    }
}

fn open_workbench(app: &tauri::AppHandle, url: &str) -> Result<(), Box<dyn std::error::Error>> {
    let url = Url::parse(url)?;
    WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
        .title("LFAA 工作台")
        .inner_size(1360.0, 880.0)
        .min_inner_size(960.0, 640.0)
        .center()
        .build()?;
    Ok(())
}

fn show_startup_error(app: &tauri::App, log_path: &Path, message: &str) {
    app.dialog()
        .message(format!("{message}\n\n日志位置：{}", log_path.display()))
        .title("LFAA 启动失败")
        .kind(MessageDialogKind::Error)
        .blocking_show();
}

fn main() {
    let shutdown_started = Arc::new(AtomicBool::new(false));
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let (log_path, log_file) = open_log_file()
                .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
            app.manage(Arc::clone(&log_file));
            log_line(&log_file, "桌面端", "LFAA Tauri 桌面程序开始启动。");

            #[cfg(debug_assertions)]
            let frontend_url = "http://localhost:5173".to_string();

            #[cfg(not(debug_assertions))]
            let frontend_url = {
                let runtime_root = app
                    .path()
                    .resource_dir()
                    .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?
                    .join("app-runtime");
                let (configuration_path, request_path, _) = configuration_paths()
                    .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
                let app_data = app_data_directory()
                    .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
                let (_, _, port) = match start_local_services(
                    &runtime_root,
                    &app_data,
                    &configuration_path,
                    &request_path,
                    &log_file,
                ) {
                    Ok((services, port)) => {
                        app.manage(Mutex::new(services));
                        (configuration_path, request_path, port)
                    }
                    Err(error) => {
                        log_line(&log_file, "桌面端 错误", &error);
                        show_startup_error(app, &log_path, &error);
                        return Err(Box::new(std::io::Error::new(
                            std::io::ErrorKind::Other,
                            error,
                        )));
                    }
                };
                format!("http://localhost:{port}")
            };

            if let Err(error) = open_workbench(app.handle(), &frontend_url) {
                log_line(
                    &log_file,
                    "桌面端 错误",
                    &format!("无法打开工作台：{error}"),
                );
                show_startup_error(app, &log_path, &format!("无法打开 LFAA 工作台：{error}"));
                if let Some(services) = app.try_state::<Mutex<LocalServices>>() {
                    if let Ok(mut services) = services.lock() {
                        stop_services(&mut services, &log_file);
                    }
                }
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    error.to_string(),
                )));
            }
            Ok(())
        });

    let mut app = match builder.build(tauri::generate_context!()) {
        Ok(app) => app,
        Err(error) => {
            eprintln!("LFAA Tauri 桌面程序构建失败：{error}");
            return;
        }
    };
    app.run(move |app_handle, event| {
        if let RunEvent::ExitRequested { api, .. } = event {
            if shutdown_started.swap(true, Ordering::SeqCst) {
                return;
            }
            api.prevent_exit();
            let services = app_handle
                .try_state::<Mutex<LocalServices>>()
                .and_then(|state| {
                    state
                        .lock()
                        .ok()
                        .map(|mut services| std::mem::take(&mut *services))
                });
            let log_file = app_handle
                .try_state::<Arc<Mutex<File>>>()
                .map(|state| state.inner().clone());
            let app_handle = app_handle.clone();
            thread::spawn(move || {
                if let Some(mut services) = services {
                    if let Some(log_file) = log_file {
                        stop_services(&mut services, &log_file);
                    } else {
                        for child in [&mut services.daemon, &mut services.server] {
                            if let Some(mut child) = child.take() {
                                let _ = child.kill();
                                let _ = child.wait();
                            }
                        }
                    }
                }
                app_handle.exit(0);
            });
        }
    });
}
