async (page) => {
  // 清掉旧 UI 重注入（热更新本轮改动）
  await page.evaluate(() => {
    document.querySelectorAll('.pnb-piano,.pnb-panel,.pnb-sidebtn,.pnb-tip,style').forEach((e) => {
      if (e.tagName === 'STYLE' && e.textContent.includes('.pnb-piano')) e.remove();
      else if (e.className && String(e.className).startsWith('pnb-')) e.remove();
    });
    window.__pnbErr = null;
    window.__ModuleLoader__ = { load: ({ factory }) => { const m = factory(() => ({})); m.apply({}); } };
  });
  await page.addScriptTag({ path: 'C:/Users/Administrator/.claude/workspace/dsh-web-beautify/lib/client.js' });
  await page.waitForTimeout(900);
  // hover 琴键列中部偏下（有内容的位置），触发渐变 + 气泡
  await page.evaluate(() => {
    const strip = document.querySelector('.pnb-piano');
    const r = strip.getBoundingClientRect();
    strip.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientY: r.top + r.height * 0.55, clientX: r.left + 6 }));
  });
  await page.waitForTimeout(250);
  return await page.evaluate(() => {
    const strip = document.querySelector('.pnb-piano');
    const ws = [...strip.querySelectorAll('.pnb-key')].map(k => parseFloat(k.style.width || '10'));
    return { n: ws.length, peak: Math.max(...ws), sample: ws.slice(80, 92).map(v => v.toFixed(1)), tip: document.querySelector('.pnb-tip').textContent.slice(0, 60) };
  });
}
