# #15 Update 安全拉取远程差异读取修复

## 主模块

`project-foundation`

## 现象

安全拉取已经得到：

```text
本地领先 0
本地落后 0
```

随后仍执行远程文件差异读取，并可能错误终止为：

```text
读取远程文件变化失败
```

## 根因

状态判断顺序错误。

`0 / 0` 已经证明本地与远程一致，本不需要继续执行文件 diff。

## 修复

1. ahead=0 / behind=0 时立即返回“已是最新”；
2. 本地纯领先、且不是强制模式时不读取远程 diff；
3. 安全拉取遇到分叉时先停止，不执行无意义 diff；
4. 只有真正需要展示变化时才读取文件差异；
5. 文件比较由 revision-range：
   `HEAD..origin/main`
   改为两个明确 ref：
   `git diff <local-sha> <origin/ref>`；
6. 增加 `git diff-tree` fallback；
7. 两种比较都失败时才真正终止并写技术日志。
