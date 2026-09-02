async (page) => {
  const out = {};
  // 1) 点击第 8 个琴键（最后一条回答）→ 应滚动 + 闪烁
  out.jump = await page.evaluate(() => {
    const strip = document.querySelector('.pnb-piano');
    const keys = strip.querySelectorAll('.pnb-key');
    const r = keys[7].getBoundingClientRect();
    strip.dispatchEvent(new MouseEvent('click', { bubbles: true, clientY: r.top + r.height / 2 }));
    return new Promise((res) => setTimeout(() => {
      const item = [...document.querySelectorAll('[class*="flowItem"]')][7];
      const sr = strip.getBoundingClientRect();
      res({ flashed: item.classList.contains('pnb-flash'), scrollerTop: document.querySelector('[class*="flowItem"]').parentElement.closest('[class*="scroll"]')?.scrollTop });
    }, 500));
  });
  // 2) 点右上角 ghost 按钮开面板
  out.panelOpen = await page.evaluate(() => {
    document.querySelector('.pnb-sidebtn').click();
    return document.querySelector('.pnb-panel').classList.contains('pnb-open');
  });
  // 3) 点击消息里的绝对路径 code → fetch 端点（未安装，应优雅报错）
  out.fileClick = await page.evaluate(() => {
    const codes = [...document.querySelectorAll('[class*="flowItem"] code')];
    const target = codes.map(c => c.textContent.trim()).find(t => t.includes('package.json') && t.includes('\\\\') || (t.includes('C:') && t.includes('package.json')));
    if (!target) return { skip: 'no path code', all: codes.map(c => c.textContent.trim()) };
    codes.find(c => c.textContent.trim() === target).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return { clicked: target };
  });
  await page.waitForTimeout(1200);
  out.panelState = await page.evaluate(() => {
    const p = document.querySelector('.pnb-panel');
    return { open: p.classList.contains('pnb-open'), title: p.querySelector('.pnb-title').textContent.slice(0, 70), body: p.querySelector('.pnb-body').textContent.slice(0, 120) };
  });
  // 4) Esc 关面板
  out.esc = await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return !document.querySelector('.pnb-panel').classList.contains('pnb-open');
  });
  return out;
}
