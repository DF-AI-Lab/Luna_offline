// Luna's moon (copied from DF-AI-Lab/luna app/luna.html), drawn once at a set size, waning crescent, no spin.
(function () {
  const date = new Date(Date.UTC(2026, 10, 12));
  const ref = Date.UTC(2000, 0, 6, 18, 14);        // known new moon
  const f = ((((date - ref) / 86400000) % 29.530589) + 29.530589) % 29.530589 / 29.530589;  // 0 new, .5 full
  const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  

  const cv = document.getElementById('moon');
  const S = window.MOON_SIZE;
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(S, S), px = img.data;
  // seeded value noise, wraps in x so the surface map has no seam
  let seed = 42; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const G = 64, grid = Array.from({ length: G * G }, rnd);
  const sm = t => t * t * (3 - 2 * t);
  function noise(x, y, P) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const g = (a, b) => grid[((b % G + G) % G) * G + ((a % P + P) % P)];
    return (g(xi, yi) * (1 - xf) + g(xi + 1, yi) * xf) * (1 - yf) + (g(xi, yi + 1) * (1 - xf) + g(xi + 1, yi + 1) * xf) * yf;
  }
  const fbm = (x, y) => noise(x, y, 8) * .5 + noise(x * 2, y * 2, 16) * .25 + noise(x * 4, y * 4, 32) * .125 + noise(x * 8, y * 8, 64) * .0625;
  const unit = (x, y) => [x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y))];
  // near-side maria (x right, y up on the sphere), far side mostly highlands
  const maria = [[-.38,.38,.27],[.12,.36,.17],[.3,.08,.2],[.62,.25,.12],[.5,-.15,.15],[.38,-.32,.1],[-.2,-.36,.17],[-.6,.02,.3],[-.48,-.3,.16],[-.05,.62,.28]]
    .map(([x, y, r]) => [...unit(x, y), r]);
  const craters = Array.from({ length: 150 }, () => {
    const zz = rnd() * 2 - 1, t = rnd() * 6.283, q = Math.sqrt(1 - zz * zz);
    return [q * Math.sin(t), zz, q * Math.cos(t), .015 + rnd() ** 2 * .08];
  });
  const ty = unit(-.15, -.66); craters.push([...ty, .05]);   // Tycho
  const e1 = [ty[2], 0, -ty[0]], n1 = Math.hypot(...e1); e1.forEach((v, k) => e1[k] = v / n1);
  const e2 = [ty[1] * e1[2] - ty[2] * e1[1], ty[2] * e1[0] - ty[0] * e1[2], ty[0] * e1[1] - ty[1] * e1[0]];
  // bake a surface map once (longitude x latitude), then spin it each frame
  const TW = 512, TH = 256, tex = new Float32Array(TW * TH);
  for (let v = 0; v < TH; v++) for (let u = 0; u < TW; u++) {
    const lon = (u / TW - .5) * 6.2832, lat = (.5 - (v + .5) / TH) * Math.PI;
    const X = Math.cos(lat) * Math.sin(lon), Y = Math.sin(lat), Z = Math.cos(lat) * Math.cos(lon);
    const fx = u / TW * 8, fy = v / TH * 4;
    let a = .78 + (fbm(fx + .3, fy + 3) - .5) * .25, m = 0;
    for (const [mx, my, mz, mr] of maria) {
      const d = Math.hypot(X - mx, Y - my, Z - mz) / (mr * (.8 + .5 * fbm(fx * 2 + mx * 9, fy * 2)));
      m = Math.max(m, 1 - sm(Math.min(1, Math.max(0, (d - .6) / .5))));
    }
    a -= m * .36;
    for (const [cx, cy, cz, cr] of craters) {
      const d = Math.hypot(X - cx, Y - cy, Z - cz) / cr;
      if (d < 1.1) a += d < .85 ? -.045 * (1 - m * .5) * (1 - d * .6) : .045 * (1 - Math.abs(d - .95) * 6);
    }
    const dx = X - ty[0], dy = Y - ty[1], dz = Z - ty[2], td = Math.hypot(dx, dy, dz);
    if (td > .05 && td < .9) {
      const ang = Math.atan2(dx * e2[0] + dy * e2[1] + dz * e2[2], dx * e1[0] + dy * e1[1] + dz * e1[2]);
      a += Math.max(0, Math.sin(ang * 9 + 1) ** 24) * .12 * (1 - td);
    }
    tex[v * TW + u] = a;
  }
  // light comes from the real phase, so the shadow stays true while the surface turns
  const fl = Math.min(.87, Math.max(.13, f));   // always keep a thin crescent visible
  const th = 2 * Math.PI * fl, Lx = Math.sin(th), Lz = -Math.cos(th);
  function draw(rot) {
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = (i + .5) / S * 2 - 1, y = (j + .5) / S * 2 - 1, r2 = x * x + y * y;
      const o = (j * S + i) * 4;
      if (r2 > 1) { px[o + 3] = 0; continue; }
      const z = Math.sqrt(1 - r2);
      let lu = (Math.atan2(x, z) + rot) / 6.2832 + .5; lu -= Math.floor(lu);
      const lv = .5 - Math.asin(-y) / Math.PI;
      const a = tex[Math.min(TH - 1, lv * TH | 0) * TW + (lu * TW | 0) % TW];
      const ndl = x * Lx + z * Lz;
      const day = sm(Math.min(1, Math.max(0, (ndl + .04) / .14)));
      const lit = a * day * (.45 + .55 * Math.max(0, ndl)) * (.8 + .2 * z) * 1.3;
      const glow = (1 - day) * (.06 + a * .07 + .08 * (1 - z) ** 3);   // soft earthshine + rim on the dark side
      px[o]     = Math.min(255, lit * 255 + glow * 190);
      px[o + 1] = Math.min(255, lit * 247 + glow * 205);
      px[o + 2] = Math.min(255, lit * 228 + glow * 235);
      px[o + 3] = 255 * Math.min(1, (1 - Math.sqrt(r2)) * S * .5);
    }
    ctx.putImageData(img, 0, 0);
  }
  draw(0.6);
})();
