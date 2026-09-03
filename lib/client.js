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
  border-radius:999px;background:#c4c8ce;transition:width .12s ease,background .16s ease}
.pnb-key.tool{opacity:.55}
.pnb-key.ctx{background:#d8dbdf}
.pnb-key.active{background:#4da3ff}
.pnb-key.hover{background:#4da3ff}
/* 鼠标靠近琴键列 = 切换到 hover 显示模式：当前键隐入基色，唯一高亮是悬停键。
   悬停键恰为当前键时 hover 要赢回高亮（同特异度靠后覆盖），否则指针下永远不亮 */
.pnb-piano.pnb-live .pnb-key.active{background:#c4c8ce}
.pnb-piano.pnb-live .pnb-key.hover{background:#4da3ff}
.pnb-tip-more{margin-top:5px;color:#9aa1ab;font-size:10.5px}
.pnb-tip{position:fixed;z-index:1300;max-width:300px;padding:8px 12px;border-radius:10px;
  background:#ffffff;color:#24272e;font-size:12px;line-height:1.55;pointer-events:none;
  box-shadow:0 8px 28px rgba(15,23,42,.16),0 2px 8px rgba(15,23,42,.08);border:1px solid rgba(15,23,42,.08);display:none}
.pnb-tip .pnb-tip-user{font-weight:600;color:#24272e;margin-bottom:4px;word-break:break-all}
.pnb-tip .pnb-tip-reply{color:#6b7280;font-size:11.5px;line-height:1.55;word-break:break-all;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.pnb-flash{outline:2px solid rgba(77,163,255,.85)!important;outline-offset:-2px;border-radius:6px}
/* 预览开关：嵌入顶栏 Session log 右侧（同排 ghost 图标按钮） */
.pnb-topbtn{width:30px;height:30px;border-radius:8px;cursor:pointer;flex:0 0 auto;
  display:inline-flex;align-items:center;justify-content:center;padding:0;margin-left:6px;
  border:0;background:transparent;color:#8b919b;transition:background .15s,color .15s;vertical-align:middle}
.pnb-topbtn:hover{background:rgba(15,23,42,.06);color:#4b5563}
.pnb-topbtn.pnb-on{color:#1c64d9;background:#e8f1fe}
.pnb-topbtn-fallback{position:fixed;top:12px;right:16px;z-index:1401}
.pnb-panel{position:fixed;top:0;right:0;height:100vh;width:var(--pnb-w,clamp(320px,26vw,720px));min-width:320px;max-width:86vw;
  z-index:1400;display:flex;flex-direction:column;background:#ffffff;color:#24272e;
  border-left:1px solid rgba(15,23,42,.1);box-shadow:-16px 0 44px rgba(15,23,42,.14);
  transform:translateX(102%);transition:transform .24s cubic-bezier(.2,.8,.24,1)}
.pnb-panel.pnb-open{transform:translateX(0)}
/* 面板打开时会话整体左移：留白 > MIN_GAP 时会话不动；越过后平移保持最小留白。
   用 transform 平移（无 reflow），拖拽中禁用过渡实时跟手。 */
.pnb-push{transition:transform .24s cubic-bezier(.2,.8,.24,1)}
.pnb-dragging .pnb-push,.pnb-dragging .pnb-panel{transition:none}
.pnb-grip{position:absolute;left:-4px;top:0;width:8px;height:100%;cursor:ew-resize;z-index:2}
.pnb-grip:hover{background:linear-gradient(90deg,transparent,rgba(28,100,217,.18))}
.pnb-panel header{display:flex;align-items:center;gap:9px;padding:10px 12px;flex:0 0 auto;
  border-bottom:1px solid rgba(15,23,42,.08);background:rgba(15,23,42,.02)}
.pnb-panel .pnb-ico{font-size:15px;flex:0 0 auto}
.pnb-panel .pnb-title{flex:1 1 auto;font-size:12.5px;font-weight:600;overflow:hidden;white-space:nowrap;
  text-overflow:ellipsis;direction:rtl;text-align:left;opacity:.95}
.pnb-panel .pnb-meta{flex:0 0 auto;font-size:11px;opacity:.55;font-variant-numeric:tabular-nums;margin-right:4px}
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
/* 预览标签条：多文件并开（仿 EAC 侧栏 tab 条） */
.pnb-tabs{display:flex;align-items:center;gap:4px;padding:7px 10px 0;flex:0 0 auto;overflow-x:auto;
  scrollbar-width:none;background:rgba(15,23,42,.02);border-bottom:1px solid rgba(15,23,42,.08)}
.pnb-tabs::-webkit-scrollbar{display:none}
.pnb-tab{display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;max-width:180px;height:26px;
  padding:0 6px 0 9px;border-radius:8px;border:1px solid transparent;color:#6b7280;font-size:11.5px;
  cursor:pointer;user-select:none}
.pnb-tab:hover{background:rgba(15,23,42,.05)}
.pnb-tab.pnb-on{background:#fff;border-color:rgba(15,23,42,.12);color:#24272e;box-shadow:0 1px 4px rgba(15,23,42,.07)}
.pnb-tabtt{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.pnb-tabx{flex:0 0 auto;width:15px;height:15px;border-radius:4px;display:inline-flex;align-items:center;
  justify-content:center;font-size:12px;line-height:1;color:#9aa1ab;visibility:hidden}
.pnb-tab:hover .pnb-tabx,.pnb-tab.pnb-on .pnb-tabx{visibility:visible}
.pnb-tabx:hover{background:rgba(15,23,42,.1);color:#374151}
/* markdown 正文排版（仿 EAC 预览：大标题/列表/引用/表格/代码块带语言标签+复制） */
.pnb-md{padding:18px 22px 32px;font-size:13px;line-height:1.8;color:#24272e;word-break:break-word}
.pnb-md h1,.pnb-md h2,.pnb-md h3,.pnb-md h4{margin:20px 0 10px;line-height:1.35;font-weight:700}
.pnb-md h1{font-size:21px}.pnb-md h2{font-size:18px}.pnb-md h3{font-size:15.5px}.pnb-md h4{font-size:13.5px}
.pnb-md h1:first-child,.pnb-md h2:first-child,.pnb-md h3:first-child{margin-top:0}
.pnb-md p{margin:9px 0}
.pnb-md ul,.pnb-md ol{margin:8px 0;padding-left:24px}
.pnb-md li{margin:3px 0}
.pnb-md ul ul,.pnb-md ol ul{margin:2px 0}
.pnb-md a{color:#1c64d9;text-decoration:none}
.pnb-md a:hover{text-decoration:underline}
.pnb-md strong{font-weight:700}
.pnb-md hr{border:0;border-top:1px solid rgba(15,23,42,.1);margin:18px 0}
.pnb-md blockquote{margin:10px 0;padding:6px 14px;border-left:3px solid #4da3ff;border-radius:0 8px 8px 0;
  background:#f3f7fd;color:#4b5563}
.pnb-md blockquote p{margin:4px 0}
.pnb-md .pnb-mi{padding:1px 6px;border-radius:5px;background:#f1f3f6;border:1px solid rgba(15,23,42,.08);
  font-family:Consolas,'Cascadia Mono',Menlo,monospace;font-size:12px;color:#1c64d9}
.pnb-md .pnb-chk{margin-right:2px;color:#4da3ff}
.pnb-md table{border-collapse:collapse;margin:12px 0;font-size:12.5px;display:block;overflow-x:auto;max-width:100%}
.pnb-md th,.pnb-md td{border:1px solid rgba(15,23,42,.12);padding:5px 12px;text-align:left}
.pnb-md th{background:#f3f6fa;font-weight:600}
.pnb-md tr:nth-child(2n) td{background:rgba(15,23,42,.015)}
.pnb-md img{max-width:100%;border-radius:8px;margin:6px 0;box-shadow:0 2px 12px rgba(15,23,42,.1)}
.pnb-preblock{position:relative;margin:12px 0;border:1px solid rgba(15,23,42,.1);border-radius:10px;
  overflow:hidden;background:#f6f8fa}
.pnb-codebar{display:flex;align-items:center;justify-content:space-between;padding:4px 12px;
  font-size:10.5px;letter-spacing:.4px;color:#6b7280;background:#eef1f5;border-bottom:1px solid rgba(15,23,42,.07)}
.pnb-mdcopy{border:0;background:transparent;color:#6b7280;font-size:11px;cursor:pointer;padding:2px 8px;
  border-radius:5px;font-family:inherit}
.pnb-mdcopy:hover{background:rgba(15,23,42,.07);color:#1c64d9}
.pnb-preblock .pnb-pre{min-height:0;padding:12px 14px;background:transparent}
.pnb-tok-str{color:#0a7d32}.pnb-tok-com{color:#9199a6;font-style:italic}.pnb-tok-num{color:#b35900}
.pnb-tok-kw{color:#0550ae}.pnb-tok-bool{color:#8250df}
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

  /* ---------------- 轻量 markdown 渲染（零依赖，仿 EAC 预览排版） ----------------
   * 块级：ATX 标题 / 围栏码（语言标签+每块复制）/ 列表（一层嵌套+任务勾） /
   * 引用 / 表格 / 分隔线 / 段落；行内：`code` **粗** *斜* ~~删~~ 链接与图片。
   * 链接分流：http → 面板内嵌预览，文件路径/file: → 面板文件预览。 */
  function renderMd(src) {
    src = src.replace(/\r\n?/g, '\n')
    const codes = []
    src = src.replace(/```([^\n`]*)\n?([\s\S]*?)```/g, (m, info, c) =>
      `\u0001${codes.push({ lang: info.trim().toLowerCase(), code: c.replace(/\n$/, '') }) - 1}\u0001`)
    const lines = esc(src).split('\n')
    const inline = (s) => {
      const spans = []
      s = s.replace(/`([^`]+)`/g, (m, c) => `\u0002${spans.push(`<code class="pnb-mi">${c}</code>`) - 1}\u0002`)
      s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (m, alt, u) =>
        /^https?:/i.test(u) ? `<img src="${u}" alt="${alt}">`
          : `<a href="javascript:void 0" data-pnb-act="file" data-pnb-path="${u}">${alt || u}</a>`)
      s = s.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (m, t, u) =>
        /^https?:/i.test(u) ? `<a href="${u}" data-pnb-act="web">${t}</a>`
          : `<a href="javascript:void 0" data-pnb-act="file" data-pnb-path="${u}">${t}</a>`)
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>')
      s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>').replace(/~~([^~]+)~~/g, '<del>$1</del>')
      return s.replace(/\u0002(\d+)\u0002/g, (m, j) => spans[+j])
    }
    const out = []
    const FENCE = /^\u0001(\d+)\u0001\s*$/
    const LIST = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/
    const isList = (l) => LIST.test(l)
    for (let i = 0; i < lines.length;) {
      const L = lines[i]
      if (!L.trim()) { i++; continue }
      let m
      if ((m = FENCE.exec(L))) {
        const c = codes[+m[1]]
        out.push(`<div class="pnb-preblock"><div class="pnb-codebar"><span>${esc((c.lang || 'text').toUpperCase())}</span><button class="pnb-mdcopy" type="button">复制</button></div><pre class="pnb-pre"><code>${highlight(c.code, c.lang)}</code></pre></div>`)
        i++; continue
      }
      if ((m = /^(#{1,6})\s+(.*)$/.exec(L))) {
        const h = Math.min(m[1].length, 4)
        out.push(`<h${h}>${inline(m[2])}</h${h}>`); i++; continue
      }
      if (/^\s*(?:\*(?:\s*\*){2,}|-(?:\s*-){2,}|_(?:\s*_){2,})\s*$/.test(L)) { out.push('<hr>'); i++; continue }
      if (/^\s*&gt;/.test(L)) {
        const buf = []
        while (i < lines.length && /^\s*&gt;/.test(lines[i])) { buf.push(lines[i].replace(/^\s*&gt;\s?/, '')); i++ }
        out.push(`<blockquote><p>${inline(buf.join('<br>'))}</p></blockquote>`); continue
      }
      if (/^\s*\|.*\|\s*$/.test(L) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
        const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()))
        const head = cells(L); i += 2
        const rows = []
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++ }
        out.push(`<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
        continue
      }
      if (isList(L)) {
        const items = []
        while (i < lines.length && (m = LIST.exec(lines[i]))) { items.push({ ind: m[1].length, ord: /\d/.test(m[2]), txt: m[3] }); i++ }
        const base = items[0].ind
        let html = '', sub = null
        for (const it of items) {
          const task = /^\[( |x|X)\]\s*(.*)$/.exec(it.txt)
          const t = task ? `<span class="pnb-chk">${task[1] === ' ' ? '☐' : '☑'}</span>${inline(task[2])}` : inline(it.txt)
          if (it.ind > base + 1) { (sub || (sub = [])).push(`<li>${t}</li>`) }
          else { if (sub) { html += `<ul>${sub.join('')}</ul>`; sub = null } html += `<li>${t}</li>` }
        }
        if (sub) html += `<ul>${sub.join('')}</ul>`
        out.push(`<${items[0].ord ? 'ol' : 'ul'}>${html}</${items[0].ord ? 'ol' : 'ul'}>`); continue
      }
      const buf = []
      while (i < lines.length && lines[i].trim() && !FENCE.test(lines[i]) && !/^(#{1,6})\s/.test(lines[i]) &&
        !/^\s*&gt;/.test(lines[i]) && !isList(lines[i]) && !/^\s*\|.*\|\s*$/.test(lines[i]) &&
        !/^\s*(?:\*(?:\s*\*){2,}|-(?:\s*-){2,}|_(?:\s*_){2,})\s*$/.test(lines[i])) { buf.push(lines[i]); i++ }
      // 进度保证：命中段落停条件却不是任何块的行（如无分隔线的 |…| 行）也要吃掉，否则死循环
      if (!buf.length) { buf.push(lines[i]); i++ }
      out.push(`<p>${inline(buf.join('<br>'))}</p>`)
    }
    return `<div class="pnb-md">${out.join('\n')}</div>`.replace(/\u0001(\d+)\u0001/g, (m, j) => {
      const c = codes[+j]; return `<code class="pnb-mi">${esc(c.code)}</code>`
    })
  }

  /* ---------------- 右侧预览面板 ---------------- */
  const panel = { el: null, body: null, tabsEl: null, tabs: [], activeKey: null, title: null, meta: null, ico: null, btnCopy: null, btnOpen: null, sidebtn: null, openUrl: null, copyText: null, lastKey: null }

  /** 同一预览对象再次点击 = 关闭面板；新对象 = 打开/继续显示。 */
  function hitSamePreview(key) {
    if (panel.el?.classList.contains('pnb-open') && panel.lastKey === key) { closePanel(); return true }
    panel.lastKey = key
    return false
  }
  const STORE_PANEL_W = 'pnb-panel-w'

  /** 面板宽度写入 CSS 变量（面板宽度来源）；persist=false 用于按布局算出的默认宽。 */
  function setPanelW(w, persist = true) {
    document.documentElement.style.setProperty('--pnb-w', Math.round(w) + 'px')
    if (persist) localStorage.setItem(STORE_PANEL_W, String(Math.round(w)))
  }

  /* ---- 会话推挤（transform 平移版） ----
   * 规则：会话右缘与分界线之间留白 > MIN_GAP 时会话完全不动；
   * 面板继续加宽、留白将被侵入时，平移会话使留白恰好固定在 MIN_GAP。
   * 默认面板宽 = 恰好落在会话右缘 + MIN_GAP（初始弹出零位移）；
   * dsh 的 React 重渲染可能清掉内联 transform，位移每次从 computedStyle 实读。 */
  const PUSH_MIN_GAP = 32

  function chatViewRoot() {
    const col = document.querySelector('[class*="flowItem"]')?.parentElement
    if (!col) return null
    // 平移根要同时容纳消息列和底部输入框：只推消息列的话，面板加宽会把
    // 输入框留在原地被面板盖住。向上找第一个也包含 composer 的祖先
    // （消息区+输入区的共同容器）；找不到 composer 时退回 column → scroll → 会话根。
    const composer = document.querySelector('[class*="composer"]')
    if (!composer) return col.parentElement?.parentElement || null
    for (let a = col.parentElement; a && a !== document.body; a = a.parentElement) {
      if (a.contains(composer)) return a
    }
    return col.parentElement?.parentElement || null
  }

  function currentShift(root) {
    const t = getComputedStyle(root).transform
    if (!t || t === 'none') return 0
    const m = t.match(/matrix\(([^)]+)\)/)
    return m ? (parseFloat(m[1].split(',')[4]) || 0) : 0
  }

  function applyPush() {
    const root = chatViewRoot()
    if (!root) return
    if (!panel.el?.classList.contains('pnb-open')) {
      if (root.style.transform) root.style.transform = ''
      root.classList.remove('pnb-push')
      return
    }
    // 测「可见会话列」的右缘（root 是全宽容器，其右缘≈窗口缘，量它会多推）
    const col = root.querySelector('[class*="flowItem"]')?.parentElement || root
    root.classList.add('pnb-push')
    const pw = panel.el.getBoundingClientRect().width
    if (!pw) return
    const unpushedRight = col.getBoundingClientRect().right - currentShift(root)
    // 目标：平移后 col.right = panel.left - MIN_GAP（分界线左侧留出最小留白）
    const need = Math.max(0, unpushedRight - (document.documentElement.clientWidth - pw - PUSH_MIN_GAP))
    root.style.transform = need > 0.5 ? `translateX(-${Math.round(need)}px)` : ''
  }

  /** 按当前布局算「零位移」面板宽：分界线正好落在会话右缘 + MIN_GAP。 */
  function defaultPanelW() {
    const col = document.querySelector('[class*="flowItem"]')?.parentElement
    if (!col) return null
    const w = document.documentElement.clientWidth - col.getBoundingClientRect().right - PUSH_MIN_GAP
    return Math.min(Math.max(w, 320), document.documentElement.clientWidth * 0.86)
  }

  function pushHost() {
    panel.retop?.() // 面板开/关瞬间同步开关位置（进面板头/归位顶栏），不等自愈间隔
    applyPush()
    updatePianoPos()
    setTimeout(() => { applyPush(); updatePianoPos() }, 280) // 过渡结束后校准
  }

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
      </header>
      <div class="pnb-body"></div>`
    document.body.appendChild(el)
    // 标签条：多预览并开（仿 EAC 侧栏 tab 条），插在头与正文之间
    const tabsEl = document.createElement('div')
    tabsEl.className = 'pnb-tabs'
    el.insertBefore(tabsEl, el.querySelector('.pnb-body'))
    // 预览开关：顶栏「Session log+下载」长圆形框外右侧（同排 ghost 图标按钮，功能与面板 ✕ 合并）
    const btn = document.createElement('button')
    btn.className = 'pnb-topbtn'
    btn.title = '预览面板 开/关'
    btn.innerHTML = SIDEBAR_SVG
    btn.addEventListener('click', () => (el.classList.contains('pnb-open') ? closePanel() : showPanel({ ico: '📄', title: '预览', meta: '点击消息里的图片 / 链接 / 代码 / 文件路径打开预览' }) || (panel.body.innerHTML = `<div class="pnb-loading">点击消息里的图片、网页链接、代码块或文件路径<br>即可在这里预览</div>`)))
    // 插到「Session log+下载」长圆形框的框外右侧：胶囊框 = Session log 最近的
    // 四角圆角≥8px 祖先；找不到再退回 Session log 元素之后。
    const placeTopBtn = () => {
      const matches = [...document.querySelectorAll('button, [role="button"], div, span')]
        .filter((b) => /session\s*log/i.test((b.textContent || '').trim()) && (b.textContent || '').trim().length < 20)
      const sessBtn = matches.find((m) => !matches.some((o) => o !== m && m.contains(o))) // 最内层
      let pill = null
      for (let a = sessBtn?.parentElement; a && a !== document.body; a = a.parentElement) {
        const radii = getComputedStyle(a).borderRadius.split(/\s+/).filter(Boolean).map(parseFloat)
        if (radii.length && Math.min(...radii) >= 8) { pill = a; break }
        if (a.tagName === 'HEADER' || /header/i.test(a.className || '')) break
      }
      if (pill) { pill.insertAdjacentElement('afterend', btn); return true }
      if (sessBtn?.parentElement) { sessBtn.insertAdjacentElement('afterend', btn); return true }
      return false
    }
    // bundle 在页面加载即执行，顶栏可能还没渲染：先退居固定角，顶栏出现后重挂
    // （固定角恰好和 dsh 自己的顶栏控件重叠，不能久留）；dsh 重渲染顶栏时还会
    // 把外来按钮整个抹掉 → scheduleRebuild 里经 panel.retop 定期重挂
    panel.retop = () => {
      const hd = panel.el?.querySelector('header')
      // 面板打开：顶栏位被面板盖住（dsh 顶栏层叠低于面板）→ 开关挪进面板头
      // 当收合钮；同一颗按钮，不产生第二份开关
      if (panel.el?.classList.contains('pnb-open')) {
        if (hd && btn.parentElement !== hd) { btn.classList.remove('pnb-topbtn-fallback'); hd.appendChild(btn) }
        return
      }
      // 面板关闭：三种情形都要归位——被 dsh 重渲染抹掉（断连）、mount 早于
      // 顶栏渲染卡兜底位（守卫写成 !isConnected 会空转）、从面板头撤回
      if (!btn.isConnected || btn.classList.contains('pnb-topbtn-fallback') || (hd && btn.parentElement === hd)) {
        if (placeTopBtn()) { btn.classList.remove('pnb-topbtn-fallback'); return }
        // 归位失败（如不在会话视图、没有胶囊框）：不能把开关留在随面板滑走的
        // 面板头里（不可见），摘下来退到固定角，等自愈间隔再归位
        if (hd && btn.parentElement === hd) hd.removeChild(btn)
      }
      if (!btn.isConnected) {
        btn.classList.add('pnb-topbtn-fallback')
        document.body.appendChild(btn)
      }
    }
    if (!placeTopBtn()) {
      btn.classList.add('pnb-topbtn-fallback')
      document.body.appendChild(btn)
      // 顶栏迟迟不渲染（重插件机器启动慢）→ 拉长重试窗；4s 自愈间隔兜底
      // dsh 启动后任何时机的重渲染抹按钮，也能在 4s 内归位
      let tries = 0
      const retry = () => {
        if (!btn.isConnected || tries++ > 120) return
        panel.retop()
        if (!btn.classList.contains('pnb-topbtn-fallback')) return
        setTimeout(retry, 500)
      }
      setTimeout(retry, 500)
    }
    setInterval(panel.retop, 4000)
    panel.el = el; panel.sidebtn = btn
    panel.tabsEl = tabsEl
    panel.body = el.querySelector('.pnb-body')
    panel.title = el.querySelector('.pnb-title')
    panel.meta = el.querySelector('.pnb-meta')
    panel.ico = el.querySelector('.pnb-ico')
    panel.btnCopy = el.querySelector('.pnb-copy')
    panel.btnOpen = el.querySelector('.pnb-ext')
    panel.btnOpen.addEventListener('click', () => { if (panel.openUrl) window.open(panel.openUrl, '_blank', 'noopener') })
    panel.btnCopy.addEventListener('click', () => { if (panel.copyText != null) navigator.clipboard?.writeText(panel.copyText).catch(() => {}) })
    // 标签条：点击切换（保存离场标签滚动位）、× 关闭
    tabsEl.addEventListener('click', (e) => {
      const x = e.target.closest('.pnb-tabx')
      if (x) { closeTab(+x.dataset.x); return }
      const tab = e.target.closest('.pnb-tab')
      if (!tab) return
      const tb = panel.tabs[+tab.dataset.i]
      if (!tb || tb.key === panel.activeKey) return
      const cur = panel.tabs.find((t) => t.key === panel.activeKey)
      if (cur && panel.body) cur.scroll = panel.body.scrollTop
      setContent(tb)
    })
    // 正文委托：markdown 代码块复制钮、链接分流（http→网页预览，路径→文件预览）
    panel.body.addEventListener('click', (e) => {
      const cp = e.target.closest('.pnb-mdcopy')
      if (cp) {
        const code = cp.closest('.pnb-preblock')?.querySelector('code')
        if (code) navigator.clipboard?.writeText(code.textContent).catch(() => {})
        cp.textContent = '已复制'
        setTimeout(() => { cp.textContent = '复制' }, 1200)
        return
      }
      const a = e.target.closest('a[data-pnb-act]')
      if (!a || !isPlainLeftClick(e)) return
      e.preventDefault()
      if (a.dataset.pnbAct === 'web') openWeb(a.href, a.textContent)
      else openFile(a.dataset.pnbPath || a.textContent.trim())
    })
    // 面板头不再放开关按钮：dsh 顶栏的预览开关在面板打开时依旧悬浮可见，
    // 面板右上角再放一个会同位叠置（用户看到「× 藏在开关后面」就是这个）
    // 左缘 = 会话/面板分界线，左右拖动调宽（会话实时跟随推挤；拖拽中禁过渡）
    el.querySelector('.pnb-grip').addEventListener('mousedown', (e) => {
      e.preventDefault()
      const startX = e.clientX; const startW = el.getBoundingClientRect().width
      document.documentElement.classList.add('pnb-dragging')
      const move = (ev) => {
        setPanelW(Math.min(Math.max(startW + (startX - ev.clientX), 320), innerWidth * 0.86))
        applyPush()
        updatePianoPos()
      }
      const up = () => {
        removeEventListener('mousemove', move); removeEventListener('mouseup', up)
        document.documentElement.classList.remove('pnb-dragging')
      }
      addEventListener('mousemove', move); addEventListener('mouseup', up)
    })
    // 恢复上次拖拽的宽度；没有则按当前布局算「零位移」默认宽（会话右缘 + 最小留白）
    const saved = parseFloat(localStorage.getItem(STORE_PANEL_W) || '')
    if (saved >= 320) setPanelW(saved, false)
    else { const d = defaultPanelW(); if (d) setPanelW(d, false) }
  }

  function showPanel({ ico, title, meta = '', url = null, copyText = null }) {
    ensurePanel()
    // 没有保存宽度且尚未算过默认宽（首次打开时 flow 可能才就绪）→ 按布局补算
    if (!localStorage.getItem(STORE_PANEL_W) && !document.documentElement.style.getPropertyValue('--pnb-w')) {
      const d = defaultPanelW()
      if (d) setPanelW(d, false)
    }
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
    pushHost()
  }

  function closePanel() {
    if (!panel.el?.classList.contains('pnb-open')) return
    panel.el.classList.remove('pnb-open')
    panel.sidebtn?.classList.remove('pnb-on')
    panel.lastKey = null
    pushHost()
  }

  /* ---- 标签式预览：每个预览对象一个标签，切换不丢内容与滚动位 ---- */
  const TAB_MAX = 10

  function renderTabs() {
    const t = panel.tabsEl
    if (!t) return
    t.style.display = panel.tabs.length ? '' : 'none'
    t.innerHTML = panel.tabs.map((tb, i) =>
      `<span class="pnb-tab${tb.key === panel.activeKey ? ' pnb-on' : ''}" data-i="${i}" title="${esc(tb.title).replace(/"/g, '&quot;')}">` +
      `<span>${tb.ico}</span><span class="pnb-tabtt">${esc(tb.title)}</span>` +
      `<span class="pnb-tabx" data-x="${i}" title="关闭">×</span></span>`).join('')
  }

  /** 打开/切换一个预览标签：html 由调用方渲染好，这里负责标签增改、
   *  激活态、头部按钮与滚动位恢复。 */
  function setContent({ key, ico = '📄', title = '', meta = '', url = null, copyText = null, html = '' }) {
    ensurePanel()
    let tb = panel.tabs.find((t) => t.key === key)
    if (!tb) {
      tb = { key }
      panel.tabs.push(tb)
      if (panel.tabs.length > TAB_MAX) panel.tabs.splice(0, panel.tabs.length - TAB_MAX)
    }
    const cur = panel.tabs.find((t) => t.key === panel.activeKey)
    if (cur && cur !== tb && panel.body) cur.scroll = panel.body.scrollTop
    Object.assign(tb, { ico, title, meta, url, copyText, html })
    panel.activeKey = key
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
    panel.body.innerHTML = html
    panel.body.scrollTop = tb.scroll || 0
    renderTabs()
    pushHost()
  }

  function closeTab(i) {
    const tb = panel.tabs[i]
    if (!tb) return
    if (tb.key === panel.activeKey && panel.body) tb.scroll = panel.body.scrollTop
    panel.tabs.splice(i, 1)
    if (tb.key === panel.activeKey) {
      const nx = panel.tabs[Math.min(i, panel.tabs.length - 1)]
      panel.activeKey = null
      if (nx) setContent(nx)
      else closePanel()
      return
    }
    renderTabs()
  }

  function panelError(title, message, detail) {
    showPanel({ ico: '⚠️', title })
    panel.body.innerHTML = `<div class="pnb-err">${esc(message)}${detail ? `<span class="pnb-err-path">${esc(detail)}</span>` : ''}</div>`
  }

  function openImage(src, name) {
    if (hitSamePreview('img:' + (name || src))) return
    const label = name || decodeURIComponent(src.split('/').pop().split('?')[0]) || '图片'
    setContent({
      key: 'img:' + (name || src), ico: '🖼️',
      title: String(label).split(/[\\/]/).pop() || label,
      url: /^https?:/.test(src) ? src : null,
      html: `<div class="pnb-imgwrap"><img class="pnb-img" src="${esc(src)}" alt=""></div>`,
    })
  }

  function openWeb(url, label) {
    let host = url; try { host = new URL(url).host } catch {}
    setContent({
      key: 'web:' + url, ico: '🌐',
      title: `${host} — ${(label || '').trim().slice(0, 60) || '网页'}`,
      url, meta: '拒绝内嵌时点 ↗',
      html: `
      <div class="pnb-webbar"><span>内嵌预览</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(url)}</span></div>
      <iframe src="${esc(url)}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerpolicy="no-referrer"></iframe>`,
    })
  }

  const codeHtml = (code, lang) =>
    `<div class="pnb-tag">${esc((lang || 'text').toUpperCase())}</div><pre class="pnb-pre"><code>${highlight(code, lang)}</code></pre>`

  function openCode(code, lang, title, meta) {
    setContent({
      key: 'code:' + (title || '') + ':' + code.length + ':' + code.slice(0, 60),
      ico: '📋', title: title || (lang ? `${lang} 代码` : '代码'),
      meta: meta || fmtSize(code.length), copyText: code,
      html: codeHtml(code, lang),
    })
  }

  /** PDF：服务端 raw 模式回流字节，iframe 用浏览器内置查看器渲染。 */
  function openPdf(p) {
    const url = `${FILE_ENDPOINT}?path=${encodeURIComponent(p)}&raw=1`
    setContent({
      key: 'pdf:' + p, ico: '📕', title: p.split(/[\\/]/).pop() || 'PDF', url, meta: 'PDF 预览',
      html: `<iframe src="${esc(url)}" style="border:0;width:100%;height:100%;background:#525659"></iframe>`,
    })
  }

  async function openFile(rawPath) {
    const p = rawPath.trim()
    // 重复点击同一个文件 = 收起面板；点新文件 = 打开/切换预览
    if (hitSamePreview('file:' + p)) return
    if (/\.pdf$/i.test(p)) { openPdf(p); return }
    showPanel({ ico: '⏳', title: p })
    panel.body.innerHTML = `<div class="pnb-loading">读取文件…</div>`
    let data
    try {
      const res = await fetch(`${FILE_ENDPOINT}?path=${encodeURIComponent(p)}`, { cache: 'no-store' })
      // 等待期间用户已关面板 → 丢弃迟到内容（避免面板又自己顶开）
      if (!panel.el.classList.contains('pnb-open')) return
      data = await res.json()
      if (!res.ok) { panelError(p, data.error || `读取失败（HTTP ${res.status}）`, data.path || p); return }
    } catch (error) {
      panelError(p, `读取失败：${error}`, p); return
    }
    const meta = `${fmtSize(data.size)}${data.truncated ? ' · 已截断' : ''}`
    if (data.kind === 'image') { openImage(data.dataUrl, data.path); return }
    if (/\.md$/i.test(data.path)) {
      setContent({
        key: 'file:' + p, ico: '📝', title: p.split(/[\\/]/).pop(),
        meta: `${meta} · ${data.content.split('\n').length} 行`, copyText: data.content,
        html: renderMd(data.content),
      })
      return
    }
    setContent({
      key: 'file:' + p, ico: '📄', title: p.split(/[\\/]/).pop(), meta,
      copyText: data.content, html: codeHtml(data.content, langOf(data.path)),
    })
  }

  /* ---------------- 琴键式对话导航（codex tick 风格） ---------------- */
  const piano = { strip: null, tip: null, keys: [], items: [], replies: [], scroller: null, column: null, older: null, raf: 0, collapsed: false, autoDone: null, autoAt: 0 }

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
   *  列顶每次实时读取；最近键加 .hover 高亮（光标处即高亮处），
   *  hover 期间滚动同步的 .active 降为浅蓝，避免两处高亮互相打架。 */
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
    piano.keys.forEach((k, i) => k.classList.toggle('hover', i === nearest))
    piano.strip.classList.add('pnb-live')
    return nearest
  }

  function resetMagnify() {
    piano.keys.forEach((k) => { k.style.width = ''; k.classList.remove('hover') })
    piano.strip.classList.remove('pnb-live')
    mag.rects = null
    hideTip()
  }

  /** 会话滚动容器变更时换绑 scroll 监听（passive + rAF 节流，滚动时同步当前键）。 */
  function setScroller(el) {
    if (piano.scroller === el) return
    if (piano.scroller) piano.scroller.removeEventListener('scroll', scheduleSync)
    piano.scroller = el
    if (el) el.addEventListener('scroll', scheduleSync, { passive: true })
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
    setScroller(flow.scroller)
    piano.column = flow.column
    // 顶部「加载更早」按钮：历史被 dsh 虚拟化时自动补全（后台直调 loadOlder，
    // 不阻塞当前渲染感知）；顶部琴键点击也会顺带触发
    piano.older = findOlderBtn()
    if (piano.older?.isConnected && piano.older !== piano.autoDone && Date.now() - (piano.autoAt || 0) > 5000) {
      piano.autoDone = piano.older
      piano.autoAt = Date.now()
      setTimeout(loadAllEarlier, 400)
    }
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

  /** 定位 dsh 的「加载更早」按钮：class 形如 <hash>_older（注意 folder/
   *  placeholder 都含 "older" 子串，不能用宽泛匹配），文本兜底。 */
  function findOlderBtn() {
    const col = piano.column?.isConnected ? piano.column : findFlow()?.column
    if (!col) return null
    return col.querySelector('[class*="_older"]') ||
      [...col.querySelectorAll('div,span,button')].find((e) => (e.textContent || '').trim() === '加载更早' && e.children.length <= 3) ||
      null
  }

  /** ChatView fiber 暴露的 loadOlder 动作：宿主对「加载更早」按钮只认真实
   *  点击（合成 click 的 isTrusted:false 被拒），而直调 React props 上的
   *  store 动作完全绕开事件系统——实测一次调用即载入全部更早历史。 */
  function findLoadOlder() {
    const col = piano.column?.isConnected ? piano.column : findFlow()?.column
    const first = col?.querySelector('[class*="flowItem"]')
    const fk = first && Object.keys(first).find((k) => k.startsWith('__reactFiber$'))
    let f = fk ? first[fk] : null
    while (f && !(typeof f.type === 'function' && f.type.name === 'ChatView')) f = f.return
    return f && typeof f.memoizedProps?.loadOlder === 'function' ? f.memoizedProps.loadOlder : null
  }

  /** 循环直调 loadOlder 把当前会话全部历史用户消息载入琴键；上限 12 次
   *  防失控（通常一次即全量，按钮随后消失）。 */
  async function loadAllEarlier() {
    for (let guard = 0; guard < 12; guard++) {
      if (!findOlderBtn()?.isConnected) return
      const loadOlder = findLoadOlder()
      if (!loadOlder) return
      try { loadOlder() } catch { return }
      await new Promise((r) => setTimeout(r, 300))
    }
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
    const more = i === 0 && piano.older && piano.older.isConnected
      ? '<div class="pnb-tip-more">⤴ 跳到最早消息；更早的历史正在自动加载补全琴键</div>' : ''
    piano.tip.innerHTML =
      `<div class="pnb-tip-user">${esc(snippet(item))}</div>` +
      (reply ? `<div class="pnb-tip-reply">${esc(snippet(reply))}</div>` : '') + more
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
    // 琴键只有 2px 高，点击/hover 命中都委托到琴键列按 Y 就近判定
    strip.addEventListener('mousemove', (e) => {
      const i = magnify(e.clientY)
      if (i >= 0) showTip(i, e.clientY)
    })
    strip.addEventListener('mouseleave', resetMagnify)
    strip.addEventListener('click', (e) => {
      const i = magnify(e.clientY)
      if (i < 0) return
      // 顶部琴键 = 跳到最早消息 + 顺带补全历史（直调 ChatView 的 loadOlder）
      if (i === 0) { jumpTo(0); if (piano.older?.isConnected) loadAllEarlier(); return }
      jumpTo(i)
    })
    // 无存储值时默认展开；仅显式存过 '1' 才折叠
    setCollapsed(localStorage.getItem(STORE_COLLAPSE) === '1')
    addEventListener('resize', () => { scheduleSync(); applyPush(); updatePianoPos() })
  }

  /* ---------------- 全局装配：点击拦截 + DOM 变化侦听 ---------------- */
  function onClickCapture(e) {
    if (!isPlainLeftClick(e) || e.defaultPrevented) return
    // 用户按住拖选文字（选区非空）→ 不触发面板
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed && String(sel).trim()) return
    if (!e.target.closest?.('[class*="flowItem"]')) return
    const t = e.target
    const img = t.closest('img')
    if (img) { e.preventDefault(); e.stopPropagation(); openImage(img.currentSrc || img.src, img.alt); return }
    // 文件引用按钮（Read/Edit 工具行里的 CODE_MAP.md 等，dsh 默认调外部应用打开）
    const fl = t.closest('[class*="fileLink"]')
    if (fl) {
      const p = (fl.textContent || '').trim()
      if (p) { e.preventDefault(); e.stopPropagation(); openFile(p); return }
    }
    const a = t.closest('a[href]')
    if (a) {
      const href = a.getAttribute('href')
      // file:// 链接 → 面板预览（不让宿主拉起外部应用）
      if (/^file:/i.test(href)) {
        e.preventDefault(); e.stopPropagation()
        let p = href.replace(/^file:\/\/\/?/i, '').replace(/^file:/i, '')
        try { p = decodeURIComponent(p) } catch {}
        openFile(p); return
      }
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

  /** 消息流变化（新消息/切会话/加载更早）→ 防抖重建琴键。
   *  关键守卫：只在「用户轮数」或「列元素」变化时才重建——不能用 flow.items
   *  总数对比（总数≠轮数，恒不等会导致每 180ms 全量 replaceChildren，
   *  表现为高亮/长度持续闪烁、点击错位）。 */
  let rebuildTimer = 0
  function scheduleRebuild() {
    clearTimeout(rebuildTimer)
    rebuildTimer = setTimeout(() => {
      if (!piano.strip) return
      // dsh 重渲染顶栏会抹掉插入的预览开关 → 掉线就重挂
      panel.retop?.()
      const flow = findFlow()
      if (!flow) { if (piano.items.length) buildKeys(); return }
      if (flow.column !== piano.column) { buildKeys(); return }
      // 一次选择器统计用户轮数（比逐 item querySelector 便宜一个量级）
      const users = flow.column.querySelectorAll('[class*="userRow"]').length
      if (users !== piano.items.length) buildKeys()
      // dsh 重渲染可能清掉会话根上的平移样式 → 顺手补推
      applyPush()
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
