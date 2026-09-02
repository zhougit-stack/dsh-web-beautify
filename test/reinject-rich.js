async (page) => {
  await page.evaluate(() => {
    localStorage.removeItem('pnb-piano-collapsed');
    window.__pnbErr = null;
    window.__ModuleLoader__ = { load: ({ factory }) => {
      let mod;
      try { mod = factory(() => ({})); } catch (e) { window.__pnbErr = 'factory: ' + (e && e.message); return; }
      try { mod.apply({}); } catch (e) { window.__pnbErr = 'apply: ' + (e && e.message); }
    } };
  });
  await page.addScriptTag({ path: 'C:/Users/Administrator/.claude/workspace/dsh-web-beautify/lib/client.js' });
  await page.waitForTimeout(1200);
  const out = {};
  out.mount = await page.evaluate(() => ({
    err: window.__pnbErr,
    n: document.querySelectorAll('.pnb-key').length,
    stripH: document.querySelector('.pnb-piano').getBoundingClientRect().height | 0,
    stripX: document.querySelector('.pnb-piano').getBoundingClientRect().x | 0,
  }));
  // 长会话跳转：点第一个琴键
  out.jump = await page.evaluate(() => new Promise((res) => {
    const strip = document.querySelector('.pnb-piano');
    const first = strip.querySelector('.pnb-key');
    const r = first.getBoundingClientRect();
    let scroller = document.querySelector('[class*="flowItem"]').parentElement;
    while (scroller && scroller !== document.body) { if (/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) break; scroller = scroller.parentElement; }
    const before = scroller.scrollTop;
    strip.dispatchEvent(new MouseEvent('click', { bubbles: true, clientY: r.top + r.height / 2 }));
    setTimeout(() => res({ before, after: scroller.scrollTop | 0, changed: scroller.scrollTop !== before }), 900);
  }));
  // 代码块点击 → 预览
  out.code = await page.evaluate(() => {
    const pre = document.querySelector('[class*="flowItem"] pre');
    if (!pre) return { skip: 'no pre' };
    pre.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return new Promise((res) => setTimeout(() => {
      const p = document.querySelector('.pnb-panel');
      res({ open: p.classList.contains('pnb-open'), tag: p.querySelector('.pnb-tag')?.textContent || null, head: p.querySelector('.pnb-body').textContent.slice(0, 60) });
    }, 300));
  });
  // hover 中部琴键出气泡 + 渐变（供截图）
  out.hover = await page.evaluate(() => {
    const strip = document.querySelector('.pnb-piano');
    const r = strip.getBoundingClientRect();
    strip.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientY: r.top + r.height * 0.5 }));
    return { widths: [...strip.querySelectorAll('.pnb-key')].slice(0, 12).map(k => parseFloat(k.style.width || '10')) };
  });
  return out;
}
