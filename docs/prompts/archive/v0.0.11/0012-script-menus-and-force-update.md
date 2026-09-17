# #12 Windows 脚本菜单化与强制拉取

## 主模块

`project-foundation`

## 目标

三个 Windows 工具双击后不得直接执行写操作，必须先进入数字菜单。

### Update

```text
1 安全拉取
2 强制拉取
3 仅检查更新
0 退出
```

### Git Push

```text
1 一键提交并推送
2 查看 Git 状态
3 配置/修改 origin
0 退出
```

### Sync

```text
1 预览同步差异
2 执行同步
3 查看同步配置
0 退出
```

## 强制拉取安全设计

强制模式允许当前分支完全对齐远程，但必须先建立恢复点：

1. `git fetch --prune`
2. 建立 `lfaa-backup/<branch>-<timestamp>` 备份分支
3. 未提交文件使用 `git stash push -u`
4. `git reset --hard origin/<branch>`
5. `git clean -fd`
6. 校验本地/远程一致
7. 显示 backup branch / stash 恢复信息

Git ignored 文件不使用 `-x` 清理，因此 `.env`、缓存等忽略项继续保留。
