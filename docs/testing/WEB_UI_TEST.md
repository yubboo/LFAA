# Web 工作台本地测试
## v0.0.44 / #21.12 Shell Tooltip 单一提示源重点

1. 右栏展开：终端 / 右栏按钮必须出现在右栏顶部 Header，不能漂在中间正文右上角。
2. 右栏收起：同一组按钮必须回到中间 Header 最右侧。
3. 左栏按钮位于中间 Header 最左侧；Hover 仍临时预览，Click / `Ctrl+B` 正式开合。
4. Center Header 与 Right Header 的底边线、48px 高度必须连续。
5. 鼠标停留 Shell 按钮应只出现一层黑色 Tooltip，快捷键分别为 `Ctrl+B` / `Ctrl+J` / `Ctrl+Alt+B`；不得延迟再弹出第二层浏览器原生提示。
6. 对话正文不得被 Header 按钮覆盖。


## 前置

```text
Node 24.x
pnpm 11.17.0
```

## 启动

```text
LFAA-Setup.bat
→ 2 启动 Web
```

浏览器：

```text
http://127.0.0.1:5173
```

## 1. 主题测试

1. 默认跟随系统偏好初始化；
2. 点击左下角主题按钮，浅色 / 深色切换；
3. 刷新浏览器，确认主题偏好保留；
4. 不应出现宣纸、山水、水墨等装饰主题。

## 2. 当前 Shell Header 位置

1. 不再存在独立的全宽 `Web 页面顶栏`；
2. 中间区域第一行是 48px `Center Header`；
3. 左栏按钮与 `Web 工作台` 标题位于 Center Header 左侧；
4. 更多 / 分享位于 Center Header 右侧；
5. 右栏展开时，终端 / 右栏按钮位于 48px `Right Header`；
6. 右栏收起时，终端 / 右栏按钮回到 Center Header 右侧；
7. Center Header / Right Header 底边线应连续，按钮不得漂在正文层；
8. 窄屏可以隐藏分享，但左栏 / 终端 / 右栏入口必须仍可操作。

## 3. 左栏 Hover Preview

先正式收起左栏：

```text
点击左栏按钮
或 Ctrl+B
```

然后验证：

1. 鼠标移入左上角左栏按钮；
2. 左栏内容以浮层形式淡入；
3. 不应推动中间 Grid，也不应改变正式左栏宽度；
4. 鼠标从按钮移动到预览浮层时，预览不能立刻闪退；
5. 离开按钮和浮层后，短延迟淡出；
6. Hover 结束后刷新页面，左栏仍应保持正式“收起”状态；
7. 再次点击按钮或 `Ctrl+B`，才正式展开左栏。

核心语义：

```text
Hover = 临时看一眼
Click / Ctrl+B = 正式改变布局
```

## 4. 左右栏拖拽 / 吸附

1. 左栏默认约 288px；右栏默认约 360px；
2. 左栏向外拉到最大，不无限扩张；
3. 右栏向外拉到最大，不无限扩张；
4. 两边展开时，中间区仍保留目标最小宽度；
5. 左栏向内拖到 240px，未松手就进入吸附收起预览；
6. 同一 Pointer 反向超过约 264px，可退出吸附预览；
7. Pointer Up 完成收起后，separator 不能反向拉开；
8. 右栏向内拖到 300px，未松手就进入吸附；
9. 同一 Pointer 反向超过约 324px，可退出吸附预览；
10. Pointer Up 完成右栏收起后，separator 不能反向拉开。

## 5. 快捷键

在非输入框聚焦状态验证：

```text
Ctrl+B       左栏正式开合
Ctrl+J       底部终端开合
Ctrl+Alt+B   右栏开合
```

鼠标悬停对应按钮，应从唯一的自定义 Tooltip 看到快捷键；等待数秒也不能出现第二层原生 `title` 提示。

右栏不允许 Hover 自动展开。

## 6. 底部 Terminal Dock

1. 终端位于中间 + 右侧区域底部；
2. 左侧栏保持全高；
3. 终端顶部边界可拖高 / 拖低；
4. 向下拖到最小阈值可吸附收起；
5. 收起后不能从底边 separator 反向拖出；
6. 使用当前 Header 中的终端按钮、`Ctrl+J` 或右栏“终端”入口重新展开；
7. 终端 Dock 不应挤坏主对话区。

## 7. 真实终端测试

首次准备依赖：

```text
LFAA-Setup.bat → 1
```

然后：

```text
LFAA-Setup.bat → 2
```

验收：

1. 底部出现真实 xterm；
2. 能看到真实 PowerShell / 系统 Shell Prompt；
3. 输入目录命令可得到真实输出；
4. 普通项目命令可以执行；
5. 调整底部高度时 xterm 自动 fit；
6. Vite / 页面退出后 PTY 被回收。

注意：这是**人类直接交互的本地开发 PTY**，不是 Agent Tool Runtime。

## 8. `.lfaa` 热插拔

在以下目录新增 / 删除测试资源：

```text
.lfaa/skills/
.lfaa/plugins/
.lfaa/mcp/
```

右侧资源区应自动刷新，无需手工刷新页面。

Network 中 `/__lfaa/dev/resources` 只允许出现：

- kind
- name
- relativePath
- entryType
- updatedAt

不得出现资源正文、Secret、Token 或绝对路径。

## 9. 端口 / Setup 菜单

1. 5173 空闲时优先使用 5173；
2. 已有 LFAA Vite 运行时应快速复用；
3. 5173 被其他程序占用时选择 5174-5199 空闲端口；
4. 不自动结束未知占用进程；
5. Web 按 `Ctrl+C` 停止后返回 Setup 主菜单；
6. 普通检查 / 错误后返回主菜单；
7. 只有菜单 `0` 退出。

## 10. 响应式

- `>1120px`：标准三栏；
- `<=1120px`：右栏浮层；
- `<=820px`：左右栏浮层；
- Header Shell Actions 继续可见；
- 页面不得产生整页横向滚动。