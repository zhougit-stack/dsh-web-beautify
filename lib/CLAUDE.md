<!-- AUTO-GENERATED-BY: PRECOMPACT-MAINTAINER -->

# dsh web UI 美化插件实现 模块说明

<!-- PRECOMPACT:AUTO:MODULE:BEGIN -->
## 适用范围

本文件适用于 `dsh-web-beautify/lib/` 及其下级目录。

## 模块职责

- client.js：样式注入、预览开关胶囊按钮挂载与 retop 重挂逻辑
- index.js：dsh 插件注册入口

## 主要入口

- `dsh-web-beautify/lib/index.js`
- `dsh-web-beautify/lib/client.js`

## 依赖边界

- 视觉调优改动全部收敛在本目录，不碰 test/
- dsh 插件 client 注册 id=完整包名、settings 命名空间=插件短名、卡片 key=命名空间，错一个静默不渲染

## 修改后验证

- Playwright 注入验证（dsh-web-beautify/test/ 下脚本）

## 已验证经验

- retop 重挂守卫写反导致按钮 9 秒卡兜底位：isConnected 检查无法区分『正常挂载』与『挂在 body 兜底』，需按位置判定是否重挂。
- 双 client 测试污染的解法：Playwright `page.route('**/dsh-web-beautify/client.js*', abort)` 屏蔽服务器脚本后 reload，再注入 dev 版即为干净单 client（清 DOM 不够，残留的 document 捕获监听会先 preventDefault 毒化新 client 的入口守卫）。
- **boot 后 `__ModuleLoader__.load()` 是静默空操作**（2026-09-03 实测，dsh 升级后 mode 变 "live"、pendingQueue 不再被消费）：晚注入的 dev client 走 load() 不再挂载且无任何报错。现行验证法 = `page.request.get` 从本地静态服务读 dev 文件 + `route.fulfill` 冒充服务器响应再 reload——比旧法更忠实（走原装启动时序）。
- md 渲染器段落分支必须有进度保证（一行都吃不掉时强制前进），否则 `|…|` 这类行会死循环挂死页面；琴键/面板的 background 有 .16s 过渡，断言 computed style 前要等 ≥250ms。
- CSS 模板字符串内（client.js 顶部 const CSS = \`...\`）不能写含反引号的「注释」，` ``` ` 会提前终止模板串且报错定位在 CSS 行内，难排查。
- mermaid 库（~2.7MB UMD，`globalThis.mermaid`）内置 lib/ 随包发，服务端挂静态端点、客户端首用到才拉；不打包进 client.js（每次页面加载都背上 2.7MB 不划算）。0.5.4 起端点按 no-cache + ETag 响应（重载走 304 重校验、不重传 body；非 loopback 403），单测 test/mermaid-cache.test.mjs。
- 文件预览标签的 key 必须用服务端 resolve 后的绝对路径（data.path）：用点击文本做 key 时，同一文件以相对/绝对/斜向不同形态引用会开出多个标签。
- 顶栏预览开关停靠：快路径 = 类名子串选择器 `[class*="sessionLogButton"]`（实测该胶囊 radius 18px，正是旧「全文本扫描→上溯找 radius≥8」走到的同一锚点，left/top 逐像素一致）；类名漂移时退文本扫描且只限 `<header>` 区域。4s 自愈间隔 + rebuild tick 的 retop 在稳态（按钮在且非 fallback）零成本跳过，仅掉线/兜底态才重新扫描（dsh 重渲染抹掉按钮时由 isConnected 检查触发重挂）。
- 0.5.4 客户端热路径（行为保持）：mousemove 渐变 rAF 节流 + 宽度/hover 写跳过；滚动同步二分（项 top 沿列单调）+ active 高亮增量；FINGERPRINT/classify/buildKeys/inferSessionCwd 的 innerText 换 textContent（snippet 保留 innerText，气泡要渲染后文本）；applyPush 面板关闭时零测量。
<!-- PRECOMPACT:AUTO:MODULE:END -->
