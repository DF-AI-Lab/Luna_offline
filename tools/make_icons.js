// node tools/make_icons.js → docs/icons/*.png  (Option B "Wordmark", picked by Darren 8 Nov:
// LUNA in the header's thin wide Josefin Sans letters, small crescent above, night sky)
const { chromium } = require('playwright'); const path = require('path');
const stars = (n, seed) => { let s = seed, out = ''; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) out += `<circle cx="${(r() * 100).toFixed(1)}" cy="${(r() * 100).toFixed(1)}" r="${(.3 + r() ** 3 * 1.1).toFixed(2)}" fill="#fff" opacity="${(.3 + r() * .6).toFixed(2)}"/>`; return out; };
const crescent = (cx, cy, r) => `<path d="M${cx + r * .25} ${cy - r}a${r} ${r} 0 1 0 ${r * .75} ${r * 1.72}A${r * .86} ${r * .86} 0 0 1 ${cx + r * .25} ${cy - r}z" fill="#f4ecd2"/>`;
// scale < 1 = the mark shrinks into the middle (maskable icons get cut to a circle)
const svg = scale => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050a18"/><stop offset="1" stop-color="#16213f"/></linearGradient>
  <radialGradient id="h" cx=".46" cy=".37" r=".35"><stop offset="0" stop-color="#f4ecd2" stop-opacity=".16"/><stop offset="1" stop-color="#f4ecd2" stop-opacity="0"/></radialGradient></defs>
  <rect width="100" height="100" fill="url(#g)"/>${stars(18, 3)}
  <g transform="translate(50 50) scale(${scale}) translate(-50 -50)"><rect width="100" height="100" fill="url(#h)"/>${crescent(46, 37, 12)}
  <text x="51" y="72" text-anchor="middle" font-family="Josefin Sans" font-weight="300" font-size="15" letter-spacing="5" fill="#f4ecd2">LUNA</text></g></svg>`;
(async () => {
  const b = await chromium.launch();
  for (const [name, size, scale] of [['icon-192', 192, 1], ['icon-512', 512, 1], ['maskable-512', 512, .78]]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300&display=block"><body style="margin:0"><div style="width:${size}px;height:${size}px">${svg(scale)}</div></body>`);
    await p.evaluate(() => document.fonts.load('300 15px "Josefin Sans"')); await p.evaluate(() => document.fonts.ready);
    if (!(await p.evaluate(() => document.fonts.check('300 15px "Josefin Sans"')))) throw new Error('Josefin Sans did not load');
    await p.screenshot({ path: path.join(__dirname, '../docs/icons', name + '.png'), clip: { x: 0, y: 0, width: size, height: size } });
    await p.close();
  }
  await b.close(); console.log('icons done');
})();
