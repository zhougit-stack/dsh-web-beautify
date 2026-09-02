# @zhougit-stack/dsh-web-beautify

dsh web 美化插件（一个包装下两个功能，codex 风格）：

## 1. 琴键式对话导航

- 消息流左侧一列细横条「琴键」，**只映射用户发起的消息**（一轮一键），工具调用等事件不建键
- 琴键列贴对话区最左缘，列高随轮数自适应（上限 60vh，超出自动压缩间隙）
- 鼠标沿琴键列移动：琴键长度按与鼠标的距离高斯渐变（σ 随节距自适应），codex 同款放大镜效果
- hover 的琴键弹出该轮消息摘要气泡（跟随、右缘自动翻转）
- 点击琴键平滑滚动到对应用户消息并闪烁定位；滚动时当前轮次琴键蓝色高亮（参考线 = 容器顶 + 45% 视口高）
- 右上角 🎹 不存在——导航开关由 localStorage `pnb-piano-collapsed` 控制（当前版本默认常开；如需开关按钮可在设置里后续加回）

> 修正：0.1.0 实际不带折叠按钮，琴键列常显。折叠态逻辑保留（该 key 存 '1' 时隐藏）。

## 2. 右侧预览面板

- 右上角 ghost 风格按钮（仿 codex 侧栏开关）开/关右侧面板；Esc 或 ✕ 关闭；左缘可拖拽调宽
- 点击对话消息里的：
  - **图片** `<img>` → 面板内就地预览
  - **网页链接** `http(s) 外链` → sandbox iframe 内嵌预览（拒绝内嵌的站点给 ↗ 新标签按钮；修饰键点击不拦截，走浏览器默认行为）
  - **代码块** `<pre>` → 语法高亮预览（内置极简高亮器，含复制按钮）
  - **文件路径**（内联 code 且形似路径）→ 调服务端端点读取预览（代码高亮 / 图片直显）
- 服务端端点 `GET /plugins/dsh-web-beautify/file?path=...`：仅 loopback + Origin/Host 同源校验、只读、单文件 2MB 上限、二进制拒绝；相对路径只解析到 `$DSH_HOME/workspace`

## 实现说明

- 客户端零依赖纯 DOM（不注册 slot，不进设置页），对宿主 DOM 只用「类名子串 + 结构」探测，兼容 dsh web 的 css-modules 哈希漂移
- 服务端只挂一个只读文件端点（安全边界见上）
- 交互参考的社区开源实现：lobehub/lobe-chat `ChatMiniMap`（√长度曲线→本版改为 codex 的鼠标距离渐变、参考线判活）、omdsh-dev/DSH-better-sidebar（链接拦截/修饰键放行/iframe 沙箱）、Bigicemouse/chatgpt-timeline（tick 造型）。openai/codex 主仓为纯 Rust TUI，chatgpt.com/codex 前端未开源，无法直接引用其源码

## 安装（本机 dsh）

```bash
cd dsh-web-beautify && pnpm pack
cp zhougit-stack-dsh-web-beautify-<ver>.tgz ~/.dsh/local-packages/
# 编辑 ~/.dsh/profiles/web/package.json：
#   dependencies 加 "@zhougit-stack/dsh-web-beautify": "file:C:/Users/Administrator/.dsh/local-packages/zhougit-stack-dsh-web-beautify-<ver>.tgz"
#   dsh.profile.bundles 数组追加 "@zhougit-stack/dsh-web-beautify"
cd ~/.dsh/profiles/web && pnpm install --prefer-offline
# 重启 dsh web（用 start-dsh.bat 手动重启）
```

升级：重 pack → 换 tgz → 改 package.json 版本指向 → pnpm install → 重启。
