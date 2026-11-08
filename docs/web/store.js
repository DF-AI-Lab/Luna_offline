// Luna Offline: memory. Stands in for claude.ai's `db` (Orbit's `log` and `learning` collections).
// Saved on this phone (localStorage) and copied to Drive: App data - DON'T DELETE / DF…… / Luna / luna-offline-data.json
(function () {
  'use strict';
  const KEY = 'luna_db_v1', FILE = 'luna-offline-data.json';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  let data = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} soon(); };
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const coll = n => (data[n] = data[n] || {});

  function query(name, order, lim) {
    return {
      orderBy: (f, dir) => query(name, { f, dir }, lim),
      limit: n => query(name, order, n),
      get: async () => {
        let rows = Object.entries(coll(name)).map(([id, d]) => ({ id, d }));
        if (order) rows.sort((a, b) => (String(a.d[order.f]) < String(b.d[order.f]) ? -1 : 1) * (order.dir === 'desc' ? -1 : 1));
        if (lim) rows = rows.slice(0, lim);
        return { docs: rows.map(r => ({ id: r.id, data: () => r.d })) };
      },
      doc: id => ref(name, id || newId()),
      add: async obj => { const r = ref(name, newId()); await r.set(obj); return r; },
    };
  }
  function ref(name, id) {
    return {
      id,
      set: async obj => { coll(name)[id] = JSON.parse(JSON.stringify(obj)); save(); },
      update: async patch => { coll(name)[id] = Object.assign({}, coll(name)[id], JSON.parse(JSON.stringify(patch))); save(); },
      get: async () => ({ exists: !!coll(name)[id], data: () => coll(name)[id] }),
    };
  }

  // ---------- Drive copy (uses the passport's Google sign-in, same folder rules as every DF app) ----------
  let timer = null, busy = false, fileId = null;
  const status = { last: localStorage.getItem('luna_db_saved') || '', err: '' };
  function soon() { clearTimeout(timer); timer = setTimeout(push, 5000); }
  async function drive(url, opts) {
    const r = await fetch(url, Object.assign({}, opts, { headers: Object.assign({ Authorization: 'Bearer ' + PassportCloud.token() }, (opts || {}).headers) }));
    if (!r.ok) throw new Error('Drive ' + r.status);
    return r.status === 204 ? null : r.json();
  }
  async function findFile(folder) {
    const q = `name='${FILE}' and '${folder}' in parents and trashed=false`;
    const r = await drive('https://www.googleapis.com/drive/v3/files?fields=files(id)&q=' + encodeURIComponent(q));
    return (r.files[0] || {}).id || null;
  }
  async function push() {
    if (busy || !window.PassportCloud || !PassportCloud.hasToken() || !window.LunaWeb || !LunaWeb.passport) return;
    busy = true;
    try {
      const folder = await PassportCloud.appFolder(LunaWeb.passport.id, 'Luna');
      fileId = fileId || await findFile(folder);
      const body = JSON.stringify({ app: 'luna-offline', saved: new Date().toISOString(), data }, null, 1);
      if (fileId) await drive(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
      else {
        const b = 'luna' + Math.random().toString(16).slice(2);
        const meta = { name: FILE, mimeType: 'application/json', parents: [folder] };
        const r = await drive('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST',
          headers: { 'Content-Type': 'multipart/related; boundary=' + b },
          body: `--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--` });
        fileId = r.id;
      }
      status.last = new Date().toISOString(); status.err = ''; localStorage.setItem('luna_db_saved', status.last);
    } catch (e) { status.err = e.message; } finally { busy = false; }
  }
  // on unlock: bring in anything another device saved (merge by id, nothing lost)
  async function pull() {
    if (!window.PassportCloud || !PassportCloud.hasToken() || !LunaWeb.passport) return;
    try {
      const folder = await PassportCloud.appFolder(LunaWeb.passport.id, 'Luna');
      fileId = await findFile(folder); if (!fileId) return push();
      const r = await drive(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
      for (const [n, rows] of Object.entries((r && r.data) || {})) for (const [id, d] of Object.entries(rows)) if (!coll(n)[id]) coll(n)[id] = d;
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
      push();
    } catch (e) { status.err = e.message; }
  }

  window.LunaDB = {
    collection: n => query(n), doc: p => { const [c, id] = String(p).split('/'); return ref(c, id); },
    pull, push, status, count: n => Object.keys(coll(n)).length,
    exportAll: () => JSON.stringify({ app: 'luna-offline', exported: new Date().toISOString(), data }, null, 2),
    wipe: () => { data = {}; try { localStorage.removeItem(KEY); localStorage.removeItem('luna_db_saved'); } catch (e) {} },
  };
})();
