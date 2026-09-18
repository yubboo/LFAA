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
- `lfaa.release.json` 与 package/Cargo 版本一致
- CHANGELOG/Release Notes 一致
- governance check 通过

## Windows 脚本编码验证

正式 ZIP 除了目录结构和中文路径外，还必须保证：

```text
scripts/windows/*.ps1
→ UTF-8 with BOM
```

打包前和 ZIP 解压 Round-trip 后都要验证 BOM 未丢失。

检查入口：

```text
node scripts/windows-script-encoding-check.mjs
```
