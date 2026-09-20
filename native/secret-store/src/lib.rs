//! 文件：native/secret-store/src/lib.rs
//! 作用：LFAA Rust Secret Broker 核心，实现宿主无关的二进制协议与 OS Secret Store 适配。
//! 负责：解析 stdin 二进制请求、Windows Generic Credential 写入/读取/删除、写后回读校验与脱敏错误。
//! 不负责：Provider 网络、账户元数据、TypeScript UI、普通文件 Secret 持久化。
//! 状态归属：Secret 真值属于操作系统 Credential Store；Broker 本身无持久内存状态。
//! 对外接口：broker_main、module_name。
//! 关联文件：src/bin/lfaa-secret-broker.rs、packages/credentials/credentials-native/src/rust-secret-store.ts。
//! 修改注意事项：Secret 禁止进入 argv/env/log/file；协议变更必须同步 TypeScript Adapter 与测试。

use std::io::{self, Read, Write};

const REQUEST_MAGIC: &[u8; 4] = b"LFS1";
const RESPONSE_MAGIC: &[u8; 4] = b"LFR1";
const MAX_TARGET_BYTES: usize = 1024;
const MAX_SECRET_BYTES: usize = 2560;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Action {
    Put = 1,
    Get = 2,
    Delete = 3,
}

impl TryFrom<u8> for Action {
    type Error = BrokerError;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            1 => Ok(Self::Put),
            2 => Ok(Self::Get),
            3 => Ok(Self::Delete),
            _ => Err(BrokerError::new(Stage::Input, 87, "unknown action")),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
enum Stage {
    None = 0,
    Input = 1,
    Write = 2,
    VerifyRead = 3,
    VerifyContent = 4,
    Read = 5,
    Delete = 6,
    Unsupported = 7,
}

#[derive(Debug)]
struct BrokerError {
    stage: Stage,
    code: u32,
    message: String,
}

impl BrokerError {
    fn new(stage: Stage, code: u32, message: impl Into<String>) -> Self {
        Self { stage, code, message: message.into() }
    }
}

#[derive(Debug)]
struct Request {
    action: Action,
    target: String,
    secret: Vec<u8>,
}

fn read_u32(input: &[u8], offset: &mut usize) -> Result<u32, BrokerError> {
    let end = offset.saturating_add(4);
    let bytes = input.get(*offset..end).ok_or_else(|| BrokerError::new(Stage::Input, 87, "truncated request"))?;
    *offset = end;
    Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

fn parse_request(input: &[u8]) -> Result<Request, BrokerError> {
    if input.len() < 13 || input.get(0..4) != Some(REQUEST_MAGIC) {
        return Err(BrokerError::new(Stage::Input, 87, "invalid request magic"));
    }
    let action = Action::try_from(input[4])?;
    let mut offset = 5;
    let target_len = read_u32(input, &mut offset)? as usize;
    let secret_len = read_u32(input, &mut offset)? as usize;
    if target_len == 0 || target_len > MAX_TARGET_BYTES || secret_len > MAX_SECRET_BYTES {
        return Err(BrokerError::new(Stage::Input, 87, "request field length is invalid"));
    }
    let target_end = offset.saturating_add(target_len);
    let secret_end = target_end.saturating_add(secret_len);
    if secret_end != input.len() {
        return Err(BrokerError::new(Stage::Input, 87, "request length mismatch"));
    }
    let target_bytes = input.get(offset..target_end).ok_or_else(|| BrokerError::new(Stage::Input, 87, "target is missing"))?;
    let target = std::str::from_utf8(target_bytes)
        .map_err(|_| BrokerError::new(Stage::Input, 87, "target is not utf-8"))?
        .to_owned();
    if target.contains('\0') {
        return Err(BrokerError::new(Stage::Input, 87, "target contains NUL"));
    }
    let secret = input[target_end..secret_end].to_vec();
    if action == Action::Put && secret.is_empty() {
        return Err(BrokerError::new(Stage::Input, 87, "secret is empty"));
    }
    Ok(Request { action, target, secret })
}

fn write_response(status: u8, stage: Stage, code: u32, payload: &[u8]) -> io::Result<()> {
    let mut output = io::stdout().lock();
    output.write_all(RESPONSE_MAGIC)?;
    output.write_all(&[status, stage as u8])?;
    output.write_all(&code.to_le_bytes())?;
    output.write_all(&(payload.len() as u32).to_le_bytes())?;
    output.write_all(payload)?;
    output.flush()
}

fn error_message(error: &BrokerError) -> Vec<u8> {
    // 只返回 OS/阶段信息，不拼接 target 或 Secret。
    error.message.as_bytes().iter().copied().take(1024).collect()
}

#[cfg(target_os = "windows")]
mod platform {
    use super::{BrokerError, Stage, MAX_SECRET_BYTES};
    use std::ffi::c_void;
    use std::ptr;

    const CRED_TYPE_GENERIC: u32 = 1;
    const CRED_PERSIST_LOCAL_MACHINE: u32 = 2;
    const ERROR_NOT_FOUND: u32 = 1168;

    #[repr(C)]
    struct FileTime {
        low_date_time: u32,
        high_date_time: u32,
    }

    #[repr(C)]
    struct CredentialW {
        flags: u32,
        credential_type: u32,
        target_name: *mut u16,
        comment: *mut u16,
        last_written: FileTime,
        credential_blob_size: u32,
        credential_blob: *mut u8,
        persist: u32,
        attribute_count: u32,
        attributes: *mut c_void,
        target_alias: *mut u16,
        user_name: *mut u16,
    }

    #[link(name = "Advapi32")]
    extern "system" {
        fn CredWriteW(credential: *const CredentialW, flags: u32) -> i32;
        fn CredReadW(target: *const u16, credential_type: u32, flags: u32, credential: *mut *mut CredentialW) -> i32;
        fn CredDeleteW(target: *const u16, credential_type: u32, flags: u32) -> i32;
        fn CredFree(buffer: *mut c_void);
    }

    fn win32_error(stage: Stage) -> BrokerError {
        let error = std::io::Error::last_os_error();
        BrokerError::new(stage, error.raw_os_error().unwrap_or(0).max(0) as u32, error.to_string())
    }

    fn wide_target(target: &str) -> Vec<u16> {
        target.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn write_raw(target: &str, secret: &[u8]) -> Result<(), BrokerError> {
        if secret.is_empty() || secret.len() > MAX_SECRET_BYTES {
            return Err(BrokerError::new(Stage::Input, 87, "secret length is invalid"));
        }
        let mut target_wide = wide_target(target);
        let mut secret_bytes = secret.to_vec();
        let credential = CredentialW {
            flags: 0,
            credential_type: CRED_TYPE_GENERIC,
            target_name: target_wide.as_mut_ptr(),
            comment: ptr::null_mut(),
            last_written: FileTime { low_date_time: 0, high_date_time: 0 },
            credential_blob_size: secret_bytes.len() as u32,
            credential_blob: secret_bytes.as_mut_ptr(),
            persist: CRED_PERSIST_LOCAL_MACHINE,
            attribute_count: 0,
            attributes: ptr::null_mut(),
            target_alias: ptr::null_mut(),
            user_name: ptr::null_mut(),
        };
        let ok = unsafe { CredWriteW(&credential, 0) };
        if ok == 0 { return Err(win32_error(Stage::Write)); }
        Ok(())
    }

    pub fn read(target: &str, stage: Stage) -> Result<Option<Vec<u8>>, BrokerError> {
        let target_wide = wide_target(target);
        let mut pointer: *mut CredentialW = ptr::null_mut();
        let ok = unsafe { CredReadW(target_wide.as_ptr(), CRED_TYPE_GENERIC, 0, &mut pointer) };
        if ok == 0 {
            let error = std::io::Error::last_os_error();
            let code = error.raw_os_error().unwrap_or(0).max(0) as u32;
            if code == ERROR_NOT_FOUND { return Ok(None); }
            return Err(BrokerError::new(stage, code, error.to_string()));
        }
        if pointer.is_null() { return Err(BrokerError::new(stage, 13, "credential pointer is null")); }
        let result = unsafe {
            let credential = &*pointer;
            let size = credential.credential_blob_size as usize;
            if size > MAX_SECRET_BYTES {
                Err(BrokerError::new(stage, 13, "credential blob exceeds broker limit"))
            } else if size == 0 {
                Ok(Vec::new())
            } else if credential.credential_blob.is_null() {
                Err(BrokerError::new(stage, 13, "credential blob pointer is null"))
            } else {
                Ok(std::slice::from_raw_parts(credential.credential_blob, size).to_vec())
            }
        };
        unsafe { CredFree(pointer.cast::<c_void>()); }
        result.map(Some)
    }

    pub fn put(target: &str, secret: &[u8]) -> Result<(), BrokerError> {
        write_raw(target, secret)?;
        match read(target, Stage::VerifyRead) {
            Ok(Some(value)) if value == secret => Ok(()),
            Ok(Some(_)) => {
                let _ = delete(target);
                Err(BrokerError::new(Stage::VerifyContent, 0, "credential read-back mismatch"))
            }
            Ok(None) => Err(BrokerError::new(Stage::VerifyRead, ERROR_NOT_FOUND, "credential missing after write")),
            Err(error) => {
                let _ = delete(target);
                Err(error)
            }
        }
    }

    pub fn delete(target: &str) -> Result<(), BrokerError> {
        let target_wide = wide_target(target);
        let ok = unsafe { CredDeleteW(target_wide.as_ptr(), CRED_TYPE_GENERIC, 0) };
        if ok != 0 { return Ok(()); }
        let error = std::io::Error::last_os_error();
        let code = error.raw_os_error().unwrap_or(0).max(0) as u32;
        if code == ERROR_NOT_FOUND { return Ok(()); }
        Err(BrokerError::new(Stage::Delete, code, error.to_string()))
    }
}

#[cfg(not(target_os = "windows"))]
mod platform {
    use super::{BrokerError, Stage};
    pub fn put(_target: &str, _secret: &[u8]) -> Result<(), BrokerError> { Err(BrokerError::new(Stage::Unsupported, 50, "OS secret backend is not implemented for this platform")) }
    pub fn read(_target: &str, _stage: Stage) -> Result<Option<Vec<u8>>, BrokerError> { Err(BrokerError::new(Stage::Unsupported, 50, "OS secret backend is not implemented for this platform")) }
    pub fn delete(_target: &str) -> Result<(), BrokerError> { Err(BrokerError::new(Stage::Unsupported, 50, "OS secret backend is not implemented for this platform")) }
}

fn dispatch(request: Request) -> Result<(u8, Vec<u8>), BrokerError> {
    match request.action {
        Action::Put => {
            platform::put(&request.target, &request.secret)?;
            Ok((0, Vec::new()))
        }
        Action::Get => match platform::read(&request.target, Stage::Read)? {
            Some(value) => Ok((1, value)),
            None => Ok((2, Vec::new())),
        },
        Action::Delete => {
            platform::delete(&request.target)?;
            Ok((0, Vec::new()))
        }
    }
}

/// Broker 进程入口。所有请求只从 stdin 读取，所有响应只写 stdout。
pub fn broker_main() -> i32 {
    let mut input = Vec::new();
    if let Err(error) = io::stdin().read_to_end(&mut input) {
        let broker_error = BrokerError::new(Stage::Input, 5, error.to_string());
        let _ = write_response(255, broker_error.stage, broker_error.code, &error_message(&broker_error));
        return 1;
    }
    match parse_request(&input).and_then(dispatch) {
        Ok((status, payload)) => {
            let _ = write_response(status, Stage::None, 0, &payload);
            0
        }
        Err(error) => {
            let _ = write_response(255, error.stage, error.code, &error_message(&error));
            1
        }
    }
}

/// 返回模块标识，供 workspace 骨架与治理测试使用。
pub fn module_name() -> &'static str { "lfaa-secret-store" }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposes_module_name() { assert_eq!(module_name(), "lfaa-secret-store"); }

    #[test]
    fn parses_binary_put_request_without_json() {
        let target = b"lfaa-ai:provider-x:account-1:api-key";
        let secret = b"secret-value";
        let mut request = Vec::new();
        request.extend_from_slice(REQUEST_MAGIC);
        request.push(Action::Put as u8);
        request.extend_from_slice(&(target.len() as u32).to_le_bytes());
        request.extend_from_slice(&(secret.len() as u32).to_le_bytes());
        request.extend_from_slice(target);
        request.extend_from_slice(secret);
        let parsed = parse_request(&request).expect("request must parse");
        assert_eq!(parsed.action, Action::Put);
        assert_eq!(parsed.target, "lfaa-ai:provider-x:account-1:api-key");
        assert_eq!(parsed.secret, secret);
    }
}
