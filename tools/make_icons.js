// node tools/make_icons.js → docs/icons/*.png  (Luna Assist logo, 9 Nov: LUNA on top,
// crescent moon with a blue orbit ring in the middle, ASSIST below, deep-blue sky)
const { chromium } = require('playwright'); const path = require('path');
const stars = (n, seed) => { let s = seed, out = ''; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) out += `<circle cx="${(r() * 100).toFixed(1)}" cy="${(r() * 100).toFixed(1)}" r="${(.3 + r() ** 3 * 1.1).toFixed(2)}" fill="#fff" opacity="${(.3 + r() * .6).toFixed(2)}"/>`; return out; };
const crescent = (cx, cy, r) => `<path d="M${cx + r * .25} ${cy - r}a${r} ${r} 0 1 0 ${r * .75} ${r * 1.72}A${r * .86} ${r * .86} 0 0 1 ${cx + r * .25} ${cy - r}z" fill="#f4ecd2"/>`;
// scale < 1 = the mark shrinks into the middle (maskable icons get cut to a circle)
const mark = `<path d="M17 63 A36 13 -22 0 1 83 37" fill="none" stroke="#8fd0ff" stroke-width="4.5" stroke-linecap="round" opacity=".55"/>
  <circle cx="50" cy="50" r="27" fill="#0a1626"/><path d="M50 23 A27 27 0 0 0 50 77 A15 27 0 0 1 50 23z" fill="#f4ecd2"/>
  <path d="M83 37 A36 13 -22 0 1 17 63" fill="none" stroke="#8fd0ff" stroke-width="4.5" stroke-linecap="round"/><circle cx="17" cy="63" r="5.5" fill="#d8efff"/>`;
const svg = scale => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs><radialGradient id="g" cx=".3" cy=".2" r="1"><stop offset="0" stop-color="#1d4a74"/><stop offset=".6" stop-color="#0c2140"/><stop offset="1" stop-color="#06101f"/></radialGradient></defs>
  <rect width="100" height="100" fill="url(#g)"/>
  <g transform="translate(50 50) scale(${scale}) translate(-50 -50)">
  <text x="51" y="22" text-anchor="middle" font-family="Josefin Sans" font-weight="600" font-size="12" letter-spacing="5" fill="#f4ecd2">LUNA</text>
  <g transform="translate(50 52) scale(.62) translate(-50 -50)">${mark}</g>
  <text x="51" y="89" text-anchor="middle" font-family="Josefin Sans" font-weight="600" font-size="9.5" letter-spacing="4" fill="#bfe4ff">ASSIST</text></g></svg>`;
(async () => {
  const b = await chromium.launch();
  for (const [name, size, scale] of [['icon-192', 192, 1], ['icon-512', 512, 1], ['maskable-512', 512, .78]]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@600&display=block"><body style="margin:0"><div style="width:${size}px;height:${size}px">${svg(scale)}</div></body>`);
    await p.evaluate(() => document.fonts.load('600 15px "Josefin Sans"')); await p.evaluate(() => document.fonts.ready);
    if (!(await p.evaluate(() => document.fonts.check('600 15px "Josefin Sans"')))) throw new Error('Josefin Sans did not load');
    await p.screenshot({ path: path.join(__dirname, '../docs/icons', name + '.png'), clip: { x: 0, y: 0, width: size, height: size } });
    await p.close();
  }
  await b.close(); console.log('icons done');
})();
