# #13 Git 更新脚本路径无关化

## 主模块

`project-foundation`

## 问题

源码拉取不能依赖：

```text
H:\lfaa\lfaa
```

也不能假设项目目录一定叫：

```text
lfaa
```

用户可能把项目放在：

```text
C:\Code\LFAA
D:\AI\LittleFish
E:\Projects\Agent
U:\Source\LFAA
```

## 目标

`LFAA-Update.bat` 必须根据用户实际项目位置自动找到 Git 根目录。

## 定位顺序

1. 脚本所在项目 `git rev-parse --show-toplevel`
2. 用户启动脚本时的当前目录
3. 扫描脚本附近 Git 工作区
4. 多个项目时让用户选择
5. 无法识别时要求用户输入项目路径并验证

## 原则

- 不写死盘符；
- 不写死 `H:\lfaa`；
- 不要求目录名必须为 `lfaa`；
- 只认真实 `.git` / Git 根目录；
- 路径中有空格也必须正常工作。
