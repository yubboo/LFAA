/*
 * 功能：创建 Minecraft 实例专属的 Windows AppContainer 进程。
 * 作用：由本机 Daemon 调用，校验固定实例与受管理 Java 路径，只授予实例目录读写、Java 运行目录只读执行和明确网络能力，并用 Job Object 管理进程生命周期。
 * 关联文件：daemon/src/task-runner/minecraft-daemon.mjs、daemon/package.json、docs/PROMPTS.md。
 */
#[cfg(windows)]
mod windows_host {
    use std::ffi::{OsStr, OsString, c_void};
    use std::fs::{self, File};
    use std::io::{Read, Write};
    use std::mem::size_of;
    use std::os::windows::ffi::OsStrExt;
    use std::os::windows::io::{FromRawHandle, IntoRawHandle, RawHandle};
    use std::path::{Path, PathBuf};
    use std::ptr::{null, null_mut};
    use std::thread;

    use windows_sys::Win32::Foundation::{
        CloseHandle, ERROR_SUCCESS, HANDLE, HANDLE_FLAG_INHERIT, INVALID_HANDLE_VALUE, LocalFree,
        SetHandleInformation, WAIT_OBJECT_0,
    };
    use windows_sys::Win32::Security::Authorization::{
        EXPLICIT_ACCESS_W, GRANT_ACCESS, GetNamedSecurityInfoW, SE_FILE_OBJECT, SetEntriesInAclW,
        SetNamedSecurityInfoW, TRUSTEE_IS_SID, TRUSTEE_IS_USER,
    };
    use windows_sys::Win32::Security::Isolation::{
        CreateAppContainerProfile, DeriveAppContainerSidFromAppContainerName,
    };
    use windows_sys::Win32::Security::{
        CONTAINER_INHERIT_ACE, DACL_SECURITY_INFORMATION, DeriveCapabilitySidsFromName,
        GetSecurityDescriptorSacl, LABEL_SECURITY_INFORMATION, OBJECT_INHERIT_ACE,
        SECURITY_ATTRIBUTES, SECURITY_CAPABILITIES, SID_AND_ATTRIBUTES,
    };
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_ATTRIBUTE_REPARSE_POINT, FILE_DELETE_CHILD, FILE_GENERIC_EXECUTE, FILE_GENERIC_READ,
        FILE_GENERIC_WRITE,
    };
    use windows_sys::Win32::System::Console::{GetStdHandle, STD_ERROR_HANDLE};
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
        PROC_THREAD_ATTRIBUTE_HANDLE_LIST, PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES,
        PROCESS_INFORMATION, ResumeThread, STARTF_USESTDHANDLES, STARTUPINFOEXW, TerminateProcess,
        UpdateProcThreadAttribute, WaitForSingleObject,
    };
    use windows_sys::core::HRESULT;

    const BACKEND_ID: &str = "windows-appcontainer-v1";
    const APP_ID: &str = "minecraft";
    const SANDBOX_READY_PREFIX: &str = "\u{1e}LFAA_SANDBOX_READY:";
    const NETWORK_CAPABILITIES: [&str; 2] = ["internetClientServer", "privateNetworkClientServer"];
    const INSTANCE_WRITE_ACCESS: u32 = FILE_GENERIC_READ | FILE_GENERIC_WRITE | FILE_DELETE_CHILD;
    const JAVA_READ_ACCESS: u32 = FILE_GENERIC_READ | FILE_GENERIC_EXECUTE;
    const DIRECTORY_INHERITANCE: u32 = OBJECT_INHERIT_ACE | CONTAINER_INHERIT_ACE;
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
        instance_id: String,
        java_path: PathBuf,
        java_root: PathBuf,
        memory_mb: u32,
        readiness_token: Option<String>,
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
                    | "--instance-id"
                    | "--java"
                    | "--java-root"
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
        let instance_id = values
            .remove("--instance-id")
            .and_then(|value| value.into_string().ok())
            .ok_or_else(|| "缺少实例 ID。".to_owned())?;
        if !is_uuid(&instance_id) {
            return Err("实例 ID 格式无效。".to_owned());
        }
        let java_path = PathBuf::from(
            values
                .remove("--java")
                .ok_or_else(|| "缺少 Java 路径。".to_owned())?,
        );
        let java_root = PathBuf::from(
            values
                .remove("--java-root")
                .ok_or_else(|| "缺少受管理 Java 目录。".to_owned())?,
        );
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
            instance_id,
            java_path,
            java_root,
            memory_mb,
            readiness_token,
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

    fn validated_paths(args: &LaunchArgs) -> Result<(PathBuf, PathBuf, PathBuf), String> {
        let data_root = fs::canonicalize(&args.data_root)
            .map_err(|_| "LFAA 数据根目录无法验证。".to_owned())?;
        if !data_root.is_dir() {
            return Err("LFAA 数据根目录不是目录。".to_owned());
        }

        let games_root = fs::canonicalize(data_root.join("games"))
            .map_err(|_| "Minecraft 游戏数据目录无法验证。".to_owned())?;
        if games_root.parent() != Some(data_root.as_path()) || !games_root.is_dir() {
            return Err("Minecraft 游戏数据目录越过 LFAA 数据根目录。".to_owned());
        }
        let minecraft_root = fs::canonicalize(games_root.join("minecraft"))
            .map_err(|_| "Minecraft 实例根目录无法验证。".to_owned())?;
        if minecraft_root.parent() != Some(games_root.as_path()) || !minecraft_root.is_dir() {
            return Err("Minecraft 实例根目录越过 LFAA 数据目录。".to_owned());
        }
        let expected_instance = minecraft_root.join(&args.instance_id);
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
        let java_root = fs::canonicalize(&args.java_root)
            .map_err(|_| "受管 Java 运行目录无法验证。".to_owned())?;
        if java_root.parent() != Some(managed_java_root.as_path()) || !java_root.is_dir() {
            return Err("Minecraft Java 运行目录不在 LFAA 受管环境内。".to_owned());
        }
        let java_path = fs::canonicalize(&args.java_path)
            .map_err(|_| "Java 可执行文件无法验证。".to_owned())?;
        let java_metadata =
            fs::symlink_metadata(&java_path).map_err(|_| "Java 可执行文件无法验证。".to_owned())?;
        if !java_metadata.is_file()
            || is_reparse_point(&java_metadata)
            || !java_path.starts_with(&java_root)
            || !java_path
                .file_name()
                .is_some_and(|name| name.eq_ignore_ascii_case("java.exe"))
        {
            return Err("Minecraft Java 可执行文件不在受管运行目录内。".to_owned());
        }
        Ok((data_root, instance_directory, java_root))
    }

    fn is_reparse_point(metadata: &fs::Metadata) -> bool {
        use std::os::windows::fs::MetadataExt;
        metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
    }

    fn prepare_instance(args: &LaunchArgs) -> Result<(), String> {
        let (_data_root, instance_directory, java_root) = validated_paths(args)?;
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
        let (data_root, instance_directory, java_root) = validated_paths(args)?;
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
        let java_root_name = java_root
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .ok_or_else(|| "Minecraft 受管理 Java 目录名称无效。".to_owned())?;
        if !metadata.contains("\"version\":1")
            || !metadata.contains(&format!("\"backend\":\"{BACKEND_ID}\""))
            || !metadata.contains(&format!("\"appId\":\"{APP_ID}\""))
            || !metadata.contains(&format!("\"instanceId\":\"{}\"", args.instance_id))
            || !metadata.contains(&format!(
                "\"javaRootName\":\"{}\"",
                json_escape(&java_root_name)
            ))
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
            return Err("Windows 无法在 AppContainer 中创建 Java 进程。".to_owned());
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
        let mut required_bytes = 0usize;
        unsafe {
            InitializeProcThreadAttributeList(null_mut(), 2, 0, &mut required_bytes);
        }
        if required_bytes == 0 {
            return Err("无法初始化 AppContainer 进程属性。".to_owned());
        }
        let mut storage = vec![0usize; required_bytes.div_ceil(size_of::<usize>())];
        let list = storage.as_mut_ptr().cast::<c_void>();
        if unsafe { InitializeProcThreadAttributeList(list, 2, 0, &mut required_bytes) } == 0 {
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
        let handles_added = unsafe {
            UpdateProcThreadAttribute(
                list,
                0,
                PROC_THREAD_ATTRIBUTE_HANDLE_LIST as usize,
                handles.as_ptr() as *const c_void,
                std::mem::size_of_val(handles),
                null_mut(),
                null(),
            )
        };
        if handles_added == 0 {
            return Err("Windows 拒绝设置 Minecraft 标准句柄白名单。".to_owned());
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
        let entries = [
            format!("PATH={path}"),
            format!("SystemRoot={}", system_root.to_string_lossy()),
            format!("TEMP={temporary}"),
            format!("TMP={temporary}"),
            format!("WINDIR={}", system_root.to_string_lossy()),
        ];
        let mut block = Vec::new();
        for entry in entries {
            block.extend(wide(&entry));
        }
        block.push(0);
        Ok(block)
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
