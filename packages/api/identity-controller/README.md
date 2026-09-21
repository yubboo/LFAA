# @lfaa/identity-controller

LFAA Web Host 的实例身份 Controller，同时承担本地 `/__lfaa/dev/*` API 的第一道统一 AuthSession Gate。

First Run / login 可匿名访问；初始化完成后，其余 Host API 必须携带有效 HttpOnly Auth Cookie。用户/角色管理还会在本 Controller 内执行 Permission 检查。
