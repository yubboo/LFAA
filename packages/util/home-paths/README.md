# @lfaa/home-paths

LFAA 用户 Runtime Home 的唯一解析入口。源码仓库不保存机器运行状态。

优先级：`LFAA_HOME` → 平台标准用户数据目录。当前被 Config Host、Plugin Host、Windows 工具等消费；新持久化模块禁止自行拼项目 `.lfaa` 路径。
