// Luna Offline web: Passport lock + ⚙ settings (apps, brain, data). Look only; Orbit's logic is untouched.
(function () {
  'use strict';
  const VERSION = '1.05';   // shown at the top; bump on every update (tools/build_web.py writes version.json from it)
  // "What's new" lines for THIS version: shown in the update sheet on phones still on an older version. Short, plain.
  const NOTES = ['Update now actually updates (no more loop)', 'Money fix: add 20 to spends now goes to Money (no £ needed)', 'Luna Assist logo and blue theme'];
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const cover = $('ppcover'), mount = $('ppmount');
  const APPS = [['Google Calendar', 'Diary', 'cal'], ['TaskNotes', 'To-do + Notes', 'todo'], ["Where's My Money", 'Money', 'money']];

  // ---------- toast / banner ----------
  function toast(text, action) {
    let t = $('lw-toast'); if (!t) { t = document.createElement('div'); t.id = 'lw-toast'; t.className = 'lw-toast'; t.setAttribute('role', 'status'); document.body.append(t); }
    t.innerHTML = `<span>${esc(text)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
    if (action) t.querySelector('button').onclick = () => { t.hidden = true; action.go(); };
    t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, action ? 12000 : 4000);
  }
  window.addEventListener('luna-need', e => {
    const { server, why } = e.detail;
    const short = (APPS.find(a => a[0] === server) || [server, server])[1];
    toast(why === 'reconnect' ? `${short}: tap to reconnect` : `${short} isn't connected`,
      { label: why === 'reconnect' ? 'Reconnect' : 'Connect', go: () => why === 'reconnect' && server === 'Google Calendar' ? reconnectCal() : openSheet() });
  });
  async function reconnectCal() {
    try { await LunaMCP.connectCalendar(true); toast('Diary back on ✓'); } catch (e) { toast('Diary: ' + e.message); }
  }

  // ---------- passport ----------
  function startPassport() {
    fetch('passport/theme.json').then(r => r.json()).then(theme => PassportUI.start({
      app: 'luna', theme, mount,
      onUnlocked: p => {
        LunaWeb.passport = { id: p.id, email: p.email, name: p.name };
        cover.hidden = true; document.body.classList.remove('lw-locked');
        LunaWeb.unlock(); LunaDB.pull();
      },
      onSignOut: async () => {
        await LunaDB.push().catch(() => {});
        Object.keys(localStorage).filter(k => k.startsWith('luna_') || k.startsWith('orbit_')).forEach(k => localStorage.removeItem(k));
        LunaDB.wipe(); LunaMCP.wipe();
        setTimeout(() => location.reload(), 300);
      },
    }));
  }
  function passportSettings() { closeSheet(); cover.hidden = false; PassportUI.settings(); }
  function lockNow() { Passport.setUnlocked('luna', false); location.reload(); }

  // ---------- ⚙ sheet ----------
  function gear() {
    const meta = document.querySelector('.top .meta'); if (!meta || $('lw-gear')) return;
    const b = document.createElement('button'); b.id = 'lw-gear'; b.type = 'button'; b.className = 'lw-gear'; b.setAttribute('aria-label', 'Settings');
    b.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
    b.onclick = openSheet;
    const v = document.createElement('span'); v.id = 'lw-ver'; v.className = 'lw-vtag'; v.textContent = 'v' + VERSION;
    meta.append(b);
    const brand = document.querySelector('.top .brand'); if (brand) brand.append(v);
  }
  function statusChip(name) {
    const s = LunaMCP.status(name);
    return s === 'on' ? '<span class="lw-on">● On</span>' : s === 'sleeping' ? '<span class="lw-sleep">● Tap to wake</span>' : '<span class="lw-off">Off</span>';
  }
  function render() {
    const C = LunaClaude, sp = C.spend(), m = LunaWeb.mode();
    const saved = LunaDB.status.last ? new Date(LunaDB.status.last).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'not yet';
    $('lw-body').innerHTML = `
      <section class="lw-sec"><h3>Apps</h3>
        ${APPS.map(([name, label, cls]) => `<div class="lw-row ${cls}"><span class="lw-dot"></span><div class="lw-grow"><b>${esc(label)}</b><small>${esc(name)}</small></div>
          ${statusChip(name)}<button type="button" data-app="${esc(name)}">${LunaMCP.status(name) === 'on' ? 'Disconnect' : LunaMCP.status(name) === 'sleeping' ? 'Wake' : 'Connect'}</button></div>`).join('')}
        <p class="lw-hint">Diary uses your Google sign-in. TaskNotes asks its PIN once. Money asks your Google account once.</p>
      </section>
      <section class="lw-sec"><h3>Brain</h3>
        <div class="lw-seg" role="radiogroup" aria-label="Brain">
          ${[['offline', 'Free only'], ['smart', 'Free + Claude when unsure'], ['claude', 'Always Claude']].map(([v, t]) =>
            `<button type="button" role="radio" aria-checked="${m === v}" data-mode="${v}">${t}</button>`).join('')}
        </div>
        <p class="lw-hint">Free = works offline on this phone, costs nothing. Claude only runs with your own API key and stops at your monthly cap.</p>
        <label class="lw-lab" for="lw-key">Claude API key ${C.hasKey() ? '<span class="lw-on">● saved</span>' : ''}</label>
        <div class="lw-line"><input id="lw-key" type="password" autocomplete="off" placeholder="${C.hasKey() ? '•••••••• (saved on this phone)' : 'sk-ant-…'}"><button type="button" id="lw-keysave">Save</button>${C.hasKey() ? '<button type="button" id="lw-keydel">Remove</button>' : ''}</div>
        <label class="lw-lab" for="lw-model">Claude model</label>
        <select id="lw-model">${Object.entries(C.MODELS).map(([id, x]) => `<option value="${id}"${C.model() === id ? ' selected' : ''}>${esc(x.name)} · $${x.in}/$${x.out} per 1M</option>`).join('')}</select>
        <label class="lw-lab" for="lw-cap">Monthly cap (£)</label>
        <div class="lw-line"><input id="lw-cap" type="number" min="0" step="0.5" inputmode="decimal" value="${C.capGbp()}"><button type="button" id="lw-capsave">Save</button></div>
        <div class="lw-meter"><i style="width:${Math.min(100, C.capGbp() ? C.spentGbp() / C.capGbp() * 100 : 100).toFixed(1)}%"></i></div>
        <p class="lw-hint">This month: £${C.spentGbp().toFixed(2)} of £${C.capGbp().toFixed(2)} · ${sp.calls} Claude call${sp.calls === 1 ? '' : 's'} (rough £ from $)</p>
      </section>
      <section class="lw-sec"><h3>Memory</h3>
        <div class="lw-row"><div class="lw-grow"><b>${LunaDB.count('log')} messages · ${LunaDB.count('learning')} lessons</b><small>Drive copy: ${esc(saved)}${LunaDB.status.err ? ' · ' + esc(LunaDB.status.err) : ''}</small></div><button type="button" id="lw-export">Download</button></div>
        <p class="lw-hint">Saved on this phone and in Drive: App data / ${esc(LunaWeb.passport ? LunaWeb.passport.id : 'DF……')} / Luna. This is Orbit's training data.</p>
      </section>
      <section class="lw-sec"><h3>Passport</h3>
        <div class="lw-line lw-two"><button type="button" id="lw-pp">🛂 Passport settings</button><button type="button" id="lw-lock">🔒 Lock now</button></div>
      </section>
      <p class="lw-ver">Luna Offline v${VERSION}</p>`;
    $('lw-body').querySelectorAll('[data-app]').forEach(b => b.onclick = () => app(b.dataset.app));
    $('lw-body').querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { LunaWeb.setMode(b.dataset.mode); render(); });
    $('lw-keysave').onclick = () => { const v = $('lw-key').value.trim(); if (!v) return; LunaClaude.setKey(v); toast('Claude key saved on this phone'); render(); };
    if ($('lw-keydel')) $('lw-keydel').onclick = () => { LunaClaude.setKey(null); render(); };
    $('lw-model').onchange = e => LunaClaude.setModel(e.target.value);
    $('lw-capsave').onclick = () => { LunaClaude.setCap($('lw-cap').value); toast('Cap saved'); render(); };
    $('lw-export').onclick = () => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([LunaDB.exportAll()], { type: 'application/json' }));
      a.download = `luna-offline-training-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    $('lw-pp').onclick = passportSettings; $('lw-lock').onclick = lockNow;
  }
  async function app(name) {
    const s = LunaMCP.status(name);
    try {
      if (s === 'on') { LunaMCP.disconnect(name); render(); return; }
      if (name === 'Google Calendar') { await LunaMCP.connectCalendar(s === 'sleeping'); toast('Diary connected ✓'); render(); }
      else await LunaMCP.connect(name);   // leaves the page, comes back with ?code=
    } catch (e) { toast(`${name}: ${e.message || e}`); }
  }
  function openSheet() {
    let s = $('lw-sheet');
    if (!s) {
      s = document.createElement('div'); s.id = 'lw-sheet'; s.className = 'lw-back';
      s.innerHTML = `<div class="lw-sheet" role="dialog" aria-modal="true" aria-labelledby="lw-h"><div class="lw-head"><h2 id="lw-h">Settings</h2><button type="button" id="lw-x" aria-label="Close">✕</button></div><div id="lw-body"></div></div>`;
      document.body.append(s);
      s.addEventListener('click', e => { if (e.target === s) closeSheet(); });
      $('lw-x').onclick = closeSheet;
      document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
    }
    render(); s.hidden = false;
  }
  function closeSheet() { const s = $('lw-sheet'); if (s) s.hidden = true; }

  // ---------- update sheet (mock B, Darren 9 Nov) ----------
  const newer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
  let checking = false;
  async function checkUpdate() {
    if (checking || ($('lw-upd') && !$('lw-upd').hidden)) return;
    checking = true;
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      const v = r.ok ? await r.json() : null;
      let later = ''; try { later = sessionStorage.getItem('luna_upd_later') || ''; } catch (e) {}
      if (v && v.version && newer(v.version, VERSION) && later !== v.version) showUpdate(v);
    } catch (e) { /* offline: try again later */ } finally { checking = false; }
  }
  function showUpdate(v) {
    let s = $('lw-upd');
    if (!s) { s = document.createElement('div'); s.id = 'lw-upd'; s.className = 'lw-back lw-updback'; document.body.append(s); }
    const notes = (Array.isArray(v.notes) ? v.notes : []).slice(0, 4);
    s.innerHTML = `<div class="lw-sheet lw-upd" role="dialog" aria-modal="true" aria-labelledby="lw-updh">
      <div class="lw-grab" aria-hidden="true"></div>
      <div class="lw-updtop"><img src="icons/icon-192.png" alt="" width="52" height="52"><div><h2 id="lw-updh">Luna v${esc(v.version)} is here</h2><p>You're on v${esc(VERSION)}</p></div></div>
      ${notes.length ? `<ul>${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      <div class="lw-updbtns"><button type="button" id="lw-later">Later</button><button type="button" id="lw-now" class="lw-go">Update now</button></div></div>`;
    s.hidden = false;
    const later = () => { try { sessionStorage.setItem('luna_upd_later', v.version); } catch (e) {} s.hidden = true; };
    $('lw-later').onclick = later;
    s.onclick = e => { if (e.target === s) later(); };
    $('lw-now').onclick = async () => {
      const b = $('lw-now'); b.disabled = true; b.textContent = 'Updating…';
      // fetch every file fresh (not the phone's short-term copy), let the new worker take over, then reload
      try {
        const reg = 'serviceWorker' in navigator && await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          const w = reg.installing || reg.waiting;
          if (w) await new Promise(ok => { const t = setTimeout(ok, 8000); w.addEventListener('statechange', () => { if (w.state === 'activated' || w.state === 'redundant') { clearTimeout(t); ok(); } }); });
        }
        await Promise.all(['./', 'index.html', 'web/settings.js', 'web/brain.js', 'web/web.css'].map(f => fetch(f, { cache: 'reload' }).catch(() => {})));
      } catch (e) {}
      location.reload();
    };
    $('lw-now').focus();
  }

  // ---------- start ----------
  gear();
  LunaMCP.finish().then(r => { if (r) toast(r.msg); }).catch(e => toast(String(e.message || e)));
  startPassport();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  setTimeout(checkUpdate, 2500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
  setInterval(checkUpdate, 30 * 60 * 1000);
  window.LunaSettings = { open: openSheet, close: closeSheet, toast, VERSION, checkUpdate };
})();
