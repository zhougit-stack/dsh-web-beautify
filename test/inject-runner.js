async (page) => {
  await page.evaluate(() => {
    window.__pnbErr = null;
    // 与真实宿主一致的加载路径：ModuleLoader.load → factory → apply(ctx)
    window.__ModuleLoader__ = { load: ({ factory }) => {
      let mod;
      try { mod = factory(() => ({})); } catch (e) { window.__pnbErr = 'factory: ' + (e && e.message); return; }
      try { mod.apply({}); } catch (e) { window.__pnbErr = 'apply: ' + (e && e.message); }
    } };
  });
  await page.addScriptTag({ path: 'C:/Users/Administrator/.claude/workspace/dsh-web-beautify/lib/client.js' });
  return await page.evaluate(() => ({
    err: window.__pnbErr,
    uiPresent: !!document.querySelector('.pnb-piano'),
    keys: document.querySelectorAll('.pnb-key').length,
    panel: !!document.querySelector('.pnb-panel'),
    toggle: !!document.querySelector('.pnb-toggle'),
    logs: (window.__pnbLogs = window.__pnbLogs || []),
  }));
}
