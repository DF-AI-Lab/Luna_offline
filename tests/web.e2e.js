// End-to-end: the installable web app in a phone browser, real code, fake servers.
// node tests/web.e2e.js [outdir]   (needs: python3 -m http.server on docs/ — started here)
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process'), path = require('path'), assert = require('assert');
const OUT = process.argv[2] || path.join(__dirname, 'out');
require('fs').mkdirSync(OUT, { recursive: true });
const ROOT = path.join(__dirname, '..');
const PORT = 8765, BASE = `http://localhost:${PORT}/Luna_offline/`;
const TN = 'https://tasknotes.df-ai-lab-hq.workers.dev', WMM = 'https://wmm-lite.df-ai-lab-hq.workers.dev';

(async () => {
  // serve docs/ at /Luna_offline/ like GitHub Pages
  const fs = require('fs'), tmp = fs.mkdtempSync('/tmp/luna-');
  fs.symlinkSync(path.join(ROOT, 'docs'), path.join(tmp, 'Luna_offline'));
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '-d', tmp], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const calls = [], b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { console.log('PAGE ERROR', e.message); process.exitCode = 1; });
  const json = (route, o, status) => route.fulfill({ status: status || 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(o) });

  // Passport in pretend mode (no Google) for the test
  await page.route('**/passport/config.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.PASSPORT_CONFIG={googleClientId:""};' }));
  // both MCP Workers: login + tools
  for (const W of [TN, WMM]) {
    await page.route(W + '/.well-known/oauth-authorization-server', r => json(r, { authorization_endpoint: W + '/authorize', token_endpoint: W + '/token', registration_endpoint: W + '/register' }));
    await page.route(W + '/register', r => { const b = r.request().postDataJSON(); assert.deepStrictEqual(b.redirect_uris, [BASE]); return json(r, { client_id: 'cid-' + W.length }, 201); });
    await page.route(W + '/authorize?*', r => { const u = new URL(r.request().url()); const back = new URL(u.searchParams.get('redirect_uri'));
      back.searchParams.set('code', 'code1'); back.searchParams.set('state', u.searchParams.get('state'));
      return r.fulfill({ status: 302, headers: { location: back.toString() } }); });
    await page.route(W + '/token', r => { const p = new URLSearchParams(r.request().postData()); calls.push(['token', W, p.get('grant_type'), !!p.get('code_verifier')]);
      return json(r, { access_token: 'at-' + W.length, refresh_token: 'rt', expires_in: 3600, token_type: 'Bearer' }); });
    await page.route(W + '/mcp', r => { const req = r.request(); const m = req.postDataJSON(); calls.push(['mcp', W, m.params.name, m.params.arguments, req.headers().authorization]);
      const n = m.params.name; let text = '[x1] ok';
      if (n === 'day_summary') text = 'Today is 2026-11-08. 1 task(s) due or overdue.\n- [t_1] Fix sofa from moving | Home | OVERDUE, was 2026-10-26 | 📝 Need to find a solution';
      if (n === 'add_task') text = 'Added [t_new] Buy bin bags';
      if (n === 'add_spend') text = 'Sent: £12.50 Tesco. id c-20261108-101500-ab12. Shows when the app opens.';
      if (n === 'money_summary') text = "Where's My Money? (x)\nSpare cash left: £272.02 · Spent so far: £1051.95 · Still to come out: £284.00\nCredit card: £193.36 used, £306.64 free\n\nPots:\n- Fuel: £50.00 used of £50.00\n\nBills:\n- Phone: £151.00, day 15, not paid yet";
      return json(r, { jsonrpc: '2.0', id: m.id, result: { content: [{ type: 'text', text }], isError: false } }); });
  }
  // Google Calendar
  await page.route('https://www.googleapis.com/calendar/v3/**', r => { const req = r.request(); calls.push(['cal', req.method(), req.url().split('?')[0].split('/').pop()]);
    if (req.method() === 'GET') return json(r, { items: [{ id: 'e1', summary: 'Chiropractic appointment', start: { dateTime: '2026-11-10T17:30:00Z' } }] });
    if (req.method() === 'POST') return json(r, { id: 'ev9', ...req.postDataJSON() });
    return r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } }); });
  // Claude API (only for the 'Always Claude' check)
  await page.route('https://api.anthropic.com/**', r => { const body = r.request().postDataJSON(); calls.push(['claude', body.model, body.fallbacks, body.output_config]);
    return json(r, { id: 'm1', type: 'message', role: 'assistant', model: body.model, stop_reason: 'end_turn', content: [{ type: 'text', text: '{"kind":"note","title":"Gate code","text":"gate code is 4321","date":"","time":""}' }], usage: { input_tokens: 900, output_tokens: 120 } }); });

  const inIfLocked = async () => {
    await page.waitForFunction(() => { const c = document.getElementById('ppcover'); return c && (c.hidden || document.querySelector('#f input[type=password]')); });
    if (!(await page.isHidden('#ppcover'))) { await page.fill('#f input[type=password]', '123456'); await page.click('#f button[type=submit]'); }
    await page.waitForFunction(() => { const c = document.getElementById('ppcover'); return c && c.hidden; }); await page.waitForTimeout(700);
  };
  // 1) Passport first run
  await page.goto(BASE); await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + '/1-passport.png' });
  await page.click('#g'); await page.fill('#em', 'darren@example.com'); await page.click('#f button[type=submit], #f .ps-btn');
  await page.fill('#nm', 'Darren Fawcett'); await page.fill('#pc', '123456'); await page.fill('#pc2', '123456'); await page.click('#f button[type=submit]');
  await page.click('#ok'); if (await page.$('#no')) await page.click('#no');
  await page.waitForTimeout(800);
  assert.equal(await page.isHidden('#ppcover'), true, 'cover hidden after unlock');
  // not connected yet → helpful words, not claude.ai's
  await page.waitForTimeout(500);
  const firstSay = await page.locator('.log .them').last().innerText();
  assert.match(firstSay, /Tap ⚙ to connect/, firstSay);

  // 2) connect TaskNotes + WMM through their login, Calendar with a token
  for (const name of ['TaskNotes', "Where's My Money"]) {
    await page.click('#lw-gear'); await page.click(`[data-app="${name}"]`); await page.waitForURL(BASE); await inIfLocked();
  }
  await page.evaluate(() => { localStorage.setItem('luna_cal_token', JSON.stringify({ token: 'g1', exp: Date.now() + 3e6 })); localStorage.setItem('luna_cal_on', 'true'); });
  await page.reload(); await inIfLocked(); await page.waitForTimeout(600);
  await page.click('#lw-gear'); await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/2-settings.png' });
  const on = await page.locator('.lw-on').count(); assert.ok(on >= 3, 'three apps on: ' + on);
  await page.click('#lw-x');
  await page.screenshot({ path: OUT + '/3-home.png' });

  // 3) messages, all with the FREE brain
  const send = async t => { await page.fill('#text', t); await page.click('#sendbtn'); await page.waitForTimeout(700); };
  await send('buy bin bags');
  await send('dentist tue 3pm');
  await send('£12.50 tesco');
  await page.locator('.log .them').last().locator('text=Undo').click(); await page.waitForTimeout(500);
  await send("how's my money");
  await page.screenshot({ path: OUT + '/4-chat.png' });
  // 4) Always Claude, with a key + cap
  await page.evaluate(() => { localStorage.setItem('luna_brain_mode', 'claude'); localStorage.setItem('luna_claude_key', 'sk-ant-test'); });
  await send('gate code 4321'); await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + '/5-claude.png' });

  // 5) update sheet: the server says there's a newer version
  await page.route('**/version.json*', r => json(r, { version: '9.99', notes: ['Test note one', 'Test note two'] }));
  await page.evaluate(() => LunaSettings.checkUpdate()); await page.waitForTimeout(500);
  assert.equal(await page.isVisible('#lw-upd'), true, 'update sheet shows');
  assert.match(await page.locator('#lw-upd').innerText(), /Luna v9\.99 is here[\s\S]*You're on v1\.\d+[\s\S]*Test note one/);
  await page.screenshot({ path: OUT + '/6-update.png' });
  await page.click('#lw-later'); assert.equal(await page.isHidden('#lw-upd'), true, 'Later hides it');
  await page.evaluate(() => LunaSettings.checkUpdate()); await page.waitForTimeout(400);
  assert.equal(await page.isHidden('#lw-upd'), true, 'Later = not again this visit');
  assert.match(await page.locator('#lw-ver').innerText(), /^v\d+\.\d+$/);

  const names = calls.filter(c => c[0] === 'mcp').map(c => c[2]);
  console.log(JSON.stringify(calls.filter(c => c[0] !== 'mcp' || !['day_summary'].includes(c[2])), null, 0));
  for (const n of ['day_summary', 'add_task', 'add_spend', 'remove_added', 'money_summary', 'add_note']) assert.ok(names.includes(n), 'called ' + n);
  assert.ok(calls.some(c => c[0] === 'cal' && c[1] === 'POST'), 'diary event made');
  assert.ok(calls.some(c => c[0] === 'token' && c[2] === 'authorization_code' && c[3]), 'PKCE login');
  const cl = calls.find(c => c[0] === 'claude'); assert.ok(cl && cl[1] === 'claude-opus-5-5' && cl[2] === 'default' && cl[3].effort === 'low', 'claude call shape');
  const spend = await page.evaluate(() => JSON.parse(localStorage.getItem('luna_claude_spend')));
  assert.ok(spend.usd > 0 && spend.calls === 1, 'spend tracked ' + JSON.stringify(spend));
  const logRows = await page.evaluate(() => Object.keys((JSON.parse(localStorage.getItem('luna_db_v1')) || {}).log || {}).length);
  assert.ok(logRows >= 5, 'log saved: ' + logRows);
  console.log('E2E OK', OUT);
  await b.close(); srv.kill();
})().catch(e => { console.error('E2E FAIL', e); process.exit(1); });
