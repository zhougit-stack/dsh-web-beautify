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
- md 渲染器段落分支必须有进度保证（一行都吃不掉时强制前进），否则 `|…|` 这类行会死循环挂死页面；琴键/面板的 background 有 .16s 过渡，断言 computed style 前要等 ≥250ms。
<!-- PRECOMPACT:AUTO:MODULE:END -->
