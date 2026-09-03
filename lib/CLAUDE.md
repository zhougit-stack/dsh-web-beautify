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
<!-- PRECOMPACT:AUTO:MODULE:END -->
