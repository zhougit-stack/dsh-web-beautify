<!-- AUTO-GENERATED-BY: PRECOMPACT-MAINTAINER -->

# dsh web UI 美化插件实现 模块说明

<!-- PRECOMPACT:AUTO:MODULE:BEGIN -->
## 适用范围

本文件适用于 `dsh-web-beautify/lib/` 及其下级目录。

## 模块职责

- dsh web UI 美化插件实现：client.js 向 dsh web 注入美化样式与交互（含 tooltip）
- index.js 插件注册入口
- 配套 test/ 注入与视觉验证脚本

## 主要入口

- `dsh-web-beautify/lib/index.js`
- `dsh-web-beautify/lib/client.js`

## 依赖边界

- 仅向 dsh web 前端注入，不改 dsh 宿主本体
- 安装走本地 tgz 链路（pack→local-packages→file:→pnpm install）
- test/ 下脚本为一次性验证脚本，运行方式待确认

## 修改后验证

- dsh-web-beautify/test/verify-v2.js 等 Playwright 注入验证脚本（browser_run_code_unsafe 加载执行）
- Playwright 截图视觉验收（已达标）；0.1.1 已装入 ~/.dsh/profiles/web，重启后实测待做

## 已验证经验

- 回复摘要必须结构化选取：dsh 把 reasoning（Think 横幅）与最终回答放在同一 flowItem，回答在其 class 含 markdown 的子容器里，按 innerText 前缀过滤会误杀
- 无真回答的轮次气泡只显示用户消息（不回退 Think 摘要）
- 推挤公式基准必须用 `document.documentElement.clientWidth`（fixed 元素锚定布局视口，与 innerWidth 差一个滚动条宽度）；分界线留白公式 = `unpushedRight - (clientWidth - panelW - MIN_GAP)`
- 滚动同步必须给滚动容器挂 passive scroll 监听（rAF 节流），仅靠 buildKeys/resize 触发会不跟手
- dsh 宿主对 fileLink/加载更早等按钮只认真实点击；开发调试时未 reload 的旧注入实例监听残留会污染 Playwright 读数（querySelector 读到已脱离 DOM 的旧面板/面板串台），复测前必须 reload+清场重注入
- 源码已入私有仓库 github.com/zhougit-stack/dsh-web-beautify（v0.1.3）
<!-- PRECOMPACT:AUTO:MODULE:END -->
