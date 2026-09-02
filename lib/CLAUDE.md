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

- dsh-web-beautify/test/verify-v2.js 等脚本（运行方式待确认）
- Playwright 截图视觉验收（已达标，安装后待实测）

## 已验证经验

- 视觉调优以 Playwright 截图逐轮验证（pnb-6-tooltip.png 验收达标），改动集中在 client.js
- zhougit-stack-dsh-web-beautify-0.1.0.tgz 已构建于上级目录，待按本地链路安装实测
<!-- PRECOMPACT:AUTO:MODULE:END -->
