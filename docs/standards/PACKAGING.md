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
