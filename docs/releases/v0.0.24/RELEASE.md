# LFAA-v0.0.24 Release

## 状态

```text
delivered
```

## 核心变化

统一 Windows 开发入口：

```text
LFAA-Setup.bat
```

菜单：

```text
1  一键依赖
2  启动 Web
3  启动桌面
4  构建 Web
5  构建桌面
6  构建发布
7  环境检查
8  项目资源
9  治理检查
10 完整检查
```

重复 Web 启动器已删除。

## 当前限制

Web 工作台仍为 `in-progress`，真实 Vite build / 浏览器交互需要用户 Windows 环境验证。

Desktop Electron 尚未实现，因此 Desktop 相关菜单会真实阻止，而不是伪装成功。
