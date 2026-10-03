// Browser-Smoke-Test (Demo-Modus): Karte lädt, Layer-Toggle, Punkt-Check an 3 Positionen, Mobile-Viewport.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = 4173;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const url = `http://127.0.0.1:${PORT}/?demo=1`;
await new Promise((r) => setTimeout(r, 2500));

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
let failed = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) failed++; };

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Basemap-Kacheln: Egress ist hier gesperrt → 1x1 transparentes PNG liefern.
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  await page.route(/wien\.gv\.at/, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  page.on('console', (m) => { if (m.type() === 'error') console.log('console.error:', m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__map?.isStyleLoaded() && window.__map.getSource('pin'), null, { timeout: 20000 });

  const click = async (lng, lat, zoom = 9) => {
    await page.evaluate(([lng, lat, z]) => new Promise((res) => { window.__map.jumpTo({ center: [lng, lat], zoom: z }); setTimeout(res, 800); }), [lng, lat, zoom]);
    await page.evaluate(() => { window.__lastCheck = null; });
    const p = await page.evaluate(([lng, lat]) => window.__map.project([lng, lat]), [lng, lat]);
    await page.mouse.click(p.x, p.y);
    await page.waitForFunction(() => window.__lastCheck, null, { timeout: 10000 });
    return { status: await page.evaluate(() => window.__lastCheck), text: await page.textContent('#result-body') };
  };

  let r = await click(16.57, 48.11);
  ok(r.status === 'restricted' && r.text.includes('CTR Wien'), `Wien CTR → restricted (${r.status})`);
  r = await click(12.7, 47.12, 10);
  ok(r.status === 'restricted' && r.text.includes('Hohe Tauern'), `Hohe Tauern → restricted (${r.status})`);
  r = await click(15.5, 47.0);
  ok(r.status === 'clear', `Landschaftsschutzgebiet (ausgeschlossen) → clear (${r.status})`);
  r = await click(11.0, 47.3);
  ok(r.status === 'clear', `Punkt ohne Zone → clear (${r.status})`);

  await page.uncheck('#t-airspace');
  const vis = await page.evaluate(() => window.__map.getLayoutProperty('airspace-fill', 'visibility'));
  ok(vis === 'none', 'Layer-Toggle blendet Luftraum aus');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  ok(!overflow, 'kein horizontaler Overflow @390px');
  ok(errors.length === 0, `keine JS-Fehler ${errors.join('|')}`);
  await page.screenshot({ path: process.env.SHOT || 'smoke.png' });
} finally {
  await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
