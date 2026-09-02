async (page) => {
  await page.evaluate(() => {
    localStorage.removeItem('pnb-piano-collapsed');
    document.querySelectorAll('.pnb-piano,.pnb-panel,.pnb-sidebtn,.pnb-tip').forEach((e) => e.remove());
    document.querySelectorAll('style').forEach((e) => { if (e.textContent.includes('.pnb-piano')) e.remove(); });
    window.__pnbErr = null;
    window.__ModuleLoader__ = { load: ({ factory }) => { const m = factory(() => ({})); m.apply({}); } };
  });
  await page.addScriptTag({ path: 'C:/Users/Administrator/.claude/workspace/dsh-web-beautify/lib/client.js' });
  await page.waitForTimeout(1000);
  // 精确悬停在某一根琴键（第 3 根 slot 中心）上
  const res = await page.evaluate(() => {
    const strip = document.querySelector('.pnb-piano');
    const slots = [...strip.querySelectorAll('.pnb-slot')];
    const t = slots[2].getBoundingClientRect();
    const y = t.top + t.height / 2;
    strip.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientY: y }));
    const widths = [...strip.querySelectorAll('.pnb-key')].map(k => parseFloat(k.style.width || '10'));
    const tip = document.querySelector('.pnb-tip');
    const tipR = tip.getBoundingClientRect();
    return {
      n: slots.length,
      widths: widths.map(w => w.toFixed(1)),
      hoveredIndex: widths.indexOf(Math.max(...widths)),
      tipHtml: [tip.querySelector('.pnb-tip-user')?.textContent.slice(0, 40), tip.querySelector('.pnb-tip-reply')?.textContent.slice(0, 40)],
      tipAligns: Math.abs((tipR.top + tipR.height / 2) - y) < 40,
      stripX: strip.getBoundingClientRect().x | 0,
      err: window.__pnbErr,
    };
  });
  return res;
}
