# LFAA 打包规范

## 正式包名

只允许：

```text
LFAA-v<MAJOR.MINOR.PATCH>.zip
```

例如：

```text
LFAA-v0.0.1.zip
```

禁止正式包名出现：

```text
-flat
-fixed
-final
-latest
-new
```

## ZIP 内部结构

ZIP 内部必须直接包含项目根内容。

禁止再次套一层 `LFAA-v版本号/`。

这样用户选择“解压到 LFAA-v0.0.1”时，最终只会产生一层项目目录。

## 发布前检查

- 包名符合版本规范
- ZIP 无双层根目录
- `LFAA-Sync/GitHub/Update/Setup.bat` 与对应 PowerShell 脚本完整
- `lfaa.release.json` 与 package/Cargo 版本一致
- CHANGELOG/Release Notes 一致
- governance check 通过
- `NOTICE.md` 与第三方许可证完整
- 项目级资源 manifest/lock 可复现
- Secret、`.lfaa/cache`、`.lfaa/state`、`.lfaa/tmp`、`.lfaa/logs` 不进入正式包
- SBOM、签名与 provenance 在正式公开发行阶段完成
