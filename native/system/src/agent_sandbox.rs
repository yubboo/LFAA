use super::*;
use std::collections::{HashMap, HashSet};
use std::ffi::c_void;
use std::fs::OpenOptions;
use std::os::windows::ffi::OsStringExt;
use std::os::windows::fs::OpenOptionsExt;
use std::time::{Duration, Instant};
use windows_sys::Win32::Security::Authorization::{
    ConvertSidToStringSidW, GetExplicitEntriesFromAclW,
};
use windows_sys::Win32::Security::Isolation::GetAppContainerFolderPath;
use windows_sys::Win32::System::Com::CoTaskMemFree;

const JOURNAL_MAGIC_V1: &str = "LFAA-AGENT-SANDBOX-1";
const JOURNAL_MAGIC_V2: &str = "LFAA-AGENT-SANDBOX-2";
const JOURNAL_MAGIC: &str = "LFAA-AGENT-SANDBOX-3";
const AGENT_READY_PREFIX: &str = "\u{1e}LFAA_AGENT_SANDBOX_READY:";
const AGENT_RESULT_PREFIX: &str = "\u{1e}LFAA_AGENT_SANDBOX_RESULT:";
const MAX_ACL_PATHS: usize = 100_000;
const AGENT_MEMORY_LIMIT_MB: usize = 8192;
const AGENT_PROCESS_LIMIT: u32 = 128;
const AGENT_PATH_EXTENSIONS: &str = ".COM;.EXE;.BAT;.CMD";
const AGENT_READ_ACCESS: u32 = FILE_GENERIC_READ | FILE_GENERIC_EXECUTE;
const AGENT_WRITE_ACCESS: u32 = FILE_GENERIC_READ | FILE_GENERIC_WRITE | FILE_DELETE_CHILD;

struct AgentRunArgs {
    workspace_root: PathBuf,
    working_directory: PathBuf,
    state_root: PathBuf,
    cancel_file: PathBuf,
    mode: String,
    run_token: String,
    runtime_roots: Vec<PathBuf>,
    argv: Vec<OsString>,
}

#[derive(Clone)]
struct AclTarget {
    path: PathBuf,
    access: u32,
    inheritance: u32,
}

struct AclJournalTarget {
    path: PathBuf,
    propagate: bool,
}

pub(super) fn run(args: impl Iterator<Item = OsString>) -> Result<(), String> {
    let args = parse(args)?;
    let workspace_root = canonical_directory(&args.workspace_root, "工作区")?;
    let working_directory = canonical_directory(&args.working_directory, "命令工作目录")?;
    if !path_is_within_case_insensitive(&working_directory, &workspace_root) {
        return Err("Agent Shell 工作目录超出当前工作区。".to_owned());
    }
    let state_root = canonical_directory(&args.state_root, "沙箱控制目录")?;
    if paths_overlap(&workspace_root, &state_root) {
        return Err("Agent 工作区与沙箱控制目录不能重叠。".to_owned());
    }
    if args.cancel_file.parent() != Some(args.state_root.as_path())
        || !args.cancel_file.file_name().is_some_and(|name| {
            name.to_string_lossy() == format!("cancel-{}.request", args.run_token)
        })
    {
        return Err("Agent 沙箱取消通道路径无效。".to_owned());
    }
    if args.argv.is_empty() || args.argv.iter().any(|arg| arg.is_empty()) {
        return Err("Agent 沙箱命令参数为空。".to_owned());
    }

    reap_stale_journals(&state_root)?;
    let mut targets = HashMap::<String, AclTarget>::new();
    let mut scanned_paths = 0usize;
    let workspace_access = if args.mode == "read-only" {
        AGENT_READ_ACCESS
    } else {
        AGENT_WRITE_ACCESS
    };
    collect_tree(
        &workspace_root,
        &workspace_root,
        &mut HashSet::new(),
        &mut scanned_paths,
    )?;
    record_acl_target(
        &mut targets,
        &workspace_root,
        workspace_access,
        DIRECTORY_INHERITANCE,
    );
    collect_path_ancestors_for_traversal(&workspace_root, &mut targets)?;
    let system_root = std::env::var_os("SystemRoot")
        .or_else(|| std::env::var_os("WINDIR"))
        .ok_or_else(|| "Windows 系统目录未配置。".to_owned())?;
    let system_root = canonical_directory(Path::new(&system_root), "Windows 系统")?;
    for root in &args.runtime_roots {
        let root = canonical_directory(root, "运行时目录")?;
        if paths_overlap(&root, &state_root) {
            return Err("沙箱运行时目录不能包含或位于沙箱控制目录中。".to_owned());
        }
        if path_is_within_case_insensitive(&system_root, &root)
            && !paths_equal_case_insensitive(&system_root, &root)
        {
            return Err("沙箱运行时目录不能覆盖 Windows 系统目录。".to_owned());
        }
        // Windows 已为普通 AppContainer 提供只读系统文件访问；不尝试改写受保护系统目录 ACL。
        if path_is_within_case_insensitive(&root, &system_root) {
            continue;
        }
        let volume_root = root
            .ancestors()
            .last()
            .ok_or_else(|| "沙盒运行时路径缺少卷根目录。".to_owned())?;
        let volume_root =
            fs::canonicalize(volume_root).map_err(|_| "运行时卷根路径无法规范化。".to_owned())?;
        let volume_metadata = fs::symlink_metadata(&volume_root)
            .map_err(|_| "运行时卷根路径无法检查。".to_owned())?;
        if !volume_metadata.is_dir() || is_reparse_point(&volume_metadata) {
            return Err("运行时卷根不能是重解析点或非目录路径。".to_owned());
        }
        if !path_is_within_case_insensitive(&root, &volume_root) {
            return Err("运行时卷根与已验证的运行时目录不一致。".to_owned());
        }
        if paths_equal_case_insensitive(&root, &volume_root) {
            return Err("沙盒运行时目录不能覆盖整个卷。".to_owned());
        }
        record_acl_target(
            &mut targets,
            &volume_root,
            APP_CONTAINER_DIRECTORY_TRAVERSE,
            0,
        );
        if !path_is_within_case_insensitive(&root, &workspace_root) {
            collect_tree(&root, &root, &mut HashSet::new(), &mut scanned_paths)?;
            record_acl_target(
                &mut targets,
                &root,
                AGENT_READ_ACCESS,
                DIRECTORY_INHERITANCE,
            );
        }
    }
    let targets = targets.into_values().collect::<Vec<_>>();
    if targets.is_empty() || targets.len() > MAX_ACL_PATHS {
        return Err("沙箱文件权限目标数量无效或超过 100000 项安全上限。".to_owned());
    }

    let profile_name = format!("LFAA.Agent.{}", args.run_token);
    let journal_path = state_root.join(format!("agent-{}.journal", args.run_token));
    let app_data_root = expected_app_container_data_root(&profile_name)?;
    let journal_file = write_journal(
        &journal_path,
        &profile_name,
        &app_data_root,
        &args.cancel_file,
        &targets,
    )?;
    let sid = match create_agent_profile(&profile_name) {
        Ok(sid) => sid,
        Err(error) => {
            remove_journal(&journal_path, journal_file, &args.cancel_file)?;
            return Err(error);
        }
    };
    let profile_setup = app_container_data_root(sid.0, &profile_name).and_then(|actual| {
        if !paths_equal_case_insensitive(&actual, &app_data_root) {
            return Err("Windows AppContainer 本地数据路径与回收记录不一致。".to_owned());
        }
        prepare_app_container_data(&app_data_root)
    });
    let mut setup_error = profile_setup.err();
    if setup_error.is_none() {
        for target in &targets {
            let result = if target.inheritance == 0 {
                grant_access_non_propagating(&target.path, sid.0, target.access)
            } else {
                grant_access(&target.path, sid.0, target.access, target.inheritance)
            };
            if let Err(error) = result {
                setup_error = Some(error);
                break;
            }
        }
    }

    let execution = if let Some(error) = setup_error {
        Err(error)
    } else {
        run_confined_process(
            &args,
            &workspace_root,
            &working_directory,
            &app_data_root,
            sid.0,
        )
    };
    let cleanup = cleanup_run(
        &journal_path,
        journal_file,
        &profile_name,
        &app_data_root,
        sid.0,
        &targets,
        &args.cancel_file,
    );

    match (execution, cleanup) {
        (Ok(exit_code), Ok(())) => write_result_message(&args.run_token, &args.mode, exit_code),
        (Err(error), Ok(())) => Err(error),
        (Ok(_), Err(error)) => Err(format!(
            "Agent 命令已退出，但沙箱 ACL/Profile 清理失败：{error}"
        )),
        (Err(run_error), Err(cleanup_error)) => {
            Err(format!("{run_error}；沙箱清理失败：{cleanup_error}"))
        }
    }
}

fn parse(args: impl Iterator<Item = OsString>) -> Result<AgentRunArgs, String> {
    let mut values = HashMap::<String, OsString>::new();
    let mut runtime_roots = Vec::new();
    let mut args = args;
    loop {
        let Some(key) = args.next() else {
            return Err("Agent 沙箱命令缺少 -- 与目标 argv。".to_owned());
        };
        if key == OsStr::new("--") {
            break;
        }
        let key = key.into_string().map_err(|_| "Agent 沙箱参数无效。")?;
        let value = args
            .next()
            .ok_or_else(|| "Agent 沙箱参数缺少值。".to_owned())?;
        if key == "--runtime-root" {
            runtime_roots.push(PathBuf::from(value));
        } else if matches!(
            key.as_str(),
            "--workspace-root"
                | "--working-directory"
                | "--state-root"
                | "--cancel-file"
                | "--mode"
                | "--run-token"
        ) {
            if values.insert(key, value).is_some() {
                return Err("Agent 沙箱参数重复。".to_owned());
            }
        } else {
            return Err("Agent 沙箱参数不受支持。".to_owned());
        }
    }
    let argv = args.collect::<Vec<_>>();
    let workspace_root = required_path(&mut values, "--workspace-root")?;
    let working_directory = required_path(&mut values, "--working-directory")?;
    let state_root = required_path(&mut values, "--state-root")?;
    let cancel_file = required_path(&mut values, "--cancel-file")?;
    let mode = values
        .remove("--mode")
        .and_then(|value| value.into_string().ok())
        .filter(|value| value == "read-only" || value == "workspace-write")
        .ok_or_else(|| "Windows Agent 沙箱只接受 read-only 或 workspace-write。".to_owned())?;
    let run_token = values
        .remove("--run-token")
        .and_then(|value| value.into_string().ok())
        .filter(|value| is_uuid(value))
        .ok_or_else(|| "Agent 沙箱运行令牌无效。".to_owned())?;
    if !values.is_empty() || argv.is_empty() {
        return Err("Agent 沙箱参数或目标 argv 不完整。".to_owned());
    }
    if [
        workspace_root.as_path(),
        working_directory.as_path(),
        state_root.as_path(),
        cancel_file.as_path(),
    ]
    .iter()
    .any(|path| !path.is_absolute())
        || runtime_roots.iter().any(|path| !path.is_absolute())
    {
        return Err("Agent 沙箱路径必须是绝对路径。".to_owned());
    }
    Ok(AgentRunArgs {
        workspace_root,
        working_directory,
        state_root,
        cancel_file,
        mode,
        run_token,
        runtime_roots,
        argv,
    })
}

fn required_path(values: &mut HashMap<String, OsString>, key: &str) -> Result<PathBuf, String> {
    values
        .remove(key)
        .map(PathBuf::from)
        .ok_or_else(|| format!("缺少 Agent 沙箱路径参数 {key}。"))
}

fn canonical_directory(path: &Path, label: &str) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err(format!("{label}路径必须是绝对路径。"));
    }
    reject_reparse_ancestors(path, label)?;
    let canonical = fs::canonicalize(path).map_err(|_| format!("{label}目录无法验证。"))?;
    if !canonical.is_dir() {
        return Err(format!("{label}路径不是目录。"));
    }
    Ok(canonical)
}

fn reject_reparse_ancestors(path: &Path, label: &str) -> Result<(), String> {
    let mut cursor = PathBuf::new();
    for component in path.components() {
        cursor.push(component.as_os_str());
        let metadata =
            fs::symlink_metadata(&cursor).map_err(|_| format!("{label}路径无法逐级检查。"))?;
        if is_reparse_point(&metadata) {
            return Err(format!("{label}路径包含 Windows 重解析点。"));
        }
    }
    Ok(())
}

fn paths_overlap(left: &Path, right: &Path) -> bool {
    path_is_within_case_insensitive(left, right) || path_is_within_case_insensitive(right, left)
}

fn collect_path_ancestors_for_traversal(
    root: &Path,
    targets: &mut HashMap<String, AclTarget>,
) -> Result<(), String> {
    let volume_root = root
        .ancestors()
        .last()
        .ok_or_else(|| "Agent 工作区路径缺少卷根目录。".to_owned())?;
    let mut reached_volume_root = false;
    for ancestor in root.ancestors().skip(1) {
        if targets.len() >= MAX_ACL_PATHS {
            return Err("沙箱目录超过 100000 项权限准备上限。".to_owned());
        }
        let canonical =
            fs::canonicalize(ancestor).map_err(|_| "Agent 工作区父路径无法规范化。".to_owned())?;
        if !paths_equal_case_insensitive(&canonical, ancestor) {
            return Err("Agent 工作区父路径规范化不一致。".to_owned());
        }
        let metadata = fs::symlink_metadata(&canonical)
            .map_err(|_| "Agent 工作区父路径无法检查。".to_owned())?;
        if !metadata.is_dir() || is_reparse_point(&metadata) {
            return Err("Agent 工作区父路径不是普通目录。".to_owned());
        }
        record_acl_target(targets, &canonical, APP_CONTAINER_DIRECTORY_TRAVERSE, 0);
        if paths_equal_case_insensitive(ancestor, volume_root) {
            reached_volume_root = true;
            break;
        }
    }
    if !reached_volume_root {
        return Err("Agent 工作区父路径无法收敛到卷根目录。".to_owned());
    }
    Ok(())
}

fn collect_tree(
    path: &Path,
    allowed_root: &Path,
    visited: &mut HashSet<String>,
    scanned_paths: &mut usize,
) -> Result<(), String> {
    let canonical = fs::canonicalize(path).map_err(|_| "沙箱路径无法规范化。".to_owned())?;
    if !path_is_within_case_insensitive(&canonical, allowed_root) {
        return Err("沙箱工作区或运行时链接指向允许目录之外。".to_owned());
    }
    let key = canonical.to_string_lossy().to_lowercase();
    if !visited.insert(key.clone()) {
        return Ok(());
    }
    *scanned_paths = scanned_paths.saturating_add(1);
    if *scanned_paths > MAX_ACL_PATHS {
        return Err("沙箱目录超过 100000 项权限准备上限。".to_owned());
    }
    let metadata = fs::symlink_metadata(&canonical).map_err(|_| "沙箱路径无法检查。".to_owned())?;
    if metadata.is_dir() {
        for entry in fs::read_dir(&canonical).map_err(|_| "沙箱目录无法读取。".to_owned())?
        {
            let entry = entry.map_err(|_| "沙箱目录项无法读取。".to_owned())?;
            let candidate = entry.path();
            let candidate_meta =
                fs::symlink_metadata(&candidate).map_err(|_| "沙箱目录项无法检查。".to_owned())?;
            if is_reparse_point(&candidate_meta) {
                let target = fs::canonicalize(&candidate)
                    .map_err(|_| "沙箱链接目标无法检查。".to_owned())?;
                if !path_is_within_case_insensitive(&target, allowed_root) {
                    return Err("沙箱目录包含指向允许范围之外的链接。".to_owned());
                }
                collect_tree(&target, allowed_root, visited, scanned_paths)?;
            } else if candidate_meta.is_dir() || candidate_meta.is_file() {
                collect_tree(&candidate, allowed_root, visited, scanned_paths)?;
            } else {
                return Err("沙箱目录含不支持的文件对象。".to_owned());
            }
        }
    } else if !metadata.is_file() {
        return Err("沙箱目录含不支持的文件对象。".to_owned());
    }
    Ok(())
}

fn record_acl_target(
    targets: &mut HashMap<String, AclTarget>,
    path: &Path,
    access: u32,
    inheritance: u32,
) {
    let key = path.to_string_lossy().to_lowercase();
    targets.entry(key).or_insert_with(|| AclTarget {
        path: path.to_path_buf(),
        access,
        inheritance,
    });
}

fn create_agent_profile(profile_name: &str) -> Result<LocalAllocation, String> {
    let name = wide(profile_name);
    let display = wide("LFAA Agent 单次执行");
    let description = wide("LFAA Agent 无网络工作区隔离");
    let mut sid = null_mut();
    let result = unsafe {
        CreateAppContainerProfile(
            name.as_ptr(),
            display.as_ptr(),
            description.as_ptr(),
            null(),
            0,
            &mut sid,
        )
    };
    if result >= 0 && !sid.is_null() {
        return Ok(LocalAllocation(sid));
    }
    Err(format!(
        "无法建立唯一 Agent AppContainer（HRESULT 0x{:08X}）。",
        result as u32
    ))
}

fn write_journal(
    path: &Path,
    profile: &str,
    app_data_root: &Path,
    cancel_file: &Path,
    targets: &[AclTarget],
) -> Result<File, String> {
    let app_data_path = app_data_root
        .to_str()
        .ok_or_else(|| "Agent AppContainer 本地数据路径无法安全编码为 UTF-8。".to_owned())?;
    let cancel_path = cancel_file
        .to_str()
        .ok_or_else(|| "沙箱取消路径无法安全编码为 UTF-8。".to_owned())?;
    let target_records = targets
        .iter()
        .map(|target| {
            let path_text = target
                .path
                .to_str()
                .ok_or_else(|| "沙箱路径无法安全编码为 UTF-8。".to_owned())?;
            if path_text.contains(['\r', '\n']) {
                return Err("沙箱路径包含不支持的换行符。".to_owned());
            }
            let propagation = if target.inheritance == 0 { "N" } else { "P" };
            Ok(format!("{propagation}\t{path_text}"))
        })
        .collect::<Result<Vec<_>, String>>()?;
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .share_mode(0)
        .open(path)
        .map_err(|_| "无法独占创建 Agent 沙箱 ACL 回收记录。".to_owned())?;
    let write_result = (|| {
        writeln!(
            file,
            "{JOURNAL_MAGIC}\n{profile}\n{app_data_path}\n{cancel_path}"
        )
        .map_err(|_| "无法写入 Agent 沙箱 ACL 回收记录。".to_owned())?;
        for target_record in target_records {
            writeln!(file, "{target_record}")
                .map_err(|_| "无法写入 Agent 沙箱 ACL 回收记录。".to_owned())?;
        }
        file.sync_all()
            .map_err(|_| "无法持久化 Agent 沙箱 ACL 回收记录。".to_owned())
    })();
    if let Err(error) = write_result {
        drop(file);
        let _ = fs::remove_file(path);
        return Err(error);
    }
    Ok(file)
}

fn read_journal(
    file: &mut File,
    state_root: &Path,
    journal_path: &Path,
) -> Result<(String, Option<PathBuf>, PathBuf, Vec<AclJournalTarget>), String> {
    use std::io::Seek;
    file.rewind()
        .map_err(|_| "Agent 沙箱 ACL 回收记录无法定位。".to_owned())?;
    let mut content = String::new();
    file.read_to_string(&mut content)
        .map_err(|_| "Agent 沙箱 ACL 回收记录无法读取。".to_owned())?;
    let mut lines = content.lines();
    let version = lines
        .next()
        .filter(|version| {
            *version == JOURNAL_MAGIC
                || *version == JOURNAL_MAGIC_V2
                || *version == JOURNAL_MAGIC_V1
        })
        .ok_or_else(|| "Agent 沙箱 ACL 回收记录版本无效。".to_owned())?;
    let is_v3 = version == JOURNAL_MAGIC;
    let is_v2_or_v3 = is_v3 || version == JOURNAL_MAGIC_V2;
    let profile = lines
        .next()
        .filter(|value| value.starts_with("LFAA.Agent.") && is_uuid(&value[11..]))
        .ok_or_else(|| "Agent 沙箱 ACL 回收记录 Profile 无效。".to_owned())?
        .to_owned();
    let token = &profile[11..];
    if journal_path.file_name().and_then(OsStr::to_str)
        != Some(format!("agent-{token}.journal").as_str())
    {
        return Err("Agent 沙箱 ACL 回收记录名称与 Profile 不匹配。".to_owned());
    }
    let app_data_root = if is_v2_or_v3 {
        let path =
            PathBuf::from(lines.next().ok_or_else(|| {
                "Agent 沙箱 ACL 回收记录缺少 AppContainer 本地数据路径。".to_owned()
            })?);
        let expected = expected_app_container_data_root(&profile)?;
        if !path.is_absolute() || !paths_equal_case_insensitive(&path, &expected) {
            return Err("Agent 沙箱 ACL 回收记录中的 AppContainer 本地数据路径越界。".to_owned());
        }
        Some(path)
    } else {
        None
    };
    let cancel_file = PathBuf::from(
        lines
            .next()
            .ok_or_else(|| "Agent 沙箱 ACL 回收记录缺少取消路径。".to_owned())?,
    );
    let cancel_parent = cancel_file
        .parent()
        .map(|parent| canonical_directory(parent, "Agent 沙箱取消通道"))
        .transpose()?;
    if !cancel_file.is_absolute()
        || cancel_parent
            .as_ref()
            .is_none_or(|parent| !paths_equal_case_insensitive(parent, state_root))
        || cancel_file.file_name().and_then(OsStr::to_str)
            != Some(format!("cancel-{token}.request").as_str())
    {
        return Err("Agent 沙箱 ACL 回收记录中的取消路径越界。".to_owned());
    }
    let targets = lines
        .map(|line| {
            if is_v3 {
                let (propagation, path) = line
                    .split_once('\t')
                    .ok_or_else(|| "Agent 沙箱 ACL 回收记录目标格式无效。".to_owned())?;
                let propagate = match propagation {
                    "P" => true,
                    "N" => false,
                    _ => return Err("Agent 沙箱 ACL 回收记录 ACL 模式无效。".to_owned()),
                };
                Ok(AclJournalTarget {
                    path: PathBuf::from(path),
                    propagate,
                })
            } else {
                Ok(AclJournalTarget {
                    path: PathBuf::from(line),
                    propagate: true,
                })
            }
        })
        .collect::<Result<Vec<_>, String>>()?;
    if targets.is_empty()
        || targets.len() > MAX_ACL_PATHS
        || targets.iter().any(|target| !target.path.is_absolute())
    {
        return Err("Agent 沙箱 ACL 回收记录中的路径无效。".to_owned());
    }
    Ok((profile, app_data_root, cancel_file, targets))
}

fn reap_stale_journals(state_root: &Path) -> Result<(), String> {
    let entries =
        fs::read_dir(state_root).map_err(|_| "Agent 沙箱控制目录无法读取。".to_owned())?;
    let mut active_tokens = HashSet::new();
    for entry in entries {
        let entry = entry.map_err(|_| "Agent 沙箱控制目录项无法读取。".to_owned())?;
        let path = entry.path();
        let file_name = entry.file_name();
        let Some(token) = file_name
            .to_str()
            .and_then(|name| name.strip_prefix("agent-"))
            .and_then(|name| name.strip_suffix(".journal"))
            .filter(|token| is_uuid(token))
        else {
            continue;
        };
        let mut file = match OpenOptions::new()
            .read(true)
            .write(true)
            .share_mode(0)
            .open(&path)
        {
            Ok(file) => file,
            Err(error) if matches!(error.raw_os_error(), Some(32 | 33)) => {
                active_tokens.insert(token.to_owned());
                continue;
            }
            Err(_) => return Err("Agent 沙箱 ACL 回收记录无法独占检查。".to_owned()),
        };
        let (profile, app_data_root, cancel_file, targets) =
            read_journal(&mut file, state_root, &path)?;
        let sid = derive_agent_profile_sid(&profile)?;
        for target in targets.iter().rev() {
            revoke_agent_access(&target.path, sid.0, target.propagate)?;
        }
        cleanup_profile(&profile, app_data_root.as_deref())?;
        drop(file);
        fs::remove_file(&path)
            .map_err(|_| "已回收 ACL，但无法删除 Agent 沙箱回收记录。".to_owned())?;
        let _ = fs::remove_file(cancel_file);
    }
    for entry in fs::read_dir(state_root).map_err(|_| "Agent 沙箱控制目录无法读取。".to_owned())?
    {
        let entry = entry.map_err(|_| "Agent 沙箱控制目录项无法读取。".to_owned())?;
        let file_name = entry.file_name();
        let Some(token) = file_name
            .to_str()
            .and_then(|name| name.strip_prefix("cancel-"))
            .and_then(|name| name.strip_suffix(".request"))
            .filter(|token| is_uuid(token))
        else {
            continue;
        };
        if !active_tokens.contains(token) {
            let metadata = fs::symlink_metadata(entry.path())
                .map_err(|_| "孤立 Agent 沙箱取消请求无法检查。".to_owned())?;
            if is_reparse_point(&metadata) || !metadata.is_file() {
                return Err("孤立 Agent 沙箱取消请求不是普通文件。".to_owned());
            }
            fs::remove_file(entry.path())
                .map_err(|_| "孤立 Agent 沙箱取消请求无法回收。".to_owned())?;
        }
    }
    Ok(())
}

fn derive_agent_profile_sid(profile_name: &str) -> Result<LocalAllocation, String> {
    let name = wide(profile_name);
    let mut sid = null_mut();
    let result = unsafe { DeriveAppContainerSidFromAppContainerName(name.as_ptr(), &mut sid) };
    if result < 0 || sid.is_null() {
        return Err(format!(
            "无法派生旧 Agent AppContainer SID（HRESULT 0x{:08X}）。",
            result as u32
        ));
    }
    Ok(LocalAllocation(sid))
}

fn cleanup_run(
    journal_path: &Path,
    journal_file: File,
    profile: &str,
    app_data_root: &Path,
    sid: windows_sys::Win32::Security::PSID,
    targets: &[AclTarget],
    cancel_file: &Path,
) -> Result<(), String> {
    let mut errors = Vec::new();
    for target in targets.iter().rev() {
        if let Err(error) = revoke_agent_access(&target.path, sid, target.inheritance != 0) {
            errors.push(error);
        }
    }
    if errors.is_empty() {
        if let Err(error) = cleanup_profile(profile, Some(app_data_root)) {
            errors.push(error);
        }
    }
    if !errors.is_empty() {
        return Err(errors.join("；"));
    }
    remove_journal(journal_path, journal_file, cancel_file)
}

fn revoke_agent_access(
    path: &Path,
    sid: windows_sys::Win32::Security::PSID,
    propagate: bool,
) -> Result<(), String> {
    let path_wide = wide_os(path.as_os_str());
    let mut old_dacl = null_mut();
    let mut descriptor = null_mut();
    let read_result = unsafe {
        GetNamedSecurityInfoW(
            path_wide.as_ptr(),
            SE_FILE_OBJECT,
            DACL_SECURITY_INFORMATION,
            null_mut(),
            null_mut(),
            &mut old_dacl,
            null_mut(),
            &mut descriptor,
        )
    };
    let _descriptor = LocalAllocation(descriptor);
    if read_result != ERROR_SUCCESS {
        return Err(format!(
            "无法读取 Agent 沙箱 ACL（Win32 错误 {read_result}）。"
        ));
    }
    if old_dacl.is_null() {
        return Ok(());
    }
    let mut count = 0u32;
    let mut entries = null_mut();
    let entries_result = unsafe { GetExplicitEntriesFromAclW(old_dacl, &mut count, &mut entries) };
    let _entries = LocalAllocation(entries.cast());
    if entries_result != ERROR_SUCCESS {
        return Err(format!(
            "无法检查 Agent 沙箱 ACL（Win32 错误 {entries_result}）。"
        ));
    }
    let has_agent_ace = if count == 0 || entries.is_null() {
        false
    } else {
        unsafe { std::slice::from_raw_parts(entries, count as usize) }
            .iter()
            .any(|entry| {
                entry.Trustee.TrusteeForm == TRUSTEE_IS_SID
                    && !entry.Trustee.ptstrName.is_null()
                    && unsafe { EqualSid(entry.Trustee.ptstrName.cast(), sid) } != 0
            })
    };
    if !has_agent_ace {
        return Ok(());
    }
    let result = if propagate {
        revoke_access(path, sid)
    } else {
        revoke_access_non_propagating(path, sid)
    };
    result.map_err(|error| format!("Agent 沙箱 ACL 清理失败：{error}"))
}

struct CoTaskAllocation(*mut c_void);

impl Drop for CoTaskAllocation {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe { CoTaskMemFree(self.0) };
        }
    }
}

fn expected_app_container_data_root(profile: &str) -> Result<PathBuf, String> {
    if !profile.starts_with("LFAA.Agent.") || !is_uuid(&profile[11..]) {
        return Err("Agent AppContainer Profile 名称无效。".to_owned());
    }
    let local_app_data = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .filter(|path| path.is_absolute())
        .ok_or_else(|| "Windows 本地应用数据目录未配置。".to_owned())?;
    Ok(local_app_data.join("Packages").join(profile).join("AC"))
}

fn app_container_data_root(
    sid: windows_sys::Win32::Security::PSID,
    profile: &str,
) -> Result<PathBuf, String> {
    let mut sid_text = null_mut();
    let converted = unsafe { ConvertSidToStringSidW(sid, &mut sid_text) };
    let _sid_text = LocalAllocation(sid_text.cast());
    if converted == 0 || sid_text.is_null() {
        return Err("无法读取 Agent AppContainer SID 字符串。".to_owned());
    }
    let mut folder_path = null_mut();
    let result = unsafe { GetAppContainerFolderPath(sid_text, &mut folder_path) };
    let _folder_path = CoTaskAllocation(folder_path.cast());
    if result < 0 || folder_path.is_null() {
        return Err(format!(
            "无法获取 Agent AppContainer 本地数据路径（HRESULT 0x{:08X}）。",
            result as u32
        ));
    }
    let mut length = 0usize;
    while unsafe { *folder_path.add(length) } != 0 {
        length += 1;
    }
    let actual = PathBuf::from(std::ffi::OsString::from_wide(unsafe {
        std::slice::from_raw_parts(folder_path, length)
    }));
    let expected = expected_app_container_data_root(profile)?;
    if !actual.is_absolute() || !paths_equal_case_insensitive(&actual, &expected) {
        return Err("Windows AppContainer 本地数据路径不符合预期的包隔离目录。".to_owned());
    }
    Ok(actual)
}

fn prepare_app_container_data(root: &Path) -> Result<(), String> {
    fs::create_dir_all(root)
        .map_err(|_| "无法创建 Agent AppContainer 本地数据目录。".to_owned())?;
    let canonical_root = canonical_directory(root, "Agent AppContainer 本地数据")?;
    let packages = root
        .parent()
        .and_then(Path::parent)
        .ok_or_else(|| "Agent AppContainer 本地数据路径结构无效。".to_owned())?;
    let canonical_packages = canonical_directory(packages, "AppContainer 包数据目录")?;
    if !path_is_within_case_insensitive(&canonical_root, &canonical_packages) {
        return Err("Agent AppContainer 本地数据目录超出当前用户包数据目录。".to_owned());
    }
    for child in ["Temp", "Roaming"] {
        let path = root.join(child);
        fs::create_dir_all(&path)
            .map_err(|_| "无法创建 Agent AppContainer 用户目录。".to_owned())?;
        let canonical_child = canonical_directory(&path, "Agent AppContainer 用户目录")?;
        if !path_is_within_case_insensitive(&canonical_child, &canonical_root) {
            return Err("Agent AppContainer 用户目录超出本次运行数据根。".to_owned());
        }
    }
    Ok(())
}

fn remove_app_container_data(root: &Path, profile: &str) -> Result<(), String> {
    let expected = expected_app_container_data_root(profile)?;
    if !paths_equal_case_insensitive(root, &expected) {
        return Err("Agent 沙箱清理拒绝回收越界的 AppContainer 本地数据路径。".to_owned());
    }
    let metadata = match fs::symlink_metadata(root) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(_) => return Err("无法检查 Agent AppContainer 本地数据目录。".to_owned()),
    };
    if is_reparse_point(&metadata) || !metadata.is_dir() {
        return Err("Agent AppContainer 本地数据根不是普通目录。".to_owned());
    }
    fs::remove_dir_all(root).map_err(|_| "无法回收 Agent AppContainer 本地数据目录。".to_owned())
}

fn cleanup_profile(profile: &str, app_data_root: Option<&Path>) -> Result<(), String> {
    if let Some(root) = app_data_root {
        remove_app_container_data(root, profile)?;
    }
    let name = wide(profile);
    let result = unsafe { DeleteAppContainerProfile(name.as_ptr()) };
    if result < 0 && result as u32 != 0x8007_0490 {
        return Err(format!(
            "无法删除 Agent AppContainer Profile（HRESULT 0x{:08X}）。",
            result as u32
        ));
    }
    Ok(())
}

fn remove_journal(path: &Path, file: File, cancel_file: &Path) -> Result<(), String> {
    drop(file);
    fs::remove_file(path).map_err(|_| "无法删除已完成的 Agent 沙箱回收记录。".to_owned())?;
    let _ = fs::remove_file(cancel_file);
    Ok(())
}

fn run_confined_process(
    args: &AgentRunArgs,
    workspace_root: &Path,
    working_directory: &Path,
    app_data_root: &Path,
    app_sid: windows_sys::Win32::Security::PSID,
) -> Result<u32, String> {
    let capabilities = SECURITY_CAPABILITIES {
        AppContainerSid: app_sid,
        Capabilities: null_mut(),
        CapabilityCount: 0,
        Reserved: 0,
    };
    let job = create_agent_job()?;
    let standard_handles = [
        unsafe { GetStdHandle(STD_INPUT_HANDLE) },
        unsafe { GetStdHandle(STD_OUTPUT_HANDLE) },
        unsafe { GetStdHandle(STD_ERROR_HANDLE) },
    ];
    if standard_handles
        .iter()
        .any(|handle| handle.is_null() || *handle == INVALID_HANDLE_VALUE)
    {
        return Err("Agent 沙箱标准输入输出管道不可用。".to_owned());
    }
    for handle in standard_handles {
        if unsafe { SetHandleInformation(handle, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT) } == 0 {
            return Err("无法限定 Agent 沙箱标准输入输出句柄。".to_owned());
        }
    }
    let attributes = create_attribute_list(&capabilities, &standard_handles)?;
    let mut startup = STARTUPINFOEXW::default();
    startup.StartupInfo.cb = size_of::<STARTUPINFOEXW>() as u32;
    startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
    startup.StartupInfo.hStdInput = standard_handles[0];
    startup.StartupInfo.hStdOutput = standard_handles[1];
    startup.StartupInfo.hStdError = standard_handles[2];
    startup.lpAttributeList = attributes.raw;
    let executable = windows_process_path(Path::new(&args.argv[0]));
    let command_line = args
        .argv
        .iter()
        .map(|argument| quote_windows_argument(argument))
        .collect::<Vec<_>>()
        .join(" ");
    let mut command_line = wide(&command_line);
    let executable_wide = wide_os(executable.as_os_str());
    let current_directory = wide_os(windows_process_path(working_directory).as_os_str());
    let mut environment = build_agent_environment(
        workspace_root,
        working_directory,
        &args.runtime_roots,
        app_data_root,
    )?;
    let mut process_info = PROCESS_INFORMATION::default();
    let created = unsafe {
        windows_sys::Win32::System::Threading::CreateProcessW(
            executable_wide.as_ptr(),
            command_line.as_mut_ptr(),
            null(),
            null(),
            1,
            CREATE_SUSPENDED | EXTENDED_STARTUPINFO_PRESENT | CREATE_UNICODE_ENVIRONMENT,
            environment.as_mut_ptr().cast(),
            current_directory.as_ptr(),
            &startup.StartupInfo,
            &mut process_info,
        )
    };
    if created == 0 {
        let error = std::io::Error::last_os_error();
        return Err(format!(
            "Windows 无法在无网络 Agent AppContainer 中创建命令进程（Win32 错误 {}: {error}）。",
            error.raw_os_error().unwrap_or_default()
        ));
    }
    let process = OwnedHandle(process_info.hProcess);
    let thread_handle = OwnedHandle(process_info.hThread);
    if let Err(error) = verify_agent_process_app_sid(process.raw(), app_sid) {
        return Err(terminate_unassigned_process(process.raw())
            .err()
            .map_or(error.clone(), |cleanup| format!("{error}；{cleanup}")));
    }
    if unsafe { AssignProcessToJobObject(job.raw(), process.raw()) } == 0 {
        let error = "无法将 Agent 命令加入受限 Job Object。".to_owned();
        return Err(terminate_unassigned_process(process.raw())
            .err()
            .map_or(error.clone(), |cleanup| format!("{error}；{cleanup}")));
    }
    if unsafe { ResumeThread(thread_handle.raw()) } == u32::MAX {
        let error = "无法恢复受限 Agent 命令进程。".to_owned();
        return Err(terminate_job_and_wait(job.raw(), process.raw())
            .err()
            .map_or(error.clone(), |cleanup| format!("{error}；{cleanup}")));
    }
    if let Err(error) = write_ready_message_for_agent(&args.run_token) {
        return Err(terminate_job_and_wait(job.raw(), process.raw())
            .err()
            .map_or(error.clone(), |cleanup| format!("{error}；{cleanup}")));
    }
    let mut cancelled = false;
    loop {
        let wait = unsafe { WaitForSingleObject(process.raw(), 100) };
        if wait == WAIT_OBJECT_0 {
            break;
        }
        if wait != windows_sys::Win32::Foundation::WAIT_TIMEOUT {
            let error = "等待 Agent 命令结束时发生错误。".to_owned();
            return Err(terminate_job_and_wait(job.raw(), process.raw())
                .err()
                .map_or(error.clone(), |cleanup| format!("{error}；{cleanup}")));
        }
        match fs::read_to_string(&args.cancel_file) {
            Ok(reason) if reason == "cancel" || reason == "timeout" => {
                cancelled = true;
                if let Err(error) = terminate_job_and_wait(job.raw(), process.raw()) {
                    return Err(format!("无法终止 Agent 沙箱进程树：{error}"));
                }
            }
            Ok(_) => {
                let error = "Agent 沙箱取消请求格式无效。".to_owned();
                return Err(terminate_job_and_wait(job.raw(), process.raw())
                    .err()
                    .map_or(error.clone(), |cleanup| format!("{error}；{cleanup}")));
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => {
                let error = "无法读取 Agent 沙箱取消请求。".to_owned();
                return Err(terminate_job_and_wait(job.raw(), process.raw())
                    .err()
                    .map_or(error.clone(), |cleanup| format!("{error}；{cleanup}")));
            }
        }
    }
    let mut exit_code = 1u32;
    if unsafe { GetExitCodeProcess(process.raw(), &mut exit_code) } == 0 {
        let error = "无法读取 Agent 命令退出状态。".to_owned();
        return Err(terminate_job_and_wait(job.raw(), process.raw())
            .err()
            .map_or(error.clone(), |cleanup| format!("{error}；{cleanup}")));
    }
    if !wait_for_agent_job_empty(job.raw(), 1_000)? {
        let error = format!(
            "Agent 命令退出后仍有 {} 个后台进程，已终止整个进程树。",
            active_agent_job_processes(job.raw()).unwrap_or(u32::MAX)
        );
        return Err(terminate_job_and_wait(job.raw(), process.raw())
            .err()
            .map_or(error.clone(), |cleanup| format!("{error}；{cleanup}")));
    }
    if cancelled {
        exit_code = 1;
    }
    Ok(exit_code)
}

fn terminate_unassigned_process(process: HANDLE) -> Result<(), String> {
    unsafe { TerminateProcess(process, 1) };
    match unsafe { WaitForSingleObject(process, 10_000) } {
        WAIT_OBJECT_0 => Ok(()),
        _ => Err("无法确认尚未纳入 Job Object 的 Agent 进程已退出。".to_owned()),
    }
}

fn terminate_job_and_wait(job: HANDLE, process: HANDLE) -> Result<(), String> {
    if unsafe { windows_sys::Win32::System::JobObjects::TerminateJobObject(job, 1) } == 0 {
        unsafe { TerminateProcess(process, 1) };
    }
    if wait_for_agent_job_empty(job, 10_000)? {
        Ok(())
    } else {
        Err("无法确认 Agent Job Object 中的所有进程均已退出。".to_owned())
    }
}

fn wait_for_agent_job_empty(job: HANDLE, timeout_ms: u64) -> Result<bool, String> {
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    loop {
        match active_agent_job_processes(job) {
            Some(0) => return Ok(true),
            Some(_) if Instant::now() < deadline => thread::sleep(Duration::from_millis(10)),
            Some(_) => return Ok(false),
            None => return Err("无法检查 Agent Job Object 中的活动进程数。".to_owned()),
        }
    }
}

fn active_agent_job_processes(job: HANDLE) -> Option<u32> {
    let mut information =
        windows_sys::Win32::System::JobObjects::JOBOBJECT_BASIC_ACCOUNTING_INFORMATION::default();
    let queried = unsafe {
        windows_sys::Win32::System::JobObjects::QueryInformationJobObject(
            job,
            windows_sys::Win32::System::JobObjects::JobObjectBasicAccountingInformation,
            &mut information as *mut _ as *mut c_void,
            size_of::<windows_sys::Win32::System::JobObjects::JOBOBJECT_BASIC_ACCOUNTING_INFORMATION>(
            ) as u32,
            null_mut(),
        )
    };
    if queried == 0 {
        None
    } else {
        Some(information.ActiveProcesses)
    }
}

fn create_agent_job() -> Result<OwnedHandle, String> {
    let job = OwnedHandle(unsafe { CreateJobObjectW(null(), null()) });
    if !job.is_valid() {
        return Err("无法创建 Agent Job Object。".to_owned());
    }
    let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        | JOB_OBJECT_LIMIT_ACTIVE_PROCESS
        | JOB_OBJECT_LIMIT_PROCESS_MEMORY
        | windows_sys::Win32::System::JobObjects::JOB_OBJECT_LIMIT_JOB_MEMORY;
    limits.BasicLimitInformation.ActiveProcessLimit = AGENT_PROCESS_LIMIT;
    limits.ProcessMemoryLimit = AGENT_MEMORY_LIMIT_MB * 1024 * 1024;
    limits.JobMemoryLimit = AGENT_MEMORY_LIMIT_MB * 1024 * 1024;
    if unsafe {
        SetInformationJobObject(
            job.raw(),
            JobObjectExtendedLimitInformation,
            &limits as *const _ as *const c_void,
            size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        )
    } == 0
    {
        return Err("无法设置 Agent 进程数与内存上限。".to_owned());
    }
    Ok(job)
}

fn verify_agent_process_app_sid(
    process: HANDLE,
    expected_sid: windows_sys::Win32::Security::PSID,
) -> Result<(), String> {
    let mut token = null_mut();
    if unsafe { OpenProcessToken(process, TOKEN_QUERY, &mut token) } == 0 {
        return Err("无法检查 Agent AppContainer 进程令牌。".to_owned());
    }
    let token = OwnedHandle(token);
    let mut required = 0u32;
    unsafe {
        windows_sys::Win32::Security::GetTokenInformation(
            token.raw(),
            TokenAppContainerSid,
            null_mut(),
            0,
            &mut required,
        );
    }
    if required < size_of::<TOKEN_APPCONTAINER_INFORMATION>() as u32 {
        return Err("Agent 命令没有可验证的 AppContainer SID。".to_owned());
    }
    let mut information = vec![0usize; (required as usize).div_ceil(size_of::<usize>())];
    if unsafe {
        windows_sys::Win32::Security::GetTokenInformation(
            token.raw(),
            TokenAppContainerSid,
            information.as_mut_ptr().cast(),
            required,
            &mut required,
        )
    } == 0
    {
        return Err("无法读取 Agent AppContainer SID。".to_owned());
    }
    let actual_sid = unsafe {
        (*(information
            .as_ptr()
            .cast::<TOKEN_APPCONTAINER_INFORMATION>()))
        .TokenAppContainer
    };
    if actual_sid.is_null() || unsafe { EqualSid(actual_sid, expected_sid) } == 0 {
        return Err("Agent 命令令牌 SID 与本次沙箱不匹配。".to_owned());
    }
    Ok(())
}

fn build_agent_environment(
    workspace: &Path,
    working_directory: &Path,
    runtime_roots: &[PathBuf],
    app_data_root: &Path,
) -> Result<Vec<u16>, String> {
    let system_root = std::env::var_os("SystemRoot")
        .or_else(|| std::env::var_os("WINDIR"))
        .ok_or_else(|| "Windows 系统目录未配置。".to_owned())?;
    // AppContainer 会将宿主 LOCALAPPDATA 自动重定向至 Packages/<identity>/AC。
    let local_app_data = std::env::var_os("LOCALAPPDATA")
        .ok_or_else(|| "Windows 本地应用数据目录未配置。".to_owned())?;
    let temp = app_data_root.join("Temp");
    let mut path_parts = vec![
        workspace.join("node_modules/.bin"),
        workspace.join("node_modules"),
        PathBuf::from(&system_root).join("System32"),
    ];
    path_parts.extend(runtime_roots.iter().cloned());
    path_parts.dedup_by(|left, right| paths_equal_case_insensitive(left, right));
    let entries = [
        format!(
            "PATH={}",
            path_parts
                .iter()
                .map(|path| windows_process_path(path).display().to_string())
                .collect::<Vec<_>>()
                .join(";")
        ),
        // The curated PATH contains only system, workspace, and approved runtime roots; PowerShell still needs PATHEXT to resolve commands such as node to node.exe.
        format!("PATHEXT={AGENT_PATH_EXTENSIONS}"),
        format!("SystemRoot={}", system_root.to_string_lossy()),
        format!("WINDIR={}", system_root.to_string_lossy()),
        format!("TEMP={}", temp.join("temp").display()),
        format!("TMP={}", temp.join("temp").display()),
        format!("USERPROFILE={}", app_data_root.display()),
        format!("HOME={}", app_data_root.display()),
        format!("APPDATA={}", app_data_root.join("Roaming").display()),
        format!("LOCALAPPDATA={}", local_app_data.to_string_lossy()),
    ];
    let mut entries = entries
        .into_iter()
        .map(|entry| entry.encode_utf16().collect::<Vec<_>>())
        .collect::<Vec<_>>();
    // The curated environment omits inherited variables. Windows stores the current directory per drive in a special =X: entry; provide only the selected working drive so relative paths do not fall back to the host's default drive.
    if let Some(drive_directory) = drive_current_directory_entry(working_directory) {
        entries.push(drive_directory);
    }
    entries.sort_by_cached_key(|entry| environment_sort_key(entry));
    let mut block = Vec::new();
    for entry in entries {
        block.extend(entry);
        block.push(0);
    }
    block.push(0);
    Ok(block)
}

fn write_ready_message_for_agent(token: &str) -> Result<(), String> {
    let message = format!("{AGENT_READY_PREFIX}{token}\u{1e}\n");
    std::io::stderr()
        .write_all(message.as_bytes())
        .map_err(|_| "Agent 沙箱握手通道不可用。".to_owned())?;
    std::io::stderr()
        .flush()
        .map_err(|_| "Agent 沙箱握手通道不可用。".to_owned())
}

fn write_result_message(token: &str, mode: &str, exit_code: u32) -> Result<(), String> {
    let message = format!("{AGENT_RESULT_PREFIX}{token}:{mode}:{exit_code}\u{1e}\n");
    std::io::stderr()
        .write_all(message.as_bytes())
        .map_err(|_| "Agent 沙箱结果通道不可用。".to_owned())?;
    std::io::stderr()
        .flush()
        .map_err(|_| "Agent 沙箱结果通道不可用。".to_owned())
}
