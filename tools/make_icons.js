// node tools/make_icons.js → docs/icons/*.png (Luna's real moon on the night sky)
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const moon = fs.readFileSync(path.join(__dirname, 'moon.js'), 'utf8');
(async () => {
  const b = await chromium.launch();
  for (const [name, size, pad] of [['icon-192', 192, .12], ['icon-512', 512, .12], ['maskable-512', 512, .24]]) {
    const p = await b.newPage({ viewport: { width: size, height: size } }); p.on('pageerror', e => console.log(name, e.message));
    await p.setContent(`<body style="margin:0"><canvas id="c" width="${size}" height="${size}"></canvas><canvas id="moon"></canvas><script>
      const S=${size}, c=document.getElementById('c'), x=c.getContext('2d');
      const g=x.createLinearGradient(0,0,0,S); g.addColorStop(0,'#02040a'); g.addColorStop(.6,'#081224'); g.addColorStop(1,'#18263c'); x.fillStyle=g; x.fillRect(0,0,S,S);
      const r=x.createRadialGradient(S*.5,S*.5,S*.1,S*.5,S*.5,S*.55); r.addColorStop(0,'rgba(169,155,255,.18)'); r.addColorStop(1,'transparent'); x.fillStyle=r; x.fillRect(0,0,S,S);
      let s=7; const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
      for(let i=0;i<S/3;i++){ x.globalAlpha=.25+rnd()*.6; x.fillStyle='#fff'; x.beginPath(); x.arc(rnd()*S,rnd()*S,(.3+rnd()**3*1.3)*S/256,0,6.3); x.fill(); }
      x.globalAlpha=1; window.MOON_SIZE=Math.round(S*(1-2*${pad}));
    <\/script><script>${moon}<\/script><script>
      const m=document.getElementById('moon'); const o=(S-m.width)/2; x.shadowColor='rgba(244,236,210,.35)'; x.shadowBlur=S*.08; x.drawImage(m,o,o);
    <\/script></body>`);
    await p.waitForTimeout(300);
    await p.locator('#c').screenshot({ path: path.join(__dirname, '../docs/icons', name + '.png') });
  }
  await b.close(); console.log('icons done');
})();
