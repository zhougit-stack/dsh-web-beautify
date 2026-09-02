window.__ModuleLoader__.load({ id: '@zhougit-stack/dsh-web-beautify', factory: (require) => {
  const module = { exports: {} }

  /* ================================================================
   * dsh web 美化客户端：琴键式对话导航 + 右侧预览面板（codex 风格）
   *
   * 琴键 = 消息流左侧一列细横条（长度 ∝ √消息长度，当前项加宽高亮，
   * hover 弹摘要气泡）；右上角仿 codex 侧栏按钮开关右侧预览面板，
   * 点击消息里的图片/网页链接/代码块/文件路径在面板就地预览。
   *
   * 零依赖纯 DOM 实现，不注册任何 slot（不进设置页），挂载即生效。
   * 对宿主 DOM 的探测全部用「类名子串 + 结构」而非哈希类名全等，
   * 以兼容 dsh web 版本升级带来的 css-modules 哈希漂移。
   *
   * 实现参考（社区开源，codex 同款交互）：
   *   - 琴键导航：lobehub/lobe-chat src/features/ChatMiniMap（√长度曲线、
   *     参考线判活）、Bigicemouse/Bigicemouse-chatgpt-timeline-extension
   *     （tick 造型、scrollIntoView + 闪烁定位）
   *   - 预览面板：omdsh-dev/DSH-better-sidebar（document 捕获拦截链接/
   *     修饰键放行/iframe 沙箱策略）、lobehub/lobe-chat RightPanel（拖宽）
   * ================================================================ */

  const PKG = '@zhougit-stack/dsh-web-beautify'
  const FILE_ENDPOINT = '/plugins/dsh-web-beautify/file'
  const STORE_COLLAPSE = 'pnb-piano-collapsed'

  /* ---------------- 样式（跟随 dsh 亮色主题的浅色系） ---------------- */
  const CSS = `
.pnb-piano{position:fixed;top:50%;transform:translateY(-50%);width:46px;
  z-index:1200;display:flex;flex-direction:column;align-items:stretch;
  padding:3px 4px;overflow:hidden;scrollbar-width:none;transition:opacity .18s}
.pnb-piano::-webkit-scrollbar{display:none}
.pnb-piano.pnb-void{display:none}
.pnb-piano.pnb-collapsed{opacity:0;transform:translateY(-50%) translateX(-30px);pointer-events:none}
.pnb-slot{flex:1 1 0;min-height:2px;display:flex;align-items:center;cursor:pointer;width:100%}
.pnb-key{flex:0 0 auto;height:2px;width:10px;border:0;padding:0;margin:0;
  border-radius:999px;background:#c4c8ce;transition:background .16s ease}
.pnb-key.tool{opacity:.55}
.pnb-key.ctx{background:#d8dbdf}
.pnb-key.active{background:#4da3ff}
.pnb-tip{position:fixed;z-index:1300;max-width:300px;padding:8px 12px;border-radius:10px;
  background:#ffffff;color:#24272e;font-size:12px;line-height:1.55;pointer-events:none;
  box-shadow:0 8px 28px rgba(15,23,42,.16),0 2px 8px rgba(15,23,42,.08);border:1px solid rgba(15,23,42,.08);display:none}
.pnb-tip .pnb-tip-user{font-weight:600;color:#24272e;margin-bottom:4px;word-break:break-all}
.pnb-tip .pnb-tip-reply{color:#6b7280;font-size:11.5px;line-height:1.55;word-break:break-all;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.pnb-flash{outline:2px solid rgba(77,163,255,.85)!important;outline-offset:-2px;border-radius:6px}
.pnb-sidebtn{position:fixed;top:74px;right:16px;z-index:1401;width:30px;height:30px;border-radius:8px;cursor:pointer;
  display:flex;align-items:center;justify-content:center;padding:0;
  border:0;background:transparent;color:#8b919b;transition:background .15s,color .15s}
.pnb-sidebtn:hover{background:rgba(15,23,42,.06);color:#4b5563}
.pnb-sidebtn.pnb-on{color:#1c64d9;background:#e8f1fe}
.pnb-panel{position:fixed;top:0;right:0;height:100vh;width:min(46vw,760px);min-width:320px;max-width:86vw;
  z-index:1400;display:flex;flex-direction:column;background:#ffffff;color:#24272e;
  border-left:1px solid rgba(15,23,42,.1);box-shadow:-16px 0 44px rgba(15,23,42,.14);
  transform:translateX(102%);transition:transform .24s cubic-bezier(.2,.8,.24,1)}
.pnb-panel.pnb-open{transform:translateX(0)}
.pnb-grip{position:absolute;left:-4px;top:0;width:8px;height:100%;cursor:ew-resize;z-index:2}
.pnb-panel header{display:flex;align-items:center;gap:9px;padding:10px 12px;flex:0 0 auto;
  border-bottom:1px solid rgba(15,23,42,.08);background:rgba(15,23,42,.02)}
.pnb-panel .pnb-ico{font-size:15px;flex:0 0 auto}
.pnb-panel .pnb-title{flex:1 1 auto;font-size:12.5px;font-weight:600;overflow:hidden;white-space:nowrap;
  text-overflow:ellipsis;direction:rtl;text-align:left;opacity:.95}
.pnb-panel .pnb-meta{flex:0 0 auto;font-size:11px;opacity:.55;font-variant-numeric:tabular-nums}
.pnb-panel header button{flex:0 0 auto;width:26px;height:26px;border-radius:7px;cursor:pointer;font-size:13px;
  border:1px solid rgba(15,23,42,.12);background:#fff;color:#4b5563;padding:0;line-height:1}
.pnb-panel header button:hover{background:#f1f4f8;color:#1c64d9}
.pnb-body{flex:1 1 auto;overflow:auto;position:relative}
.pnb-body .pnb-imgwrap{min-height:100%;display:flex;align-items:center;justify-content:center;padding:18px;
  background:repeating-conic-gradient(#eef0f3 0 25%,#f7f8fa 0 50%) 0 0/22px 22px}
.pnb-body img.pnb-img{max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;
  box-shadow:0 4px 22px rgba(15,23,42,.18)}
.pnb-body .pnb-webbar{display:flex;align-items:center;gap:8px;padding:7px 12px;font-size:11.5px;color:#6b7280;
  border-bottom:1px solid rgba(15,23,42,.07);background:rgba(15,23,42,.02)}
.pnb-body iframe{width:100%;height:calc(100% - 33px);border:0;background:#fff;display:block}
.pnb-body .pnb-pre{margin:0;padding:14px 16px;font-size:12.5px;line-height:1.6;tab-size:4;color:#24292f;
  font-family:Consolas,'Cascadia Mono',Menlo,monospace;white-space:pre;min-height:100%;box-sizing:border-box}
.pnb-body .pnb-pre code{font-family:inherit}
.pnb-tag{position:sticky;top:0;z-index:1;display:inline-block;margin:10px 12px -14px;padding:1px 8px;
  font-size:10.5px;border-radius:5px;background:#e8f1fe;color:#1c64d9;letter-spacing:.4px}
.pnb-body .pnb-err{padding:26px 20px;font-size:13px;line-height:1.8;color:#4b5563}
.pnb-body .pnb-err .pnb-err-path{display:block;margin-top:8px;padding:9px 11px;border-radius:8px;
  background:#f3f4f6;font-family:Consolas,monospace;font-size:12px;word-break:break-all;color:#374151}
.pnb-body .pnb-loading{padding:30px;text-align:center;color:#9aa1ab;font-size:13px}
.pnb-tok-str{color:#0a7d32}.pnb-tok-com{color:#9199a6;font-style:italic}.pnb-tok-num{color:#b35900}
.pnb-tok-kw{color:#0550ae}.pnb-tok-bool{color:#8250df}
@media (max-width:1100px){.pnb-panel{width:min(60vw,760px)}}
`

  /* ---------------- 小工具 ---------------- */
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const fmtSize = (n) => n == null ? '' : n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB'

  /** 疑似文件路径（供内联 code 判定）：允许盘符/分隔符分段，末段带字母扩展名。 */
  const PATH_RE = /^(?:(?:[a-zA-Z]:[\\/]|[\\/]|~[\\/])?[\w.@ -]+(?:[\\/][\w.@ -]+)*\.[A-Za-z]\w{0,7})$/

  /** 修饰键点击 = 用户要真浏览器行为（新标签等），不拦截（DSH-better-sidebar 同款策略）。 */
  const isPlainLeftClick = (e) => e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey

  const EXT_LANG = {
    ts: 'ts', tsx: 'ts', js: 'js', jsx: 'js', mjs: 'js', cjs: 'js', json: 'json', jsonc: 'json',
    py: 'py', rs: 'rs', go: 'go', java: 'java', c: 'c', h: 'c', cpp: 'cpp', cs: 'cs', rb: 'rb',
    sh: 'sh', bash: 'sh', ps1: 'ps1', bat: 'bat', cmd: 'bat', md: 'md', markdown: 'md',
    yaml: 'yaml', yml: 'yaml', toml: 'toml', css: 'css', scss: 'css', html: 'html', htm: 'html',
    xml: 'html', svg: 'html', vue: 'html', sql: 'sql', gd: 'gd', lua: 'lua', php: 'php', txt: 'txt',
  }
  const langOf = (p) => { const m = /\.([A-Za-z]\w{0,7})$/.exec(p || ''); return m ? (EXT_LANG[m[1].toLowerCase()] || '') : '' }

  const KEYWORDS = [
    'const','let','var','function','return','if','else','for','while','do','switch','case','break','continue',
    'new','class','extends','super','this','import','export','from','default','async','await','yield','try',
    'catch','finally','throw','typeof','instanceof','in','of','delete','void','static','get','set','interface',
    'type','enum','implements','public','private','protected','readonly','namespace','declare','as','is','keyof',
    'def','lambda','pass','with','elif','None','True','False','self','fn','pub','mut','impl','struct','match',
    'use','mod','trait','where','package','func','defer','chan','go','select','end','then','fi','local','nil',
  ]
  const BOOLS = ['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']

  /** 极简语法高亮：单趟扫描（注释/字符串/数字/关键字），markdown 走逐行规则。够美化用。 */
  function highlight(code, lang) {
    if (lang === 'md') {
      return esc(code).split('\n').map((line) => {
        if (/^#{1,6}\s/.test(line)) return `<span class="pnb-tok-kw">${line}</span>`
        if (/^\s*[-*+]\s|^\s*\d+\.\s/.test(line)) return `<span class="pnb-tok-bool">${line}</span>`
        return line
          .replace(/(\*\*[^*]+\*\*|`[^`]+`)/g, '<span class="pnb-tok-str">$1</span>')
          .replace(/^(&gt;.*)$/, '<span class="pnb-tok-com">$1</span>')
      }).join('\n')
    }
    const kw = new Set(KEYWORDS); const bl = new Set(BOOLS)
    const re = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(0x[\da-fA-F]+|\d+(?:\.\d+)?)\b|[A-Za-z_$][\w$]*/g
    let out = ''; let last = 0; let m
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index))
      const [tok, com, str, num] = m
      if (com) out += `<span class="pnb-tok-com">${esc(tok)}</span>`
      else if (str) out += `<span class="pnb-tok-str">${esc(tok)}</span>`
      else if (num) out += `<span class="pnb-tok-num">${esc(tok)}</span>`
      else if (kw.has(tok)) out += `<span class="pnb-tok-kw">${esc(tok)}</span>`
      else if (bl.has(tok)) out += `<span class="pnb-tok-bool">${esc(tok)}</span>`
      else out += esc(tok)
      last = m.index + tok.length
    }
    return out + esc(code.slice(last))
  }

  /* ---------------- 右侧预览面板 ---------------- */
  const panel = { el: null, body: null, title: null, meta: null, ico: null, btnCopy: null, btnOpen: null, sidebtn: null, openUrl: null, copyText: null }

  // 仿 codex 右上角侧栏开关（面板开合唯一入口，与 Esc/✕ 等效）
  const SIDEBAR_SVG = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="1">' +
    '<rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor"/>' +
    '<line x1="10" y1="2.5" x2="10" y2="13.5" stroke="currentColor"/>' +
    '<rect x="10.9" y="3.4" width="2.9" height="8.7" rx="1" fill="currentColor" opacity=".35"/></svg>'

  function ensurePanel() {
    if (panel.el) return
    const el = document.createElement('div')
    el.className = 'pnb-panel'
    el.innerHTML = `
      <div class="pnb-grip" title="拖拽调宽"></div>
      <header>
        <span class="pnb-ico">📄</span>
        <span class="pnb-title"></span>
        <span class="pnb-meta"></span>
        <button class="pnb-copy" title="复制内容">⧉</button>
        <button class="pnb-ext" title="在新标签页打开">↗</button>
        <button class="pnb-close" title="关闭 (Esc)">✕</button>
      </header>
      <div class="pnb-body"></div>`
    document.body.appendChild(el)
    const btn = document.createElement('button')
    btn.className = 'pnb-sidebtn'
    btn.title = '预览面板 开/关'
    btn.innerHTML = SIDEBAR_SVG
    btn.addEventListener('click', () => (el.classList.contains('pnb-open') ? closePanel() : showPanel({ ico: '📄', title: '预览', meta: '点击消息里的图片 / 链接 / 代码 / 文件路径打开预览' }) || (panel.body.innerHTML = `<div class="pnb-loading">点击消息里的图片、网页链接、代码块或文件路径<br>即可在这里预览</div>`)))
    document.body.appendChild(btn)
    panel.el = el; panel.sidebtn = btn
    panel.body = el.querySelector('.pnb-body')
    panel.title = el.querySelector('.pnb-title')
    panel.meta = el.querySelector('.pnb-meta')
    panel.ico = el.querySelector('.pnb-ico')
    panel.btnCopy = el.querySelector('.pnb-copy')
    panel.btnOpen = el.querySelector('.pnb-ext')
    el.querySelector('.pnb-close').addEventListener('click', closePanel)
    panel.btnOpen.addEventListener('click', () => { if (panel.openUrl) window.open(panel.openUrl, '_blank', 'noopener') })
    panel.btnCopy.addEventListener('click', () => { if (panel.copyText != null) navigator.clipboard?.writeText(panel.copyText).catch(() => {}) })
    // 左缘拖拽调宽（lobe-chat RightPanel 的 fixed 版等价物）
    el.querySelector('.pnb-grip').addEventListener('mousedown', (e) => {
      e.preventDefault()
      const startX = e.clientX; const startW = el.getBoundingClientRect().width
      const move = (ev) => { el.style.width = Math.min(Math.max(startW + (startX - ev.clientX), 320), innerWidth * 0.86) + 'px' }
      const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up) }
      addEventListener('mousemove', move); addEventListener('mouseup', up)
    })
  }

  function showPanel({ ico, title, meta = '', url = null, copyText = null }) {
    ensurePanel()
    panel.ico.textContent = ico
    panel.title.textContent = title
    panel.title.title = title
    panel.meta.textContent = meta
    panel.openUrl = url
    panel.copyText = copyText
    panel.btnOpen.style.display = url ? '' : 'none'
    panel.btnCopy.style.display = copyText != null ? '' : 'none'
    panel.el.classList.add('pnb-open')
    panel.sidebtn.classList.add('pnb-on')
  }

  function closePanel() {
    panel.el?.classList.remove('pnb-open')
    panel.sidebtn?.classList.remove('pnb-on')
  }

  function panelError(title, message, detail) {
    showPanel({ ico: '⚠️', title })
    panel.body.innerHTML = `<div class="pnb-err">${esc(message)}${detail ? `<span class="pnb-err-path">${esc(detail)}</span>` : ''}</div>`
  }

  function openImage(src, name) {
    showPanel({ ico: '🖼️', title: name || decodeURIComponent(src.split('/').pop().split('?')[0]) || '图片', url: /^https?:/.test(src) ? src : null })
    panel.body.innerHTML = `<div class="pnb-imgwrap"><img class="pnb-img" src="${esc(src)}" alt=""></div>`
  }

  function openWeb(url, label) {
    let host = url; try { host = new URL(url).host } catch {}
    showPanel({ ico: '🌐', title: `${host} — ${(label || '').trim().slice(0, 60) || '网页'}`, url, meta: '拒绝内嵌时点 ↗' })
    panel.body.innerHTML = `
      <div class="pnb-webbar"><span>内嵌预览</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(url)}</span></div>
      <iframe src="${esc(url)}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerpolicy="no-referrer"></iframe>`
  }

  function openCode(code, lang, title, meta) {
    showPanel({ ico: '📋', title: title || (lang ? `${lang} 代码` : '代码'), meta: meta || fmtSize(code.length), copyText: code })
    panel.body.innerHTML = `<div class="pnb-tag">${esc((lang || 'text').toUpperCase())}</div><pre class="pnb-pre"><code>${highlight(code, lang)}</code></pre>`
  }

  async function openFile(rawPath) {
    const p = rawPath.trim()
    showPanel({ ico: '⏳', title: p })
    panel.body.innerHTML = `<div class="pnb-loading">读取文件…</div>`
    let data
    try {
      const res = await fetch(`${FILE_ENDPOINT}?path=${encodeURIComponent(p)}`, { cache: 'no-store' })
      data = await res.json()
      if (!res.ok) { panelError(p, data.error || `读取失败（HTTP ${res.status}）`, data.path || p); return }
    } catch (error) {
      panelError(p, `读取失败：${error}`, p); return
    }
    if (data.kind === 'image') { openImage(data.dataUrl, data.path); return }
    openCode(data.content, langOf(data.path), data.path, `${fmtSize(data.size)}${data.truncated ? ' · 已截断' : ''}`)
  }

  /* ---------------- 琴键式对话导航（codex tick 风格） ---------------- */
  const piano = { strip: null, tip: null, keys: [], items: [], replies: [], scroller: null, column: null, raf: 0, collapsed: false }

  /** 定位当前可见的消息流：flowItem 项 → 列 → 滚动容器（全部子串匹配 + 可见性过滤）。 */
  function findFlow() {
    const first = [...document.querySelectorAll('[class*="flowItem"]')].find((el) => el.getClientRects().length)
    if (!first) return null
    const column = first.parentElement
    const items = [...column.children].filter((el) => el.className.includes('flowItem'))
    let scroller = column
    while (scroller && scroller !== document.body) {
      if (/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) break
      scroller = scroller.parentElement
    }
    if (!scroller || scroller === document.body) scroller = column.closest('[class*="scroll"]') || column
    return { items, column, scroller }
  }

  function classify(item) {
    if (item.querySelector('[class*="userRow"]')) return 'user'
    if (item.className.includes('callRow') || item.querySelector('[class*="callRow"]')) return 'tool'
    if ((item.innerText || '').trim().startsWith('上下文注入')) return 'ctx'
    return 'text'
  }

  function snippet(item) {
    const t = (item.innerText || '')
      .replace(/\d{1,2}月\d{1,2}日\s*\d{1,2}:\d{2}/g, ' ')
      .replace(/(今天|昨天)\s*\d{1,2}:\d{2}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return t.length > 90 ? t.slice(0, 90) + '…' : t
  }

  /* 鼠标跟随放大几何：进入琴键列时缓存各键中心 Y（相对列顶），移动时按距离渐变。 */
  const mag = { rects: null }

  function measureKeys() {
    const top = piano.strip.getBoundingClientRect().top
    mag.rects = piano.keys.map((el) => {
      const r = el.getBoundingClientRect()
      return { y: r.top + r.height / 2 - top }
    })
  }

  /** codex 同款：琴键长度随「与鼠标距离」高斯渐变，返回最近键序号。
   *  σ 随节距自适应（≈2.2 倍节距，hover 键最长、邻键肉眼可见递减）；
   *  列顶每次实时读取，避免列高/位置变化后就近判定错位。 */
  function magnify(clientY) {
    if (!mag.rects || mag.rects.length !== piano.keys.length) measureKeys()
    const n = mag.rects.length
    const y = clientY - piano.strip.getBoundingClientRect().top
    const pitch = n > 1 ? (mag.rects[n - 1].y - mag.rects[0].y) / (n - 1) : 20
    const sigma = Math.max(10, Math.min(30, pitch * 2.2))
    const min = 10; const max = 40
    let nearest = -1; let nd = Infinity
    for (let i = 0; i < n; i++) {
      const d = Math.abs(mag.rects[i].y - y)
      if (d < nd) { nd = d; nearest = i }
      piano.keys[i].style.width = (min + (max - min) * Math.exp(-(d * d) / (2 * sigma * sigma))).toFixed(1) + 'px'
    }
    return nearest
  }

  function resetMagnify() {
    piano.keys.forEach((k) => { k.style.width = '' })
    mag.rects = null
    hideTip()
  }

  function buildKeys() {
    const flow = findFlow()
    // codex/lobe-chat 同款：琴键只映射用户发起的消息（一轮一键），
    // 工具调用、上下文注入等事件不建键；每轮附带 agent 最终回复（该用户
    // 消息之后、下一轮之前的最后一个文本块）供悬浮卡摘要。
    const turns = []
    if (flow) {
      let cur = null
      for (const el of flow.items) {
        const type = classify(el)
        if (type === 'user') { cur = { user: el, reply: null }; turns.push(cur); continue }
        if (cur && type === 'text') {
          // 回复选取（结构化）：dsh 把 reasoning（Think 横幅）和最终回答放在
          // 同一个 flowItem，回答在其 class 含 markdown 的子容器里；纯 reasoning
          // 项没有该容器。工具行/统计行整条排除。该轮没有真回答就不显示回复段，
          // 气泡只留用户消息。
          const head = (el.innerText || '').trim().slice(0, 24)
          const isStats = /^(\d{1,2}月\d{1,2}日|今天|昨天)\s*\d{1,2}:\d{2}/.test(head)
          const isTool = /^(Pwsh|Grep|Read|Write|Edit|Search|Web|Tool call|失败)\b/.test(head)
          if (!isStats && !isTool) {
            const mds = el.querySelectorAll('div[class*="markdown"]')
            const md = mds[mds.length - 1]
            if (md && (md.innerText || '').trim()) cur.reply = md
          }
        }
      }
    }
    if (!turns.length) {
      piano.strip.classList.add('pnb-void')
      piano.items = []; piano.keys = []; piano.replies = []
      return
    }
    piano.strip.classList.remove('pnb-void')
    piano.items = turns.map((t) => t.user)
    piano.replies = turns.map((t) => t.reply)
    piano.scroller = flow.scroller
    piano.column = flow.column
    const frag = document.createDocumentFragment()
    piano.keys = turns.map(() => {
      // 每根琴键包一个整节距高的 slot 命中带：点击/悬停按带判定，稳定不抖；
      // 细横条只是视觉层（codex 同款结构）。
      const slot = document.createElement('div')
      slot.className = 'pnb-slot'
      const key = document.createElement('div')
      key.className = 'pnb-key'
      slot.appendChild(key)
      frag.appendChild(slot)
      return key
    })
    piano.strip.replaceChildren(frag)
    mag.rects = null
    // codex 间距：节距固定 ~12px，列高随琴键数自适应（上限 60vh，超出压缩）
    const n = piano.keys.length
    piano.strip.style.height = Math.min(innerHeight * 0.6, n * 12 + 6) + 'px'
    updatePianoPos()
    scheduleSync()
  }

  function jumpTo(i) {
    const item = piano.items[i]
    if (!item || !item.isConnected) { buildKeys(); return }
    item.scrollIntoView({ behavior: 'smooth', block: 'start' })
    item.classList.remove('pnb-flash'); void item.offsetWidth
    item.classList.add('pnb-flash')
    setTimeout(() => item.classList.remove('pnb-flash'), 950)
  }

  /** 摘要气泡：codex 两段式——粗体用户消息 + 灰色该轮 agent 最终回复摘要。
   *  跟随 hover 的琴键，弹在其右侧，右缘放不下翻左侧。 */
  function showTip(i, clientY) {
    const item = piano.items[i]; const key = piano.keys[i]
    if (!item || !key) return
    const reply = piano.replies[i]
    piano.tip.innerHTML =
      `<div class="pnb-tip-user">${esc(snippet(item))}</div>` +
      (reply ? `<div class="pnb-tip-reply">${esc(snippet(reply))}</div>` : '')
    piano.tip.style.display = 'block'
    const sr = piano.strip.getBoundingClientRect()
    const tw = piano.tip.offsetWidth; const th = piano.tip.offsetHeight
    let left = sr.right + 10
    if (left + tw > innerWidth - 8) left = Math.max(8, sr.left - tw - 10)
    piano.tip.style.left = left + 'px'
    piano.tip.style.top = Math.min(Math.max(clientY - th / 2, 8), innerHeight - th - 8) + 'px'
  }
  function hideTip() { piano.tip.style.display = 'none' }

  /** 滚动同步：参考线 = 容器顶 + 45% 视口高（lobe-chat 判活同款），最后越线项即当前。 */
  function syncActive() {
    piano.raf = 0
    if (!piano.scroller) return
    updatePianoPos()
    const line = piano.scroller.getBoundingClientRect().top + piano.scroller.clientHeight * 0.45
    let active = -1
    for (let i = 0; i < piano.items.length; i++) {
      if (piano.items[i].getBoundingClientRect().top <= line) active = i
      else break
    }
    piano.keys.forEach((k, i) => k.classList.toggle('active', i === active))
  }
  function scheduleSync() { if (!piano.raf) piano.raf = requestAnimationFrame(syncActive) }

  function setCollapsed(collapsed) {
    piano.collapsed = collapsed
    piano.strip.classList.toggle('pnb-collapsed', collapsed)
    localStorage.setItem(STORE_COLLAPSE, collapsed ? '1' : '0')
  }

  /** 琴键条贴在对话区最左侧（codex 相对位置：紧邻会话侧栏右缘一点距离）。 */
  function updatePianoPos() {
    if (!piano.strip || !piano.scroller) return
    const sr = piano.scroller.getBoundingClientRect()
    piano.strip.style.left = (sr.left + 14) + 'px'
  }

  function ensurePiano() {
    const strip = document.createElement('div')
    strip.className = 'pnb-piano pnb-void'
    const tip = document.createElement('div')
    tip.className = 'pnb-tip'
    document.body.append(strip, tip)
    piano.strip = strip; piano.tip = tip
    // 琴键只有 3px 高，点击/hover 命中都委托到琴键列按 Y 就近判定
    strip.addEventListener('mousemove', (e) => {
      const i = magnify(e.clientY)
      if (i >= 0) showTip(i, e.clientY)
    })
    strip.addEventListener('mouseleave', resetMagnify)
    strip.addEventListener('click', (e) => {
      const i = magnify(e.clientY)
      if (i >= 0) jumpTo(i)
    })
    // 无存储值时默认展开；仅显式存过 '1' 才折叠
    setCollapsed(localStorage.getItem(STORE_COLLAPSE) === '1')
    addEventListener('resize', () => { scheduleSync(); updatePianoPos() })
  }

  /* ---------------- 全局装配：点击拦截 + DOM 变化侦听 ---------------- */
  function onClickCapture(e) {
    if (!isPlainLeftClick(e) || e.defaultPrevented) return
    if (!e.target.closest?.('[class*="flowItem"]')) return
    const t = e.target
    const img = t.closest('img')
    if (img) { e.preventDefault(); e.stopPropagation(); openImage(img.currentSrc || img.src, img.alt); return }
    const a = t.closest('a[href]')
    if (a) {
      const href = a.getAttribute('href')
      // 外链 → 面板内嵌预览；同源/非 http 链接放行给宿主（shouldInterceptLink 同款判定）
      let sameOrigin = false
      try { sameOrigin = new URL(href, location.href).origin === location.origin } catch {}
      if (/^https?:/i.test(href) && !sameOrigin) {
        e.preventDefault(); e.stopPropagation(); openWeb(a.href, a.textContent)
      }
      return
    }
    const pre = t.closest('pre')
    if (pre) {
      e.stopPropagation()
      const codeEl = pre.querySelector('code')
      const langCls = [...(codeEl || pre).classList].find((c) => c.startsWith('language-'))
      openCode((codeEl || pre).textContent, langCls ? langCls.slice(9) : '', null, null)
      return
    }
    const code = t.closest('code')
    if (code) {
      const txt = code.textContent.trim()
      if (PATH_RE.test(txt)) { e.preventDefault(); e.stopPropagation(); openFile(txt) }
    }
  }

  /** 消息流任何变化（新消息/切会话/流式块落地）→ 防抖重建琴键。 */
  let rebuildTimer = 0
  function scheduleRebuild() {
    clearTimeout(rebuildTimer)
    rebuildTimer = setTimeout(() => {
      if (!piano.strip) return
      const flow = findFlow()
      if (!flow) { if (piano.items.length) buildKeys(); return }
      if (flow.column !== piano.column || flow.items.length !== piano.items.length) buildKeys()
    }, 180)
  }

  function mount() {
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.appendChild(style)
    ensurePanel()
    ensurePiano()
    document.addEventListener('click', onClickCapture, true)
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel() })
    new MutationObserver(scheduleRebuild).observe(document.body, { childList: true, subtree: true })
    buildKeys()
    console.info(`[${PKG}] 琴键导航 + 预览面板已挂载`)
  }

  function apply() {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true })
    else mount()
  }

  module.exports = { name: 'dsh-web-beautify-client', inject: ['slots'], apply }
  return module.exports
} })
