/*
 * 功能：创建 Minecraft 实例专属的 Windows AppContainer 进程。
 * 作用：由本机 Daemon 调用，校验数据根目录内配置的实例目录与所选 Java 运行目录，只授予实例目录读写、Java 运行目录只读执行和明确网络能力，并用 Job Object 管理进程生命周期。
 * 关联文件：packages/host/daemon/src/minecraft-daemon.mjs、apps/daemon/package.json、docs/PROMPTS.md。
 */
#[cfg(windows)]
mod windows_host {
    use sha2::{Digest, Sha256};
    use std::ffi::{OsStr, OsString, c_void};
    use std::fs::{self, File};
    use std::io::{Read, Write};
    use std::mem::size_of;
    use std::os::windows::ffi::OsStrExt;
    use std::os::windows::io::{FromRawHandle, IntoRawHandle, RawHandle};
    use std::path::{Component, Path, PathBuf, Prefix};
    use std::ptr::{null, null_mut};
    use std::thread;

    use windows_sys::Win32::Foundation::{
        CloseHandle, ERROR_SUCCESS, HANDLE, HANDLE_FLAG_INHERIT, INVALID_HANDLE_VALUE, LocalFree,
        SetHandleInformation, WAIT_OBJECT_0,
    };
    use windows_sys::Win32::Security::Authorization::{
        EXPLICIT_ACCESS_W, GRANT_ACCESS, GetNamedSecurityInfoW, REVOKE_ACCESS, SE_FILE_OBJECT,
        SetEntriesInAclW, SetNamedSecurityInfoW, TRUSTEE_IS_SID, TRUSTEE_IS_USER,
    };
    use windows_sys::Win32::Security::Isolation::{
        CreateAppContainerProfile, DeleteAppContainerProfile,
        DeriveAppContainerSidFromAppContainerName,
    };
    use windows_sys::Win32::Security::{
        CONTAINER_INHERIT_ACE, DACL_SECURITY_INFORMATION, DeriveCapabilitySidsFromName, EqualSid,
        GetSecurityDescriptorSacl, LABEL_SECURITY_INFORMATION, OBJECT_INHERIT_ACE,
        SECURITY_ATTRIBUTES, SECURITY_CAPABILITIES, SID_AND_ATTRIBUTES,
        TOKEN_APPCONTAINER_INFORMATION, TOKEN_QUERY, TokenAppContainerSid,
    };
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_ATTRIBUTE_REPARSE_POINT, FILE_DELETE_CHILD, FILE_GENERIC_EXECUTE, FILE_GENERIC_READ,
        FILE_GENERIC_WRITE,
    };
    use windows_sys::Win32::System::Console::{
        GetStdHandle, STD_ERROR_HANDLE, STD_INPUT_HANDLE, STD_OUTPUT_HANDLE,
    };
    use windows_sys::Win32::System::Environment::{
        FreeEnvironmentStringsW, GetEnvironmentStringsW, SetEnvironmentVariableW,
    };
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JOB_OBJECT_LIMIT_ACTIVE_PROCESS,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE, JOB_OBJECT_LIMIT_PROCESS_MEMORY,
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JobObjectExtendedLimitInformation,
        SetInformationJobObject,
    };
    use windows_sys::Win32::System::Pipes::CreatePipe;
    use windows_sys::Win32::System::SystemServices::SE_GROUP_ENABLED;
    use windows_sys::Win32::System::Threading::{
        CREATE_SUSPENDED, CREATE_UNICODE_ENVIRONMENT, DeleteProcThreadAttributeList,
        EXTENDED_STARTUPINFO_PRESENT, GetExitCodeProcess, InitializeProcThreadAttributeList,
        OpenProcessToken, PROC_THREAD_ATTRIBUTE_HANDLE_LIST,
        PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES, PROCESS_INFORMATION, ResumeThread,
        STARTF_USESTDHANDLES, STARTUPINFOEXW, TerminateProcess, UpdateProcThreadAttribute,
        WaitForSingleObject,
    };
    use windows_sys::core::HRESULT;

    const BACKEND_ID: &str = "windows-appcontainer-v1";
    const APP_ID: &str = "minecraft";
    const SANDBOX_READY_PREFIX: &str = "\u{1e}LFAA_SANDBOX_READY:";
    const PLUGIN_READY_PREFIX: &str = "\u{1e}LFAA_PLUGIN_SANDBOX_READY:";
    const NETWORK_CAPABILITIES: [&str; 2] = ["internetClientServer", "privateNetworkClientServer"];
    const INSTANCE_WRITE_ACCESS: u32 = FILE_GENERIC_READ | FILE_GENERIC_WRITE | FILE_DELETE_CHILD;
    const JAVA_READ_ACCESS: u32 = FILE_GENERIC_READ | FILE_GENERIC_EXECUTE;
    const PLUGIN_READ_ACCESS: u32 = FILE_GENERIC_READ | FILE_GENERIC_EXECUTE;
    // 插件沿父目录解析已知运行时/入口路径时，只能穿越目录并读取元数据，不能列目录。
    const PLUGIN_DIRECTORY_TRAVERSE: u32 = 0xA0;
    const DIRECTORY_INHERITANCE: u32 = OBJECT_INHERIT_ACE | CONTAINER_INHERIT_ACE;
    const PLUGIN_MAX_FILES: usize = 8192;
    const PLUGIN_MEMORY_LIMIT_MB: usize = 512;
    const PLUGIN_ENVIRONMENT_ALLOWLIST: [&str; 20] = [
        "APPDATA",
        "COMPUTERNAME",
        "HOMEDRIVE",
        "HOMEPATH",
        "LOCALAPPDATA",
        "OS",
        "PATH",
        "PROCESSOR_ARCHITECTURE",
        "PROCESSOR_IDENTIFIER",
        "ProgramData",
        "ProgramFiles",
        "ProgramFiles(x86)",
        "PUBLIC",
        "SystemDrive",
        "SystemRoot",
        "TEMP",
        "TMP",
        "USERDOMAIN",
        "USERNAME",
        "USERPROFILE",
    ];
    const HRESULT_ALREADY_EXISTS: HRESULT = 0x8007_00b7u32 as i32;

    struct LocalAllocation(*mut c_void);

    impl Drop for LocalAllocation {
        fn drop(&mut self) {
            if !self.0.is_null() {
                unsafe {
                    LocalFree(self.0 as _);
                }
            }
        }
    }

    struct OwnedHandle(HANDLE);

    impl OwnedHandle {
        fn is_valid(&self) -> bool {
            !self.0.is_null() && self.0 != INVALID_HANDLE_VALUE
        }

        fn raw(&self) -> HANDLE {
            self.0
        }
    }

    impl Drop for OwnedHandle {
        fn drop(&mut self) {
            if self.is_valid() {
                unsafe {
                    CloseHandle(self.0);
                }
            }
        }
    }

    impl IntoRawHandle for OwnedHandle {
        fn into_raw_handle(mut self) -> RawHandle {
            let raw = self.0;
            self.0 = null_mut();
            raw as RawHandle
        }
    }

    struct PipeSet {
        stdin_read: OwnedHandle,
        stdin_write: OwnedHandle,
        stdout_read: OwnedHandle,
        stdout_write: OwnedHandle,
        stderr_read: OwnedHandle,
        stderr_write: OwnedHandle,
    }

    struct ProcAttributeList {
        _storage: Vec<usize>,
        raw: windows_sys::Win32::System::Threading::LPPROC_THREAD_ATTRIBUTE_LIST,
    }

    impl Drop for ProcAttributeList {
        fn drop(&mut self) {
            if !self.raw.is_null() {
                unsafe {
                    DeleteProcThreadAttributeList(self.raw);
                }
            }
        }
    }

    struct LaunchArgs {
        data_root: PathBuf,
        instance_storage: String,
        instance_id: String,
        instance_name: String,
        java_path: PathBuf,
        java_root: PathBuf,
        previous_java_root: Option<PathBuf>,
        memory_mb: u32,
        readiness_token: Option<String>,
    }

    struct PluginLaunchArgs {
        data_root: PathBuf,
        profile: String,
        plugin_id: String,
        entry: String,
        node_path: PathBuf,
        readiness_token: String,
    }

    struct PluginForgetArgs {
        data_root: PathBuf,
        profile: String,
        plugin_id: String,
        node_path: PathBuf,
    }

    pub fn main() -> Result<(), String> {
        let mut args = std::env::args_os().skip(1);
        let command = args
            .next()
            .and_then(|value| value.into_string().ok())
            .ok_or_else(|| "缺少 Sandbox Host 命令。".to_owned())?;
        match command.as_str() {
            "--probe" => {
                if args.next().is_some() {
                    return Err("Sandbox Host 探测参数无效。".to_owned());
                }
                probe()?;
                println!(
                    "{{\"backend\":\"{BACKEND_ID}\",\"protocolVersion\":1,\"networkCapabilities\":[\"internetClientServer\",\"privateNetworkClientServer\"]}}"
                );
                Ok(())
            }
            "--prepare" => {
                let parsed = parse_launch_args(args, false)?;
                prepare_instance(&parsed)?;
                println!(
                    "{{\"backend\":\"{BACKEND_ID}\",\"appId\":\"{APP_ID}\",\"instanceId\":\"{}\"}}",
                    parsed.instance_id
                );
                Ok(())
            }
            "--launch" => {
                let parsed = parse_launch_args(args, true)?;
                launch_instance(&parsed)
            }
            "--plugin-run" => {
                let parsed = parse_plugin_launch_args(args)?;
                launch_plugin(&parsed)
            }
            "--plugin-forget-profile" => {
                let parsed = parse_plugin_forget_args(args)?;
                forget_plugin_profile(&parsed)
            }
            _ => Err("Sandbox Host 命令不受支持。".to_owned()),
        }
    }

    fn parse_launch_args(
        args: impl Iterator<Item = OsString>,
        require_readiness_token: bool,
    ) -> Result<LaunchArgs, String> {
        let mut values = std::collections::HashMap::<String, OsString>::new();
        let mut args = args;
        while let Some(key) = args.next() {
            let key = key.into_string().map_err(|_| "Sandbox Host 参数无效。")?;
            if !matches!(
                key.as_str(),
                "--data-root"
                    | "--instance-storage"
                    | "--instance-id"
                    | "--instance-name"
                    | "--java"
                    | "--java-root"
                    | "--previous-java-root"
                    | "--memory-mb"
                    | "--readiness-token"
            ) {
                return Err("Sandbox Host 参数不受支持。".to_owned());
            }
            let value = args
                .next()
                .ok_or_else(|| "Sandbox Host 参数缺少值。".to_owned())?;
            if values.insert(key, value).is_some() {
                return Err("Sandbox Host 参数重复。".to_owned());
            }
        }

        let data_root = PathBuf::from(
            values
                .remove("--data-root")
                .ok_or_else(|| "缺少数据根目录。".to_owned())?,
        );
        let instance_storage = values
            .remove("--instance-storage")
            .and_then(|value| value.into_string().ok())
            .filter(|value| is_valid_storage_path(value))
            .ok_or_else(|| "Minecraft 实例根目录必须是有效的数据根目录相对路径。".to_owned())?;
        let instance_id = values
            .remove("--instance-id")
            .and_then(|value| value.into_string().ok())
            .ok_or_else(|| "缺少实例 ID。".to_owned())?;
        if !is_uuid(&instance_id) {
            return Err("实例 ID 格式无效。".to_owned());
        }
        let instance_name = values
            .remove("--instance-name")
            .and_then(|value| value.into_string().ok())
            .ok_or_else(|| "缺少实例名称。".to_owned())?;
        if !is_valid_instance_name(&instance_name) {
            return Err("实例名称不适合作为 Windows 目录名。".to_owned());
        }
        let java_path = PathBuf::from(
            values
                .remove("--java")
                .ok_or_else(|| "缺少 Java 路径。".to_owned())?,
        );
        let java_root = PathBuf::from(
            values
                .remove("--java-root")
                .ok_or_else(|| "缺少所选 Java 运行目录。".to_owned())?,
        );
        let previous_java_root = values.remove("--previous-java-root").map(PathBuf::from);
        if require_readiness_token && previous_java_root.is_some() {
            return Err("启动命令不接受旧 Java 目录参数。".to_owned());
        }
        let memory_mb = values
            .remove("--memory-mb")
            .and_then(|value| value.into_string().ok())
            .and_then(|value| value.parse::<u32>().ok())
            .filter(|value| (1024..=32768).contains(value))
            .ok_or_else(|| "实例内存上限无效。".to_owned())?;
        let readiness_token = values
            .remove("--readiness-token")
            .and_then(|value| value.into_string().ok());
        if require_readiness_token && !readiness_token.as_deref().is_some_and(is_uuid) {
            return Err("沙盒启动确认令牌无效。".to_owned());
        }
        if !values.is_empty() {
            return Err("Sandbox Host 参数不受支持。".to_owned());
        }
        Ok(LaunchArgs {
            data_root,
            instance_storage,
            instance_id,
            instance_name,
            java_path,
            java_root,
            previous_java_root,
            memory_mb,
            readiness_token,
        })
    }

    fn parse_plugin_launch_args(
        args: impl Iterator<Item = OsString>,
    ) -> Result<PluginLaunchArgs, String> {
        let mut values = std::collections::HashMap::<String, OsString>::new();
        let mut args = args;
        while let Some(key) = args.next() {
            let key = key.into_string().map_err(|_| "插件沙盒参数无效。")?;
            if !matches!(
                key.as_str(),
                "--data-root"
                    | "--profile"
                    | "--plugin-id"
                    | "--entry"
                    | "--node"
                    | "--readiness-token"
            ) {
                return Err("插件沙盒参数不受支持。".to_owned());
            }
            let value = args
                .next()
                .ok_or_else(|| "插件沙盒参数缺少值。".to_owned())?;
            if values.insert(key, value).is_some() {
                return Err("插件沙盒参数重复。".to_owned());
            }
        }
        let data_root = PathBuf::from(
            values
                .remove("--data-root")
                .ok_or_else(|| "缺少 LFAA 数据根目录。".to_owned())?,
        );
        let profile = values
            .remove("--profile")
            .and_then(|value| value.into_string().ok())
            .filter(|value| is_valid_profile_name(value))
            .ok_or_else(|| "插件 Profile 名称无效。".to_owned())?;
        let plugin_id = values
            .remove("--plugin-id")
            .and_then(|value| value.into_string().ok())
            .filter(|value| is_valid_plugin_id(value))
            .ok_or_else(|| "插件 ID 无效。".to_owned())?;
        let entry = values
            .remove("--entry")
            .and_then(|value| value.into_string().ok())
            .filter(|value| is_valid_plugin_entry(value))
            .ok_or_else(|| "插件运行入口必须是安全的 .mjs 相对路径。".to_owned())?;
        let node_path = PathBuf::from(
            values
                .remove("--node")
                .ok_or_else(|| "缺少受信任的 Node.js 运行时路径。".to_owned())?,
        );
        let readiness_token = values
            .remove("--readiness-token")
            .and_then(|value| value.into_string().ok())
            .filter(|value| is_uuid(value))
            .ok_or_else(|| "插件沙盒启动确认令牌无效。".to_owned())?;
        if !values.is_empty() || !data_root.is_absolute() || !node_path.is_absolute() {
            return Err("插件沙盒路径参数无效。".to_owned());
        }
        Ok(PluginLaunchArgs {
            data_root,
            profile,
            plugin_id,
            entry,
            node_path,
            readiness_token,
        })
    }

    fn parse_plugin_forget_args(
        args: impl Iterator<Item = OsString>,
    ) -> Result<PluginForgetArgs, String> {
        let mut values = std::collections::HashMap::<String, OsString>::new();
        let mut args = args;
        while let Some(key) = args.next() {
            let key = key.into_string().map_err(|_| "插件清理参数无效。")?;
            if !matches!(
                key.as_str(),
                "--data-root" | "--profile" | "--plugin-id" | "--node"
            ) {
                return Err("插件清理参数不受支持。".to_owned());
            }
            let value = args
                .next()
                .ok_or_else(|| "插件清理参数缺少值。".to_owned())?;
            if values.insert(key, value).is_some() {
                return Err("插件清理参数重复。".to_owned());
            }
        }
        let data_root = PathBuf::from(
            values
                .remove("--data-root")
                .ok_or_else(|| "缺少 LFAA 数据根目录。".to_owned())?,
        );
        let profile = values
            .remove("--profile")
            .and_then(|value| value.into_string().ok())
            .filter(|value| is_valid_profile_name(value))
            .ok_or_else(|| "插件 Profile 名称无效。".to_owned())?;
        let plugin_id = values
            .remove("--plugin-id")
            .and_then(|value| value.into_string().ok())
            .filter(|value| is_valid_plugin_id(value))
            .ok_or_else(|| "插件 ID 无效。".to_owned())?;
        let node_path = PathBuf::from(
            values
                .remove("--node")
                .ok_or_else(|| "缺少受信任的 Node.js 运行时路径。".to_owned())?,
        );
        if !values.is_empty() || !data_root.is_absolute() || !node_path.is_absolute() {
            return Err("插件清理路径参数无效。".to_owned());
        }
        Ok(PluginForgetArgs {
            data_root,
            profile,
            plugin_id,
            node_path,
        })
    }

    fn is_valid_profile_name(value: &str) -> bool {
        !value.is_empty()
            && value.len() <= 64
            && value
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
            && value.as_bytes()[0].is_ascii_lowercase()
    }

    fn is_valid_plugin_id(value: &str) -> bool {
        let Some(first) = value.bytes().next() else {
            return false;
        };
        value.len() >= 2
            && value.len() <= 120
            && (first.is_ascii_lowercase() || first.is_ascii_digit())
            && value.bytes().all(|byte| {
                byte.is_ascii_lowercase()
                    || byte.is_ascii_digit()
                    || matches!(byte, b'.' | b'_' | b'-')
            })
    }

    fn is_valid_plugin_entry(value: &str) -> bool {
        !value.is_empty()
            && value.len() <= 512
            && !value.contains('\\')
            && value.ends_with(".mjs")
            && value.split('/').all(|segment| {
                !segment.is_empty()
                    && segment != "."
                    && segment != ".."
                    && segment.len() <= 120
                    && segment.bytes().all(|byte| {
                        byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-')
                    })
            })
    }

    fn is_valid_storage_path(value: &str) -> bool {
        let segments = value.split('/').collect::<Vec<_>>();
        !value.is_empty()
            && value.len() <= 512
            && !value.contains('\\')
            && segments.len() <= 16
            && !segments.first().is_some_and(|segment| {
                segment.eq_ignore_ascii_case("credentials")
                    || segment.eq_ignore_ascii_case("database")
            })
            && segments.iter().all(|segment| {
                !segment.is_empty()
                    && *segment != "."
                    && *segment != ".."
                    && segment.len() <= 120
                    && !segment.ends_with(' ')
                    && !segment.ends_with('.')
                    && !segment
                        .chars()
                        .any(|character| character.is_control() || "<>:\"|?*".contains(character))
                    && ![
                        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6",
                        "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6",
                        "LPT7", "LPT8", "LPT9",
                    ]
                    .iter()
                    .any(|reserved| {
                        segment
                            .split('.')
                            .next()
                            .is_some_and(|base| base.eq_ignore_ascii_case(reserved))
                    })
            })
    }

    fn is_uuid(value: &str) -> bool {
        value.len() == 36
            && value.bytes().enumerate().all(|(index, byte)| {
                if matches!(index, 8 | 13 | 18 | 23) {
                    byte == b'-'
                } else {
                    byte.is_ascii_hexdigit()
                }
            })
    }

    // 与控制端名称规则保持一致，并拒绝 Windows 会解释为设备名或自动折叠的目录名。
    fn is_valid_instance_name(value: &str) -> bool {
        let mut characters = value.chars();
        let Some(first) = characters.next() else {
            return false;
        };
        if !first.is_alphanumeric()
            || value.chars().count() > 48
            || !characters.all(|character| {
                character.is_alphanumeric() || matches!(character, ' ' | '.' | '_' | '-')
            })
            || matches!(value.chars().last(), Some(' ' | '.'))
        {
            return false;
        }
        let reserved_name = value
            .split('.')
            .next()
            .unwrap_or(value)
            .to_ascii_uppercase();
        !matches!(
            reserved_name.as_str(),
            "CON"
                | "PRN"
                | "AUX"
                | "NUL"
                | "COM1"
                | "COM2"
                | "COM3"
                | "COM4"
                | "COM5"
                | "COM6"
                | "COM7"
                | "COM8"
                | "COM9"
                | "LPT1"
                | "LPT2"
                | "LPT3"
                | "LPT4"
                | "LPT5"
                | "LPT6"
                | "LPT7"
                | "LPT8"
                | "LPT9"
        )
    }

    fn probe() -> Result<(), String> {
        let capabilities = derive_network_capabilities()?;
        let _capabilities = capabilities;
        let job = unsafe { CreateJobObjectW(null(), null()) };
        let job = OwnedHandle(job);
        if !job.is_valid() {
            return Err("Windows Job Object 不可用。".to_owned());
        }
        Ok(())
    }

    fn derive_network_capabilities() -> Result<Vec<LocalAllocation>, String> {
        let mut result = Vec::new();
        for name in NETWORK_CAPABILITIES {
            let name_wide = wide(name);
            let mut group_sids: *mut windows_sys::Win32::Security::PSID = null_mut();
            let mut group_count = 0u32;
            let mut capability_sids: *mut windows_sys::Win32::Security::PSID = null_mut();
            let mut capability_count = 0u32;
            let ok = unsafe {
                DeriveCapabilitySidsFromName(
                    name_wide.as_ptr(),
                    &mut group_sids,
                    &mut group_count,
                    &mut capability_sids,
                    &mut capability_count,
                )
            };
            if ok == 0 || capability_count != 1 || capability_sids.is_null() {
                free_sid_array(group_sids, group_count);
                free_sid_array(capability_sids, capability_count);
                return Err(format!("Windows 网络能力 {name} 无法解析。"));
            }
            free_sid_array(group_sids, group_count);
            let capability_sid = unsafe { *capability_sids };
            unsafe {
                LocalFree(capability_sids as _);
            }
            if capability_sid.is_null() {
                return Err(format!("Windows 网络能力 {name} 无效。"));
            }
            result.push(LocalAllocation(capability_sid));
        }
        Ok(result)
    }

    fn free_sid_array(array: *mut windows_sys::Win32::Security::PSID, count: u32) {
        if array.is_null() {
            return;
        }
        for index in 0..count as usize {
            let sid = unsafe { *array.add(index) };
            if !sid.is_null() {
                unsafe {
                    LocalFree(sid as _);
                }
            }
        }
        unsafe {
            LocalFree(array as _);
        }
    }

    fn profile_name(instance_id: &str) -> String {
        format!("LFAA.Minecraft.{instance_id}")
    }

    fn app_container_sid(instance_id: &str) -> Result<LocalAllocation, String> {
        let profile_name = wide(&profile_name(instance_id));
        let display_name = wide(&format!("LFAA Minecraft {instance_id}"));
        let description = wide("LFAA Minecraft 实例隔离容器");
        let capability_allocations = derive_network_capabilities()?;
        let capability_entries = capability_allocations
            .iter()
            .map(|sid| SID_AND_ATTRIBUTES {
                Sid: sid.0,
                Attributes: SE_GROUP_ENABLED as u32,
            })
            .collect::<Vec<_>>();
        let mut app_sid = null_mut();
        let result = unsafe {
            CreateAppContainerProfile(
                profile_name.as_ptr(),
                display_name.as_ptr(),
                description.as_ptr(),
                capability_entries.as_ptr(),
                capability_entries.len() as u32,
                &mut app_sid,
            )
        };
        if result >= 0 && !app_sid.is_null() {
            return Ok(LocalAllocation(app_sid));
        }
        if result != HRESULT_ALREADY_EXISTS {
            return Err(format!(
                "无法建立 Minecraft AppContainer（HRESULT 0x{:08X}）。",
                result as u32
            ));
        }

        let mut existing_sid = null_mut();
        let derive_result = unsafe {
            DeriveAppContainerSidFromAppContainerName(profile_name.as_ptr(), &mut existing_sid)
        };
        if derive_result < 0 || existing_sid.is_null() {
            return Err(format!(
                "无法读取 Minecraft AppContainer（HRESULT 0x{:08X}）。",
                derive_result as u32
            ));
        }
        Ok(LocalAllocation(existing_sid))
    }

    fn plugin_app_container_sid(profile: &str, plugin_id: &str) -> Result<LocalAllocation, String> {
        let profile_name = plugin_container_name(profile, plugin_id);
        let profile_name_wide = wide(&profile_name);
        let display_name = wide(&format!(
            "LFAA Plugin {}",
            plugin_id.chars().take(32).collect::<String>()
        ));
        let description = wide("LFAA 无网络第三方插件隔离容器");
        let mut app_sid = null_mut();
        let result = unsafe {
            CreateAppContainerProfile(
                profile_name_wide.as_ptr(),
                display_name.as_ptr(),
                description.as_ptr(),
                null(),
                0,
                &mut app_sid,
            )
        };
        if result >= 0 && !app_sid.is_null() {
            return Ok(LocalAllocation(app_sid));
        }
        if result != HRESULT_ALREADY_EXISTS {
            return Err(format!(
                "无法建立插件 AppContainer（HRESULT 0x{:08X}）。",
                result as u32
            ));
        }
        let mut existing_sid = null_mut();
        let derive_result = unsafe {
            DeriveAppContainerSidFromAppContainerName(profile_name_wide.as_ptr(), &mut existing_sid)
        };
        if derive_result < 0 || existing_sid.is_null() {
            return Err(format!(
                "无法读取插件 AppContainer（HRESULT 0x{:08X}）。",
                derive_result as u32
            ));
        }
        Ok(LocalAllocation(existing_sid))
    }

    fn plugin_container_name(profile: &str, plugin_id: &str) -> String {
        let mut digest = Sha256::new();
        digest.update(profile.as_bytes());
        digest.update([0]);
        digest.update(plugin_id.as_bytes());
        let digest = digest.finalize();
        format!(
            "LFAA.Plugin.{}",
            digest[..24]
                .iter()
                .map(|byte| format!("{byte:02x}"))
                .collect::<String>()
        )
    }

    fn canonical_managed_directory(parent: &Path, segment: &str) -> Result<PathBuf, String> {
        let path = parent.join(segment);
        let metadata =
            fs::symlink_metadata(&path).map_err(|_| "插件受管目录不存在或无法验证。".to_owned())?;
        if !metadata.is_dir() || is_reparse_point(&metadata) {
            return Err("插件受管目录包含重解析点或非目录路径。".to_owned());
        }
        let canonical = fs::canonicalize(&path).map_err(|_| "插件受管目录无法验证。".to_owned())?;
        if canonical.parent() != Some(parent) {
            return Err("插件受管目录越过 LFAA 数据根目录。".to_owned());
        }
        Ok(canonical)
    }

    fn validate_plugin_paths(
        args: &PluginLaunchArgs,
    ) -> Result<(PathBuf, PathBuf, PathBuf, PathBuf), String> {
        let data_root = fs::canonicalize(&args.data_root)
            .map_err(|_| "LFAA 插件数据根目录无法验证。".to_owned())?;
        if !data_root.is_dir() {
            return Err("LFAA 插件数据根目录不是目录。".to_owned());
        }
        let plugins_root = canonical_managed_directory(&data_root, "plugins")?;
        let profiles_root = canonical_managed_directory(&plugins_root, "profiles")?;
        let profile_root = canonical_managed_directory(&profiles_root, &args.profile)?;
        let plugin_root = canonical_managed_directory(&profile_root, &args.plugin_id)?;
        let entry_path = fs::canonicalize(plugin_root.join(&args.entry))
            .map_err(|_| "插件入口文件无法验证。".to_owned())?;
        let entry_metadata =
            fs::symlink_metadata(&entry_path).map_err(|_| "插件入口文件无法读取。".to_owned())?;
        if !entry_metadata.is_file()
            || is_reparse_point(&entry_metadata)
            || !path_is_within_case_insensitive(&entry_path, &plugin_root)
        {
            return Err("插件入口不是受管目录内的普通文件。".to_owned());
        }
        let node_metadata = fs::symlink_metadata(&args.node_path)
            .map_err(|_| "受信任的 Node.js 运行时无法读取。".to_owned())?;
        if !node_metadata.is_file()
            || is_reparse_point(&node_metadata)
            || !args
                .node_path
                .file_name()
                .is_some_and(|name| name.eq_ignore_ascii_case("node.exe"))
        {
            return Err("插件运行时必须是受信任的普通 node.exe 文件。".to_owned());
        }
        let node_path = fs::canonicalize(&args.node_path)
            .map_err(|_| "Node.js 运行时路径无法验证。".to_owned())?;
        Ok((data_root, plugin_root, entry_path, node_path))
    }

    fn grant_plugin_source_tree(
        path: &Path,
        sid: windows_sys::Win32::Security::PSID,
        seen: &mut usize,
    ) -> Result<(), String> {
        *seen += 1;
        if *seen > PLUGIN_MAX_FILES {
            return Err("插件源码文件数超过 AppContainer 权限准备上限。".to_owned());
        }
        let metadata = fs::symlink_metadata(path).map_err(|_| "插件源码树无法检查。".to_owned())?;
        if is_reparse_point(&metadata) {
            return Err("插件源码树含重解析点；拒绝授予沙盒访问。".to_owned());
        }
        if metadata.is_dir() {
            grant_access(path, sid, PLUGIN_READ_ACCESS, DIRECTORY_INHERITANCE)?;
            let entries = fs::read_dir(path).map_err(|_| "插件源码目录无法读取。".to_owned())?;
            for entry in entries {
                let entry = entry.map_err(|_| "插件源码目录项无法读取。".to_owned())?;
                grant_plugin_source_tree(&entry.path(), sid, seen)?;
            }
            Ok(())
        } else if metadata.is_file() {
            grant_access(path, sid, PLUGIN_READ_ACCESS, 0)
        } else {
            Err("插件源码含非普通文件对象；拒绝授予沙盒访问。".to_owned())
        }
    }

    fn prepare_plugin_container(
        plugin_root: &Path,
        node_path: &Path,
        sid: windows_sys::Win32::Security::PSID,
    ) -> Result<(), String> {
        let mut seen = 0;
        grant_plugin_source_tree(plugin_root, sid, &mut seen)?;
        for directory in plugin_volume_roots(plugin_root, node_path)? {
            grant_access(&directory, sid, PLUGIN_DIRECTORY_TRAVERSE, 0)?;
        }
        grant_access(node_path, sid, PLUGIN_READ_ACCESS, 0)?;
        Ok(())
    }

    fn forget_plugin_profile(args: &PluginForgetArgs) -> Result<(), String> {
        let data_root = fs::canonicalize(&args.data_root)
            .map_err(|_| "LFAA 插件数据根目录无法验证。".to_owned())?;
        let plugins_root = canonical_managed_directory(&data_root, "plugins")?;
        let profiles_root = canonical_managed_directory(&plugins_root, "profiles")?;
        let profile_root = canonical_managed_directory(&profiles_root, &args.profile)?;
        let plugin_root = canonical_managed_directory(&profile_root, &args.plugin_id)?;
        let node_metadata = fs::symlink_metadata(&args.node_path)
            .map_err(|_| "受信任的 Node.js 运行时无法读取。".to_owned())?;
        if !node_metadata.is_file()
            || is_reparse_point(&node_metadata)
            || !args
                .node_path
                .file_name()
                .is_some_and(|name| name.eq_ignore_ascii_case("node.exe"))
        {
            return Err("插件运行时必须是受信任的普通 node.exe 文件。".to_owned());
        }
        let node_path = fs::canonicalize(&args.node_path)
            .map_err(|_| "Node.js 运行时路径无法验证。".to_owned())?;
        let app_sid = plugin_app_container_sid(&args.profile, &args.plugin_id)?;
        let mut paths = Vec::new();
        collect_plugin_source_paths(&plugin_root, &mut paths)?;
        for path in paths.iter().rev() {
            revoke_access(path, app_sid.0)?;
        }
        revoke_access(&node_path, app_sid.0)?;
        for directory in plugin_volume_roots(&plugin_root, &node_path)? {
            revoke_access(&directory, app_sid.0)?;
        }
        let profile_name = wide(&plugin_container_name(&args.profile, &args.plugin_id));
        let result = unsafe { DeleteAppContainerProfile(profile_name.as_ptr()) };
        if result < 0 {
            return Err(format!(
                "无法删除插件 AppContainer 配置（HRESULT 0x{:08X}）。",
                result as u32
            ));
        }
        println!("{{\"backend\":\"{BACKEND_ID}\",\"pluginProfileRemoved\":true}}");
        Ok(())
    }

    fn collect_plugin_source_paths(root: &Path, paths: &mut Vec<PathBuf>) -> Result<(), String> {
        paths.push(root.to_owned());
        if paths.len() > PLUGIN_MAX_FILES {
            return Err("插件源码文件数超过 AppContainer 权限清理上限。".to_owned());
        }
        let metadata = fs::symlink_metadata(root).map_err(|_| "插件源码树无法检查。".to_owned())?;
        if is_reparse_point(&metadata) {
            return Err("插件源码树含重解析点；拒绝清理沙盒权限。".to_owned());
        }
        if metadata.is_dir() {
            let entries = fs::read_dir(root).map_err(|_| "插件源码目录无法读取。".to_owned())?;
            for entry in entries {
                let entry = entry.map_err(|_| "插件源码目录项无法读取。".to_owned())?;
                collect_plugin_source_paths(&entry.path(), paths)?;
            }
        } else if !metadata.is_file() {
            return Err("插件源码含非普通文件对象；拒绝清理沙盒权限。".to_owned());
        }
        Ok(())
    }

    fn plugin_volume_roots(plugin_root: &Path, node_path: &Path) -> Result<Vec<PathBuf>, String> {
        let mut roots = Vec::new();
        for path in [plugin_root, node_path] {
            let root = path
                .ancestors()
                .last()
                .ok_or_else(|| "插件运行路径缺少卷根目录。".to_owned())?;
            let metadata = fs::symlink_metadata(root)
                .map_err(|_| "插件运行路径的卷根目录无法检查。".to_owned())?;
            if !metadata.is_dir() || is_reparse_point(&metadata) {
                return Err("插件运行路径的卷根目录无效。".to_owned());
            }
            if !roots
                .iter()
                .any(|existing: &PathBuf| paths_equal_case_insensitive(existing, root))
            {
                roots.push(root.to_owned());
            }
        }
        Ok(roots)
    }

    fn create_plugin_job() -> Result<OwnedHandle, String> {
        let job = OwnedHandle(unsafe { CreateJobObjectW(null(), null()) });
        if !job.is_valid() {
            return Err("无法创建插件 Job Object。".to_owned());
        }
        let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            | JOB_OBJECT_LIMIT_ACTIVE_PROCESS
            | JOB_OBJECT_LIMIT_PROCESS_MEMORY;
        limits.BasicLimitInformation.ActiveProcessLimit = 1;
        limits.ProcessMemoryLimit = PLUGIN_MEMORY_LIMIT_MB * 1024 * 1024;
        let applied = unsafe {
            SetInformationJobObject(
                job.raw(),
                JobObjectExtendedLimitInformation,
                &limits as *const _ as *const c_void,
                size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
        };
        if applied == 0 {
            return Err("无法设置插件进程数与内存上限。".to_owned());
        }
        Ok(job)
    }

    fn build_plugin_command_line(node_path: &Path, entry_path: &Path) -> Vec<u16> {
        let arguments = [
            node_path.as_os_str().to_owned(),
            OsString::from("--preserve-symlinks-main"),
            entry_path.as_os_str().to_owned(),
        ];
        let command = arguments
            .iter()
            .map(|argument| quote_windows_argument(argument))
            .collect::<Vec<_>>()
            .join(" ");
        wide(&command)
    }

    fn sanitize_plugin_process_environment(
        node_path: &Path,
        profile: &str,
        plugin_id: &str,
    ) -> Result<(), String> {
        let system_root = std::env::var_os("SystemRoot")
            .or_else(|| std::env::var_os("WINDIR"))
            .ok_or_else(|| "Windows 系统目录未配置，拒绝启动第三方插件。".to_owned())?;
        let local_app_data = std::env::var_os("LOCALAPPDATA")
            .ok_or_else(|| "Windows 本地应用数据目录未配置，拒绝启动第三方插件。".to_owned())?;
        let environment = unsafe { GetEnvironmentStringsW() };
        if environment.is_null() {
            return Err("无法读取 Windows 环境变量以清理插件启动环境。".to_owned());
        }
        let mut names = Vec::<Vec<u16>>::new();
        let mut malformed = false;
        unsafe {
            let mut cursor = environment;
            while *cursor != 0 {
                let start = cursor;
                while *cursor != 0 {
                    cursor = cursor.add(1);
                }
                let length = cursor.offset_from(start) as usize;
                let entry = std::slice::from_raw_parts(start, length);
                // Windows 盘符当前目录项不是普通变量名；它们只包含路径且没有凭据。
                if entry.first() != Some(&(b'=' as u16)) {
                    if let Some(separator) = entry.iter().position(|unit| *unit == b'=' as u16) {
                        let name = String::from_utf16_lossy(&entry[..separator]);
                        if !PLUGIN_ENVIRONMENT_ALLOWLIST
                            .iter()
                            .any(|allowed| name.eq_ignore_ascii_case(allowed))
                        {
                            names.push(entry[..separator].to_vec());
                        }
                    } else {
                        malformed = true;
                        break;
                    }
                }
                cursor = cursor.add(1);
            }
            if FreeEnvironmentStringsW(environment) == 0 {
                return Err("无法释放 Windows 环境变量快照。".to_owned());
            }
        }
        if malformed {
            return Err("Windows 环境变量格式无效，拒绝启动第三方插件。".to_owned());
        }
        for mut name in names {
            name.push(0);
            if unsafe { SetEnvironmentVariableW(name.as_ptr(), null()) } == 0 {
                return Err("无法清除插件宿主继承的非白名单环境变量。".to_owned());
            }
        }
        let node_directory = node_path
            .parent()
            .ok_or_else(|| "Node.js 运行时目录无效。".to_owned())?;
        let system_bin = PathBuf::from(&system_root).join("System32");
        let path = format!(
            "{};{}",
            windows_process_path(node_directory).display(),
            system_bin.display()
        );
        set_process_environment("PATH", OsStr::new(&path))?;
        set_process_environment("SystemRoot", &system_root)?;
        set_process_environment("WINDIR", &system_root)?;
        set_process_environment("LOCALAPPDATA", &local_app_data)?;
        set_process_environment("LFAA_PLUGIN_PROFILE", OsStr::new(profile))?;
        set_process_environment("LFAA_PLUGIN_ID", OsStr::new(plugin_id))?;
        set_process_environment("LFAA_PLUGIN_PROTOCOL", OsStr::new("1"))?;
        Ok(())
    }

    fn set_process_environment(name: &str, value: &OsStr) -> Result<(), String> {
        let name = wide(name);
        let mut value = value.encode_wide().collect::<Vec<_>>();
        value.push(0);
        if unsafe { SetEnvironmentVariableW(name.as_ptr(), value.as_ptr()) } == 0 {
            return Err("无法设置受限的第三方插件环境变量。".to_owned());
        }
        Ok(())
    }

    fn launch_plugin(args: &PluginLaunchArgs) -> Result<(), String> {
        let (_data_root, plugin_root, entry_path, node_path) = validate_plugin_paths(args)?;
        let app_sid = plugin_app_container_sid(&args.profile, &args.plugin_id)?;
        prepare_plugin_container(&plugin_root, &node_path, app_sid.0)?;
        sanitize_plugin_process_environment(&node_path, &args.profile, &args.plugin_id)?;
        let capabilities = SECURITY_CAPABILITIES {
            AppContainerSid: app_sid.0,
            Capabilities: null_mut(),
            CapabilityCount: 0,
            Reserved: 0,
        };
        let job = create_plugin_job()?;
        let standard_handles = [
            unsafe { GetStdHandle(STD_INPUT_HANDLE) },
            unsafe { GetStdHandle(STD_OUTPUT_HANDLE) },
            unsafe { GetStdHandle(STD_ERROR_HANDLE) },
        ];
        if standard_handles
            .iter()
            .any(|handle| handle.is_null() || *handle == INVALID_HANDLE_VALUE)
        {
            return Err("插件沙盒的标准输入输出管道不可用。".to_owned());
        }
        for handle in standard_handles {
            if unsafe { SetHandleInformation(handle, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT) }
                == 0
            {
                return Err("无法将限定的插件标准输入输出句柄设为可继承。".to_owned());
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
        let process_node_path = windows_process_path(&node_path);
        let process_entry_path = windows_process_path(&entry_path);
        let mut command_line = build_plugin_command_line(&process_node_path, &process_entry_path);
        let node_path_wide = wide_os(process_node_path.as_os_str());
        let mut process_info = PROCESS_INFORMATION::default();
        let created = unsafe {
            windows_sys::Win32::System::Threading::CreateProcessW(
                node_path_wide.as_ptr(),
                command_line.as_mut_ptr(),
                null(),
                null(),
                1,
                CREATE_SUSPENDED | EXTENDED_STARTUPINFO_PRESENT,
                null(),
                null(),
                &startup.StartupInfo,
                &mut process_info,
            )
        };
        if created == 0 {
            let error = std::io::Error::last_os_error();
            return Err(format!(
                "Windows 无法在无网络 AppContainer 中创建插件 Node.js 进程（Win32 错误 {}: {error}）。",
                error.raw_os_error().unwrap_or_default(),
            ));
        }
        let process = OwnedHandle(process_info.hProcess);
        let thread_handle = OwnedHandle(process_info.hThread);
        if let Err(error) = verify_plugin_process_app_sid(process.raw(), app_sid.0) {
            unsafe {
                TerminateProcess(process.raw(), 1);
            }
            return Err(error);
        }
        if unsafe { AssignProcessToJobObject(job.raw(), process.raw()) } == 0 {
            unsafe {
                TerminateProcess(process.raw(), 1);
            }
            return Err("无法将第三方插件加入受限 Job Object。".to_owned());
        }
        if unsafe { ResumeThread(thread_handle.raw()) } == u32::MAX {
            unsafe {
                TerminateProcess(process.raw(), 1);
            }
            return Err("无法恢复受限的第三方插件进程。".to_owned());
        }
        write_plugin_ready_message(&args.readiness_token)?;
        if unsafe { WaitForSingleObject(process.raw(), u32::MAX) } != WAIT_OBJECT_0 {
            return Err("等待第三方插件进程结束时发生错误。".to_owned());
        }
        let mut exit_code = 1u32;
        if unsafe { GetExitCodeProcess(process.raw(), &mut exit_code) } == 0 {
            return Err("无法读取第三方插件退出状态。".to_owned());
        }
        if exit_code != 0 {
            return Err(format!("第三方插件进程退出（代码 {exit_code}）。"));
        }
        Ok(())
    }

    fn verify_plugin_process_app_sid(
        process: HANDLE,
        expected_sid: windows_sys::Win32::Security::PSID,
    ) -> Result<(), String> {
        let mut token = null_mut();
        if unsafe { OpenProcessToken(process, TOKEN_QUERY, &mut token) } == 0 {
            return Err("无法检查插件 AppContainer 进程令牌。".to_owned());
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
            return Err("插件进程没有可验证的 AppContainer SID。".to_owned());
        }
        let mut information = vec![0usize; (required as usize).div_ceil(size_of::<usize>())];
        if unsafe {
            windows_sys::Win32::Security::GetTokenInformation(
                token.raw(),
                TokenAppContainerSid,
                information.as_mut_ptr().cast::<c_void>(),
                required,
                &mut required,
            )
        } == 0
        {
            return Err("无法读取插件进程的 AppContainer SID。".to_owned());
        }
        let actual_sid = unsafe {
            (*(information
                .as_ptr()
                .cast::<TOKEN_APPCONTAINER_INFORMATION>()))
            .TokenAppContainer
        };
        if actual_sid.is_null() || unsafe { EqualSid(actual_sid, expected_sid) } == 0 {
            return Err("插件进程令牌 SID 与当前隔离配置不匹配。".to_owned());
        }
        Ok(())
    }

    fn write_plugin_ready_message(token: &str) -> Result<(), String> {
        let handle = unsafe { GetStdHandle(STD_ERROR_HANDLE) };
        if handle.is_null() || handle == INVALID_HANDLE_VALUE {
            return Err("插件沙盒启动确认通道不可用。".to_owned());
        }
        let message = format!("{PLUGIN_READY_PREFIX}{token}\u{1e}\n");
        std::io::stderr()
            .write_all(message.as_bytes())
            .map_err(|_| "插件沙盒启动确认通道不可用。".to_owned())?;
        std::io::stderr()
            .flush()
            .map_err(|_| "插件沙盒启动确认通道不可用。".to_owned())
    }

    fn validated_paths(args: &LaunchArgs) -> Result<(PathBuf, PathBuf, PathBuf, PathBuf), String> {
        let data_root = fs::canonicalize(&args.data_root)
            .map_err(|_| "LFAA 数据根目录无法验证。".to_owned())?;
        if !data_root.is_dir() {
            return Err("LFAA 数据根目录不是目录。".to_owned());
        }

        // 沙盒按任务记录的节点相对目录定位实例，并逐级拒绝目录联接等重解析点。
        let configured_storage = Path::new(&args.instance_storage);
        let mut storage_path = data_root.clone();
        for segment in args.instance_storage.split('/') {
            storage_path.push(segment);
            let metadata = fs::symlink_metadata(&storage_path)
                .map_err(|_| "Minecraft 实例根目录无法验证。".to_owned())?;
            if !metadata.is_dir() || is_reparse_point(&metadata) {
                return Err("Minecraft 实例根目录不能包含重解析点或非目录路径。".to_owned());
            }
        }
        let minecraft_root = fs::canonicalize(data_root.join(configured_storage))
            .map_err(|_| "Minecraft 实例根目录无法验证。".to_owned())?;
        if !minecraft_root.starts_with(&data_root)
            || minecraft_root == data_root
            || !minecraft_root.is_dir()
        {
            return Err("Minecraft 实例根目录越过 LFAA 数据目录。".to_owned());
        }
        let expected_instance = minecraft_root.join(&args.instance_name);
        let expected_instance_metadata = fs::symlink_metadata(&expected_instance)
            .map_err(|_| "Minecraft 实例目录无法验证。".to_owned())?;
        if !expected_instance_metadata.is_dir() || is_reparse_point(&expected_instance_metadata) {
            return Err("Minecraft 实例路径不能是重解析点或非目录路径。".to_owned());
        }
        let instance_directory = fs::canonicalize(&expected_instance)
            .map_err(|_| "Minecraft 实例目录无法验证。".to_owned())?;
        if instance_directory.parent() != Some(minecraft_root.as_path())
            || !instance_directory.is_dir()
        {
            return Err("Minecraft 实例目录越过受管数据根目录。".to_owned());
        }

        let environments_root = fs::canonicalize(data_root.join("environments"))
            .map_err(|_| "LFAA 运行环境目录无法验证。".to_owned())?;
        if environments_root.parent() != Some(data_root.as_path()) || !environments_root.is_dir() {
            return Err("LFAA 运行环境目录越过数据根目录。".to_owned());
        }
        let managed_java_root = fs::canonicalize(environments_root.join("java"))
            .map_err(|_| "LFAA 受管 Java 根目录无法验证。".to_owned())?;
        if managed_java_root.parent() != Some(environments_root.as_path())
            || !managed_java_root.is_dir()
        {
            return Err("LFAA 受管 Java 根目录越过运行环境目录。".to_owned());
        }
        let java_root_metadata = fs::symlink_metadata(&args.java_root)
            .map_err(|_| "Java 运行目录无法验证。".to_owned())?;
        if !java_root_metadata.is_dir() || is_reparse_point(&java_root_metadata) {
            return Err("Java 运行目录不能是重解析点或非目录路径。".to_owned());
        }
        let java_root =
            fs::canonicalize(&args.java_root).map_err(|_| "Java 运行目录无法验证。".to_owned())?;
        let is_managed_java = !paths_equal_case_insensitive(&java_root, &managed_java_root)
            && path_is_within_case_insensitive(&java_root, &managed_java_root);
        let has_volume_child = java_root
            .components()
            .any(|component| matches!(component, std::path::Component::Normal(_)));
        // AppContainer 只获准读取实际 Java 安装目录，不能借外部 Java 路径触及 LFAA 数据或实例目录。
        let overlaps_data_root = path_is_within_case_insensitive(&java_root, &data_root)
            || path_is_within_case_insensitive(&data_root, &java_root);
        let overlaps_instance = path_is_within_case_insensitive(&java_root, &instance_directory)
            || path_is_within_case_insensitive(&instance_directory, &java_root);
        if !java_root.is_dir()
            || !has_volume_child
            || (!is_managed_java && overlaps_data_root)
            || overlaps_instance
        {
            return Err("Java 运行目录范围过大或与 Minecraft 实例目录重叠。".to_owned());
        }
        let java_path = fs::canonicalize(&args.java_path)
            .map_err(|_| "Java 可执行文件无法验证。".to_owned())?;
        let java_metadata =
            fs::symlink_metadata(&java_path).map_err(|_| "Java 可执行文件无法验证。".to_owned())?;
        if !java_metadata.is_file()
            || is_reparse_point(&java_metadata)
            || !path_is_within_case_insensitive(&java_path, &java_root)
            || java_path
                .parent()
                .and_then(Path::file_name)
                .is_none_or(|name| !name.eq_ignore_ascii_case("bin"))
            || java_path.parent().and_then(Path::parent) != Some(java_root.as_path())
            || !java_path
                .file_name()
                .is_some_and(|name| name.eq_ignore_ascii_case("java.exe"))
        {
            return Err("Minecraft Java 可执行文件不在所选运行目录内。".to_owned());
        }
        Ok((data_root, instance_directory, java_root, managed_java_root))
    }

    fn is_reparse_point(metadata: &fs::Metadata) -> bool {
        use std::os::windows::fs::MetadataExt;
        metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
    }

    fn path_is_within_case_insensitive(path: &Path, root: &Path) -> bool {
        let mut path_components = path.components();
        root.components().all(|root_component| {
            path_components.next().is_some_and(|path_component| {
                path_component.as_os_str().to_string_lossy().to_lowercase()
                    == root_component.as_os_str().to_string_lossy().to_lowercase()
            })
        })
    }

    fn paths_equal_case_insensitive(left: &Path, right: &Path) -> bool {
        path_is_within_case_insensitive(left, right) && path_is_within_case_insensitive(right, left)
    }

    fn prepare_instance(args: &LaunchArgs) -> Result<(), String> {
        let (data_root, instance_directory, java_root, managed_java_root) = validated_paths(args)?;
        let profile_sid = app_container_sid(&args.instance_id)?;
        fs::create_dir_all(instance_directory.join(".lfaa-tmp"))
            .map_err(|_| "无法创建 Minecraft 沙盒临时目录。".to_owned())?;

        grant_access(
            &instance_directory,
            profile_sid.0,
            INSTANCE_WRITE_ACCESS,
            DIRECTORY_INHERITANCE,
        )?;
        set_low_integrity_label(&instance_directory)?;
        if let Some(previous_java_root) = args.previous_java_root.as_ref() {
            if previous_java_root.exists() {
                let previous_metadata = fs::symlink_metadata(previous_java_root)
                    .map_err(|_| "旧 Java 运行目录无法验证。".to_owned())?;
                if !previous_metadata.is_dir() || is_reparse_point(&previous_metadata) {
                    return Err("旧 Java 运行目录不能是重解析点或非目录路径。".to_owned());
                }
                let previous_java_root = fs::canonicalize(previous_java_root)
                    .map_err(|_| "旧 Java 运行目录无法验证。".to_owned())?;
                if !paths_equal_case_insensitive(&previous_java_root, &java_root) {
                    let has_volume_child = previous_java_root
                        .components()
                        .any(|component| matches!(component, std::path::Component::Normal(_)));
                    let previous_is_managed_java =
                        !paths_equal_case_insensitive(&previous_java_root, &managed_java_root)
                            && path_is_within_case_insensitive(
                                &previous_java_root,
                                &managed_java_root,
                            );
                    let overlaps_data_root =
                        path_is_within_case_insensitive(&data_root, &previous_java_root)
                            || path_is_within_case_insensitive(&previous_java_root, &data_root);
                    if !has_volume_child
                        || (!previous_is_managed_java && overlaps_data_root)
                        || path_is_within_case_insensitive(&previous_java_root, &instance_directory)
                        || path_is_within_case_insensitive(&instance_directory, &previous_java_root)
                    {
                        return Err(
                            "旧 Java 运行目录范围过大或与 Minecraft 实例目录重叠。".to_owned()
                        );
                    }
                    revoke_access(&previous_java_root, profile_sid.0)?;
                }
            }
        }
        grant_access(
            &java_root,
            profile_sid.0,
            JAVA_READ_ACCESS,
            DIRECTORY_INHERITANCE,
        )?;
        Ok(())
    }

    fn grant_access(
        path: &Path,
        sid: windows_sys::Win32::Security::PSID,
        access: u32,
        inheritance: u32,
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
            return Err("无法读取沙盒目标目录 ACL。".to_owned());
        }

        let entry = EXPLICIT_ACCESS_W {
            grfAccessPermissions: access,
            grfAccessMode: GRANT_ACCESS,
            grfInheritance: inheritance,
            Trustee: windows_sys::Win32::Security::Authorization::TRUSTEE_W {
                pMultipleTrustee: null_mut(),
                MultipleTrusteeOperation: 0,
                TrusteeForm: TRUSTEE_IS_SID,
                TrusteeType: TRUSTEE_IS_USER,
                ptstrName: sid as *mut u16,
            },
        };
        let mut new_dacl = null_mut();
        let acl_result = unsafe { SetEntriesInAclW(1, &entry, old_dacl, &mut new_dacl) };
        let _new_dacl = LocalAllocation(new_dacl as *mut c_void);
        if acl_result != ERROR_SUCCESS {
            return Err("无法创建沙盒目标目录 ACL。".to_owned());
        }
        let apply_result = unsafe {
            SetNamedSecurityInfoW(
                path_wide.as_ptr(),
                SE_FILE_OBJECT,
                DACL_SECURITY_INFORMATION,
                null_mut(),
                null_mut(),
                new_dacl,
                null_mut(),
            )
        };
        if apply_result != ERROR_SUCCESS {
            return Err("无法应用沙盒目标目录 ACL。".to_owned());
        }
        Ok(())
    }

    fn revoke_access(path: &Path, sid: windows_sys::Win32::Security::PSID) -> Result<(), String> {
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
            return Err("无法读取旧 Java 目录的沙盒 ACL。".to_owned());
        }

        let entry = EXPLICIT_ACCESS_W {
            grfAccessPermissions: 0,
            grfAccessMode: REVOKE_ACCESS,
            grfInheritance: 0,
            Trustee: windows_sys::Win32::Security::Authorization::TRUSTEE_W {
                pMultipleTrustee: null_mut(),
                MultipleTrusteeOperation: 0,
                TrusteeForm: TRUSTEE_IS_SID,
                TrusteeType: TRUSTEE_IS_USER,
                ptstrName: sid as *mut u16,
            },
        };
        let mut new_dacl = null_mut();
        let acl_result = unsafe { SetEntriesInAclW(1, &entry, old_dacl, &mut new_dacl) };
        let _new_dacl = LocalAllocation(new_dacl as *mut c_void);
        if acl_result != ERROR_SUCCESS || new_dacl.is_null() {
            return Err("无法安全移除旧 Java 目录的沙盒 ACL。".to_owned());
        }
        let apply_result = unsafe {
            SetNamedSecurityInfoW(
                path_wide.as_ptr(),
                SE_FILE_OBJECT,
                DACL_SECURITY_INFORMATION,
                null_mut(),
                null_mut(),
                new_dacl,
                null_mut(),
            )
        };
        if apply_result != ERROR_SUCCESS {
            return Err("无法移除旧 Java 目录的沙盒 ACL。".to_owned());
        }
        Ok(())
    }

    fn set_low_integrity_label(path: &Path) -> Result<(), String> {
        let sddl = wide("S:(ML;OICI;NW;;;LW)");
        let mut descriptor = null_mut();
        let converted = unsafe {
            windows_sys::Win32::Security::Authorization::ConvertStringSecurityDescriptorToSecurityDescriptorW(
                sddl.as_ptr(), 1, &mut descriptor, null_mut(),
            )
        };
        let _descriptor = LocalAllocation(descriptor);
        if converted == 0 || descriptor.is_null() {
            return Err("无法创建 Minecraft 沙盒低完整性标签。".to_owned());
        }

        let mut sacl_present = 0;
        let mut sacl_defaulted = 0;
        let mut sacl = null_mut();
        let read_sacl = unsafe {
            GetSecurityDescriptorSacl(
                descriptor,
                &mut sacl_present,
                &mut sacl,
                &mut sacl_defaulted,
            )
        };
        if read_sacl == 0 || sacl_present == 0 || sacl.is_null() {
            return Err("Minecraft 沙盒低完整性标签无效。".to_owned());
        }

        let path_wide = wide_os(path.as_os_str());
        let applied = unsafe {
            SetNamedSecurityInfoW(
                path_wide.as_ptr(),
                SE_FILE_OBJECT,
                LABEL_SECURITY_INFORMATION,
                null_mut(),
                null_mut(),
                null_mut(),
                sacl,
            )
        };
        if applied != ERROR_SUCCESS {
            return Err("无法为 Minecraft 实例目录应用低完整性标签。".to_owned());
        }
        Ok(())
    }

    fn launch_instance(args: &LaunchArgs) -> Result<(), String> {
        let (data_root, instance_directory, _java_root, _) = validated_paths(args)?;
        let environments_root = fs::canonicalize(data_root.join("environments"))
            .map_err(|_| "LFAA 运行环境目录无法验证。".to_owned())?;
        let sandbox_root = fs::canonicalize(environments_root.join("sandbox"))
            .map_err(|_| "Minecraft 沙盒状态目录无法验证。".to_owned())?;
        if sandbox_root.parent() != Some(environments_root.as_path()) || !sandbox_root.is_dir() {
            return Err("Minecraft 沙盒状态目录越过 LFAA 运行环境目录。".to_owned());
        }
        let sandbox_metadata_root = fs::canonicalize(sandbox_root.join(APP_ID))
            .map_err(|_| "Minecraft 沙盒元数据目录无法验证。".to_owned())?;
        if sandbox_metadata_root.parent() != Some(sandbox_root.as_path())
            || !sandbox_metadata_root.is_dir()
        {
            return Err("Minecraft 沙盒元数据目录越过受管路径。".to_owned());
        }
        let metadata_path = sandbox_metadata_root.join(format!("{}.json", args.instance_id));
        let metadata_file = fs::symlink_metadata(&metadata_path)
            .map_err(|_| "Minecraft 实例沙盒尚未准备，拒绝启动 Java。".to_owned())?;
        if !metadata_file.is_file() || is_reparse_point(&metadata_file) {
            return Err("Minecraft 沙盒准备记录不是普通文件。".to_owned());
        }
        let metadata = fs::read_to_string(metadata_path)
            .map_err(|_| "Minecraft 实例沙盒尚未准备，拒绝启动 Java。".to_owned())?;
        let expected_java_root = format!(
            "\"javaRootPath\":\"{}\"",
            json_escape(&args.java_root.to_string_lossy())
        )
        .to_lowercase();
        if !metadata.contains("\"version\":2")
            || !metadata.contains(&format!("\"backend\":\"{BACKEND_ID}\""))
            || !metadata.contains(&format!("\"appId\":\"{APP_ID}\""))
            || !metadata.contains(&format!("\"instanceId\":\"{}\"", args.instance_id))
            // Daemon 保存 realpath 原文；Rust canonicalize 可能额外添加 Windows 扩展路径前缀。
            || !metadata.to_lowercase().contains(&expected_java_root)
        {
            return Err("Minecraft 实例沙盒准备记录与当前运行环境不匹配。".to_owned());
        }
        let readiness_token = args
            .readiness_token
            .as_deref()
            .ok_or_else(|| "沙盒启动确认令牌缺失。".to_owned())?;
        let app_sid = app_container_sid(&args.instance_id)?;
        let capability_allocations = derive_network_capabilities()?;
        let capability_entries = capability_allocations
            .iter()
            .map(|sid| SID_AND_ATTRIBUTES {
                Sid: sid.0,
                Attributes: SE_GROUP_ENABLED as u32,
            })
            .collect::<Vec<_>>();
        let capabilities = SECURITY_CAPABILITIES {
            AppContainerSid: app_sid.0,
            Capabilities: capability_entries.as_ptr() as *mut SID_AND_ATTRIBUTES,
            CapabilityCount: capability_entries.len() as u32,
            Reserved: 0,
        };

        let job = create_limited_job(args.memory_mb)?;
        let pipes = create_child_pipes()?;
        let attributes = create_attribute_list(
            &capabilities,
            &[
                pipes.stdin_read.raw(),
                pipes.stdout_write.raw(),
                pipes.stderr_write.raw(),
            ],
        )?;
        let mut startup = STARTUPINFOEXW::default();
        startup.StartupInfo.cb = size_of::<STARTUPINFOEXW>() as u32;
        startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
        startup.StartupInfo.hStdInput = pipes.stdin_read.raw();
        startup.StartupInfo.hStdOutput = pipes.stdout_write.raw();
        startup.StartupInfo.hStdError = pipes.stderr_write.raw();
        startup.lpAttributeList = attributes.raw;

        let mut environment = build_environment(&args.java_path, &instance_directory)?;
        let mut command_line =
            build_java_command_line(&args.java_path, &instance_directory, args.memory_mb);
        let java_path_wide = wide_os(args.java_path.as_os_str());
        let cwd_wide = wide_os(instance_directory.as_os_str());
        let mut process_info = PROCESS_INFORMATION::default();
        let created = unsafe {
            windows_sys::Win32::System::Threading::CreateProcessW(
                java_path_wide.as_ptr(),
                command_line.as_mut_ptr(),
                null(),
                null(),
                1,
                CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT | EXTENDED_STARTUPINFO_PRESENT,
                environment.as_mut_ptr() as *const c_void,
                cwd_wide.as_ptr(),
                &startup.StartupInfo,
                &mut process_info,
            )
        };
        if created == 0 {
            let error = std::io::Error::last_os_error();
            let code = error.raw_os_error().unwrap_or_default();
            return Err(format!(
                "Windows 无法在 AppContainer 中创建 Java 进程（Win32 错误 {code}: {error}）。"
            ));
        }
        let process = OwnedHandle(process_info.hProcess);
        let thread_handle = OwnedHandle(process_info.hThread);

        drop(pipes.stdin_read);
        drop(pipes.stdout_write);
        drop(pipes.stderr_write);
        if unsafe { AssignProcessToJobObject(job.raw(), process.raw()) } == 0 {
            unsafe {
                TerminateProcess(process.raw(), 1);
            }
            return Err("无法将 Minecraft Java 进程加入受限 Job Object。".to_owned());
        }
        if unsafe { ResumeThread(thread_handle.raw()) } == u32::MAX {
            unsafe {
                TerminateProcess(process.raw(), 1);
            }
            return Err("无法恢复受限的 Minecraft Java 进程。".to_owned());
        }

        let stdin_writer = unsafe { File::from_raw_handle(pipes.stdin_write.into_raw_handle()) };
        let stdout_reader = unsafe { File::from_raw_handle(pipes.stdout_read.into_raw_handle()) };
        let stderr_reader = unsafe { File::from_raw_handle(pipes.stderr_read.into_raw_handle()) };
        thread::spawn(move || forward_stdin(stdin_writer));
        let stdout_thread = thread::spawn(move || forward_output(stdout_reader, false));
        let stderr_thread = thread::spawn(move || forward_output(stderr_reader, true));

        write_ready_message(readiness_token)?;
        let wait_result = unsafe { WaitForSingleObject(process.raw(), u32::MAX) };
        if wait_result != WAIT_OBJECT_0 {
            return Err("等待 Minecraft Java 进程结束时发生错误。".to_owned());
        }
        let mut exit_code = 1u32;
        if unsafe { GetExitCodeProcess(process.raw(), &mut exit_code) } == 0 {
            return Err("无法读取 Minecraft Java 进程的退出状态。".to_owned());
        }
        let _ = stdout_thread.join();
        let _ = stderr_thread.join();
        if exit_code != 0 {
            return Err(format!("Minecraft Java 进程退出（代码 {exit_code}）。"));
        }
        Ok(())
    }

    fn create_limited_job(memory_mb: u32) -> Result<OwnedHandle, String> {
        let job = OwnedHandle(unsafe { CreateJobObjectW(null(), null()) });
        if !job.is_valid() {
            return Err("无法创建 Minecraft Job Object。".to_owned());
        }
        let process_limit_mb = memory_mb.saturating_add((memory_mb / 2).max(512));
        let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            | JOB_OBJECT_LIMIT_ACTIVE_PROCESS
            | JOB_OBJECT_LIMIT_PROCESS_MEMORY;
        limits.BasicLimitInformation.ActiveProcessLimit = 1;
        limits.ProcessMemoryLimit = process_limit_mb as usize * 1024 * 1024;
        let applied = unsafe {
            SetInformationJobObject(
                job.raw(),
                JobObjectExtendedLimitInformation,
                &limits as *const _ as *const c_void,
                size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
        };
        if applied == 0 {
            return Err("无法设置 Minecraft Job Object 进程与内存限制。".to_owned());
        }
        Ok(job)
    }

    fn create_child_pipes() -> Result<PipeSet, String> {
        let mut attributes = SECURITY_ATTRIBUTES {
            nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: null_mut(),
            bInheritHandle: 1,
        };
        let (stdin_read, stdin_write) = create_pipe_pair(&mut attributes)?;
        let (stdout_read, stdout_write) = create_pipe_pair(&mut attributes)?;
        let (stderr_read, stderr_write) = create_pipe_pair(&mut attributes)?;

        set_noninheritable(stdin_write.raw())?;
        set_noninheritable(stdout_read.raw())?;
        set_noninheritable(stderr_read.raw())?;
        Ok(PipeSet {
            stdin_read,
            stdin_write,
            stdout_read,
            stdout_write,
            stderr_read,
            stderr_write,
        })
    }

    fn create_pipe_pair(
        attributes: &mut SECURITY_ATTRIBUTES,
    ) -> Result<(OwnedHandle, OwnedHandle), String> {
        let mut read = null_mut();
        let mut write = null_mut();
        if unsafe { CreatePipe(&mut read, &mut write, attributes, 0) } == 0 {
            return Err("无法建立 Minecraft 控制台隔离管道。".to_owned());
        }
        Ok((OwnedHandle(read), OwnedHandle(write)))
    }

    fn set_noninheritable(handle: HANDLE) -> Result<(), String> {
        if unsafe { SetHandleInformation(handle, HANDLE_FLAG_INHERIT, 0) } == 0 {
            return Err("无法限制 Minecraft 控制台句柄继承范围。".to_owned());
        }
        Ok(())
    }

    fn create_attribute_list(
        capabilities: &SECURITY_CAPABILITIES,
        handles: &[HANDLE],
    ) -> Result<ProcAttributeList, String> {
        let attribute_count = if handles.is_empty() { 1 } else { 2 };
        let mut required_bytes = 0usize;
        unsafe {
            InitializeProcThreadAttributeList(null_mut(), attribute_count, 0, &mut required_bytes);
        }
        if required_bytes == 0 {
            return Err("无法初始化 AppContainer 进程属性。".to_owned());
        }
        let mut storage = vec![0usize; required_bytes.div_ceil(size_of::<usize>())];
        let list = storage.as_mut_ptr().cast::<c_void>();
        if unsafe {
            InitializeProcThreadAttributeList(list, attribute_count, 0, &mut required_bytes)
        } == 0
        {
            return Err("无法初始化 AppContainer 进程属性。".to_owned());
        }
        let attribute_list = ProcAttributeList {
            _storage: storage,
            raw: list,
        };
        let security_added = unsafe {
            UpdateProcThreadAttribute(
                list,
                0,
                PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES as usize,
                capabilities as *const _ as *const c_void,
                size_of::<SECURITY_CAPABILITIES>(),
                null_mut(),
                null(),
            )
        };
        if security_added == 0 {
            return Err("Windows 拒绝设置 AppContainer 安全能力。".to_owned());
        }
        if !handles.is_empty()
            && unsafe {
                UpdateProcThreadAttribute(
                    list,
                    0,
                    PROC_THREAD_ATTRIBUTE_HANDLE_LIST as usize,
                    handles.as_ptr() as *const c_void,
                    std::mem::size_of_val(handles),
                    null_mut(),
                    null(),
                )
            } == 0
        {
            return Err("Windows 拒绝设置 Minecraft 控制台句柄白名单。".to_owned());
        }
        Ok(attribute_list)
    }

    fn build_environment(java_path: &Path, instance_directory: &Path) -> Result<Vec<u16>, String> {
        let system_root = std::env::var_os("SystemRoot")
            .or_else(|| std::env::var_os("WINDIR"))
            .ok_or_else(|| "Windows 系统目录未配置，拒绝继承 Daemon 环境。".to_owned())?;
        let java_bin = java_path
            .parent()
            .ok_or_else(|| "Java 运行目录无效。".to_owned())?;
        let system_bin = PathBuf::from(&system_root).join("System32");
        let path = format!("{};{}", java_bin.display(), system_bin.display());
        let temporary = instance_directory.join(".lfaa-tmp").display().to_string();
        let mut entries: Vec<Vec<u16>> = [
            format!("PATH={path}"),
            format!("SystemRoot={}", system_root.to_string_lossy()),
            format!("TEMP={temporary}"),
            format!("TMP={temporary}"),
            format!("WINDIR={}", system_root.to_string_lossy()),
        ]
        .into_iter()
        .map(|entry| entry.encode_utf16().collect())
        .collect();
        // 自定义环境块不会自动携带 Windows 盘符当前目录；仅复制 =X: 项，避免继承 Daemon 密钥。
        let mut drive_entries = inherited_drive_current_directories()?;
        if let Some(entry) = drive_current_directory_entry(instance_directory) {
            if let Some(current_drive) = drive_environment_letter(&entry) {
                // 该子进程的工作目录是实例目录，覆盖 Daemon 对同一盘符的旧工作目录。
                drive_entries
                    .retain(|candidate| drive_environment_letter(candidate) != Some(current_drive));
            }
            drive_entries.push(entry);
        }
        entries.extend(drive_entries);
        // Windows 按不区分大小写的 Unicode 顺序读取自定义环境块；受控变量名均为 ASCII。
        entries.sort_by_cached_key(|entry| environment_sort_key(entry));
        let mut block = Vec::new();
        for entry in entries {
            block.extend(entry);
            block.push(0);
        }
        // 每项追加一个 NUL；额外的 NUL 结束整个 Unicode 环境块。
        block.push(0);
        Ok(block)
    }

    fn inherited_drive_current_directories() -> Result<Vec<Vec<u16>>, String> {
        // 从 Windows 原始环境块仅筛选特殊盘符项，不复制其他进程环境变量。
        let environment = unsafe { GetEnvironmentStringsW() };
        if environment.is_null() {
            return Err("无法读取 Windows 驱动器当前目录环境项。".to_owned());
        }

        let mut entries = Vec::new();
        unsafe {
            let mut cursor = environment;
            while *cursor != 0 {
                let start = cursor;
                while *cursor != 0 {
                    cursor = cursor.add(1);
                }
                let length = cursor.offset_from(start) as usize;
                let entry = std::slice::from_raw_parts(start, length);
                if drive_environment_letter(entry).is_some() {
                    entries.push(entry.to_vec());
                }
                cursor = cursor.add(1);
            }
            if FreeEnvironmentStringsW(environment) == 0 {
                return Err("无法释放 Windows 驱动器环境块。".to_owned());
            }
        }
        Ok(entries)
    }

    fn drive_environment_letter(entry: &[u16]) -> Option<u16> {
        if entry.len() < 4
            || entry[0] != b'=' as u16
            || entry[2] != b':' as u16
            || entry[3] != b'=' as u16
        {
            return None;
        }
        let letter = entry[1];
        match letter {
            value if (b'A' as u16..=b'Z' as u16).contains(&value) => Some(value + 32),
            value if (b'a' as u16..=b'z' as u16).contains(&value) => Some(value),
            _ => None,
        }
    }

    fn environment_sort_key(entry: &[u16]) -> Vec<u16> {
        let name_end = if entry.first() == Some(&(b'=' as u16)) {
            entry
                .iter()
                .enumerate()
                .skip(1)
                .find_map(|(index, value)| (*value == b'=' as u16).then_some(index))
        } else {
            entry.iter().position(|value| *value == b'=' as u16)
        }
        .unwrap_or(entry.len());
        entry[..name_end]
            .iter()
            .map(|value| match value {
                upper if (b'A' as u16..=b'Z' as u16).contains(upper) => upper + 32,
                _ => *value,
            })
            .collect()
    }

    fn drive_current_directory_entry(directory: &Path) -> Option<Vec<u16>> {
        let prefix = match directory.components().next()? {
            Component::Prefix(prefix) => prefix.kind(),
            _ => return None,
        };
        let drive = match prefix {
            Prefix::Disk(letter) | Prefix::VerbatimDisk(letter) => letter.to_ascii_uppercase(),
            _ => return None,
        };
        let mut path = directory.as_os_str().encode_wide().collect::<Vec<_>>();
        let verbatim_prefix = [b'\\' as u16, b'\\' as u16, b'?' as u16, b'\\' as u16];
        if path.starts_with(&verbatim_prefix) {
            path.drain(..verbatim_prefix.len());
        }
        let mut entry = vec![b'=' as u16, u16::from(drive), b':' as u16, b'=' as u16];
        entry.extend(path);
        Some(entry)
    }

    fn windows_process_path(path: &Path) -> PathBuf {
        let text = path.as_os_str().to_string_lossy();
        match text.strip_prefix(r"\\?\") {
            Some(normalized) if normalized.as_bytes().get(1) == Some(&b':') => {
                PathBuf::from(normalized)
            }
            _ => path.to_owned(),
        }
    }

    fn build_java_command_line(
        java_path: &Path,
        instance_directory: &Path,
        memory_mb: u32,
    ) -> Vec<u16> {
        let minimum_heap = 1024u32.min(memory_mb / 2);
        let jar = instance_directory.join("server.jar");
        let arguments = [
            java_path.as_os_str().to_owned(),
            OsString::from(format!("-Xms{minimum_heap}M")),
            OsString::from(format!("-Xmx{memory_mb}M")),
            OsString::from("-jar"),
            jar.into_os_string(),
            OsString::from("nogui"),
        ];
        let command = arguments
            .iter()
            .map(|argument| quote_windows_argument(argument))
            .collect::<Vec<_>>()
            .join(" ");
        wide(&command)
    }

    fn quote_windows_argument(argument: &OsStr) -> String {
        let text = argument.to_string_lossy();
        let mut result = String::from("\"");
        let mut backslashes = 0usize;
        for character in text.chars() {
            if character == '\\' {
                backslashes += 1;
            } else if character == '"' {
                result.push_str(&"\\".repeat(backslashes * 2 + 1));
                result.push(character);
                backslashes = 0;
            } else {
                result.push_str(&"\\".repeat(backslashes));
                result.push(character);
                backslashes = 0;
            }
        }
        result.push_str(&"\\".repeat(backslashes * 2));
        result.push('"');
        result
    }

    fn forward_stdin(mut child_stdin: File) {
        let mut input = std::io::stdin();
        let mut buffer = [0u8; 4096];
        loop {
            match input.read(&mut buffer) {
                Ok(0) => {
                    let _ = child_stdin.write_all(b"stop\n");
                    let _ = child_stdin.flush();
                    break;
                }
                Ok(count) => {
                    if child_stdin.write_all(&buffer[..count]).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    }

    fn forward_output(mut source: File, is_error: bool) {
        let mut buffer = [0u8; 16 * 1024];
        let mut output_open = true;
        loop {
            match source.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(count) if output_open => {
                    let result = if is_error {
                        std::io::stderr().write_all(&buffer[..count])
                    } else {
                        std::io::stdout().write_all(&buffer[..count])
                    };
                    output_open = result.is_ok();
                }
                Ok(_) => {}
            }
        }
    }

    fn write_ready_message(token: &str) -> Result<(), String> {
        let handle = unsafe { GetStdHandle(STD_ERROR_HANDLE) };
        if handle.is_null() || handle == INVALID_HANDLE_VALUE {
            return Err("Daemon 沙盒控制通道不可用。".to_owned());
        }
        let message = format!("{SANDBOX_READY_PREFIX}{token}\u{1e}\n");
        std::io::stderr()
            .write_all(message.as_bytes())
            .map_err(|_| "Daemon 沙盒控制通道不可用。".to_owned())?;
        std::io::stderr()
            .flush()
            .map_err(|_| "Daemon 沙盒控制通道不可用。".to_owned())
    }

    fn json_escape(value: &str) -> String {
        value.replace('\\', "\\\\").replace('"', "\\\"")
    }

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn wide_os(value: &OsStr) -> Vec<u16> {
        value.encode_wide().chain(std::iter::once(0)).collect()
    }
}

#[cfg(windows)]
fn main() {
    if let Err(error) = windows_host::main() {
        eprintln!("LFAA Sandbox Host：{error}");
        std::process::exit(1);
    }
}

#[cfg(not(windows))]
fn main() {
    eprintln!("LFAA Sandbox Host 当前只支持 Windows x64。");
    std::process::exit(1);
}
