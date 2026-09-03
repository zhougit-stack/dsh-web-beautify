<!-- AUTO-GENERATED-BY: PRECOMPACT-MAINTAINER -->

# dsh web UI 美化插件 模块说明

<!-- PRECOMPACT:AUTO:MODULE:BEGIN -->
## 适用范围

本文件适用于 `dsh-web-beautify/` 及其下级目录。

## 模块职责

- dsh web UI 样式注入美化（预览开关胶囊按钮等）
- test/ 下 Playwright 注入/交互/截图验证脚本
- tgz 本地打包安装链路

## 主要入口

- `dsh-web-beautify/package.json`
- `dsh-web-beautify/lib/index.js`

## 依赖边界

- 改动集中在 lib/client.js 注入端
- 勿在会话内代起 dsh web（沙箱连坐），由用户手动 start-dsh.bat 验证
- 安装链路：pack→~/.dsh/local-packages→package.json file:→pnpm install

## 修改后验证

- `node test/endpoint-cwd.test.mjs` — 服务端文件端点单测（cwd 解析 / 404 / 绝对路径，6 断言）
- `node test/mermaid-cache.test.mjs` — mermaid 静态端点单测（ETag/304 / 403，4 断言，0.5.4 起）
- `node --check lib/client.js` — 客户端语法检查
- test/*.js 是 Playwright page 函数（签名 `async (page) => {...}`）：把文件内容作为 code 传给 Playwright MCP `browser_run_code_unsafe` 执行；验证前用 route.fulfill 法挂 dev 版：`page.request.get` 经插件自己的文件端点读 dev client + `route.fulfill` 冒充服务器响应 + reload（走原装启动时序）；**勿用旧 `route(abort)` 法**——现行 dsh 对 client 脚本加载失败硬失败整个 SPA（"Failed to load plugins"）；验证完 `page.unroute` + reload 还原
- Playwright 截图逐轮视觉验收；安装后由用户手动重启 dsh 实测

## 已验证经验

- 视觉调优流程：Playwright 截图逐轮验证，全部达标后再打包 tgz 安装。
- dsh web 服务端可能缓存旧版本（曾供 0.1.5），升级后要核对服务端实际供给版本，否则会误判修复无效。
- 安装时序（bundle mount 前注入）与手工注入结果不同：手工首跳即成功而客户端内持续失败，验证必须按安装时序复现。
- 0.5.4 简化/性能（行为保持）：hover 渐变 rAF 节流 + 写跳过、滚动同步二分 + 高亮增量、retop 稳态（按钮在且已停靠）零成本跳过（快路径锚点 `[class*="sessionLogButton"]`，实测与旧全文本扫描像素级一致）、innerText→textContent（FINGERPRINT/classify/buildKeys/inferSessionCwd，snippet 保留）、applyPush 关闭态零测量、showPanel/setContent 共用 applyHeader、mermaid 端点 no-store→no-cache + ETag 304 重校验。
- 0.5.5 行为修复（视觉不变）：① 不存在的文件路径重复点击按开关语义收起（错误态键 = 'file:' + 原样路径，此前只能反复打开）；② 切会话面板恢复瞬时、无滑入动画——0.5.4 简化误删了 loadSessionState 的过渡抑制（空函数调用被当 no-op），withoutTransition 重写为 pnb-dragging 类瞬态窗并把恢复变更移入窗内（用户主动开关仍带动画）。
- 0.5.6 行为偏好微调（用户指定部分回退）：切会话恢复面板「打开」走自然过渡（滑入动画），loadSessionState 恢复移出 withoutTransition 窗；关闭路径（onRouteChange）保留 pnb-dragging 窗、瞬时关。实测：恢复打开 19 个中间 transform 值（240ms 减速曲线）且 dragFrames=0；关闭仅 2 端点值且 dragFrames=2。
- 0.5.6 开源化：package.json 去 private、license UNLICENSED→MIT + LICENSE 文件；README 重写为公开版（screenshots/ 例图：宿主侧栏/消息列 blur 处理防会话隐私，面板例图用 examples/preview-sample.md 纯示例内容 + 仓库自身代码，零隐私）；tgz 用 `git add -f` 提交进仓库作发布物（本机 npm 未登录 ENEEDAUTH，npm registry 发布待用户 `npm login` 后 `npm publish --access public`）；GitHub 仓库当时仍私有（未认证 API 404），改公开需用户在 GitHub 页面操作（MCP 无改可见性工具）。
<!-- PRECOMPACT:AUTO:MODULE:END -->
