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
  // 等 buildKeys 完成
  await page.waitForTimeout(400);
  // 模拟鼠标在琴键列中部移动，触发渐变 + 摘要气泡
  const info = await page.evaluate(() => {
    const strip = document.querySelector('.pnb-piano');
    if (!strip) return { err: 'no strip' };
    const r = strip.getBoundingClientRect();
    const y = r.top + r.height * 0.5;
    strip.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientY: y, clientX: r.left + 8 }));
    const widths = [...strip.querySelectorAll('.pnb-key')].map(k => parseFloat(k.style.width || '14'));
    return {
      err: window.__pnbErr,
      stripRect: [r.x | 0, r.y | 0, r.width | 0, r.height | 0],
      keys: widths.length,
      widths,
      tipVisible: (() => { const t = document.querySelector('.pnb-tip'); return t && t.style.display !== 'none' ? t.textContent.slice(0, 50) : null; })(),
    };
  });
  return info;
}
