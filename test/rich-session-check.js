async (page) => {
  await page.waitForTimeout(1500); // 等 MutationObserver 防抖重建琴键
  const out = {};
  out.keys = await page.evaluate(() => ({
    n: document.querySelectorAll('.pnb-key').length,
    void: document.querySelector('.pnb-piano').classList.contains('pnb-void'),
  }));
  // 长会话跳转：点第一个琴键 → 滚动应发生变化
  out.jump = await page.evaluate(() => new Promise((res) => {
    const strip = document.querySelector('.pnb-piano');
    const first = strip.querySelector('.pnb-key');
    const r = first.getBoundingClientRect();
    const sc = document.querySelector('[class*="flowItem"]').parentElement;
    let scroller = sc;
    while (scroller && scroller !== document.body) { if (/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) break; scroller = scroller.parentElement; }
    const before = scroller.scrollTop;
    strip.dispatchEvent(new MouseEvent('click', { bubbles: true, clientY: r.top + r.height / 2 }));
    setTimeout(() => res({ before, after: scroller.scrollTop, changed: scroller.scrollTop !== before }), 900);
  }));
  // 代码块点击 → 代码预览
  out.codeClick = await page.evaluate(() => {
    const pre = document.querySelector('[class*="flowItem"] pre');
    if (!pre) return { skip: 'no pre in this session' };
    pre.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return new Promise((res) => setTimeout(() => {
      const p = document.querySelector('.pnb-panel');
      res({ open: p.classList.contains('pnb-open'), tag: p.querySelector('.pnb-tag')?.textContent, sample: p.querySelector('.pnb-body').textContent.slice(0, 80) });
    }, 300));
  });
  return out;
}
