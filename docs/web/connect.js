// Luna Offline: the apps. Stands in for claude.ai's `mcp` (mcp.callTool(server, tool, args)).
//  - "Google Calendar": straight to Google's Calendar API with a Google token (same Google project as Passport).
//  - "TaskNotes" + "Where's My Money": their own MCP Workers, signed in ONCE with the same login Claude uses
//    (OAuth 2.1 + PKCE). Their answers are the exact text Claude gets, so Orbit's code reads them unchanged.
(function () {
  'use strict';
  const SERVERS = {
    'TaskNotes': { url: 'https://tasknotes.df-ai-lab-hq.workers.dev/mcp', short: 'TaskNotes' },
    "Where's My Money": { url: 'https://wmm-lite.df-ai-lab-hq.workers.dev/mcp', short: 'WMM' },
  };
  const CAL = 'Google Calendar', CAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
  const CAL_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const put = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const keyOf = name => 'luna_mcp_' + SERVERS[name].short;
  const here = () => location.origin + location.pathname;
  const need = (server, why) => { window.dispatchEvent(new CustomEvent('luna-need', { detail: { server, why } })); };
  const notOn = (server) => { need(server, 'connect'); return { code: 'tool_error', message: `not connected yet. Tap ⚙ to connect ${server}` }; };

  // ---------- PKCE helpers ----------
  const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const rand = n => b64url(crypto.getRandomValues(new Uint8Array(n)));
  const sha = async t => b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));

  async function meta(url) {
    const o = new URL(url).origin;
    const r = await fetch(o + '/.well-known/oauth-authorization-server');
    if (!r.ok) throw new Error('No login info from ' + o);
    return r.json();
  }
  // step 1: tap Connect → the server's own sign-in page (PIN for TaskNotes, Google for WMM)
  async function connect(name) {
    const S = SERVERS[name], m = await meta(S.url);
    const reg = await (await fetch(m.registration_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Luna Offline', redirect_uris: [here()], grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'], token_endpoint_auth_method: 'none' }) })).json();
    if (!reg.client_id) throw new Error(reg.error_description || `${name} won't let Luna connect yet (needs the GitHub Pages update).`);
    const verifier = rand(32), state = rand(16);
    put('luna_oauth_pending', { name, verifier, state, client_id: reg.client_id, token: m.token_endpoint, at: Date.now() });
    const a = new URL(m.authorization_endpoint);
    a.search = new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: here(), state,
      code_challenge: await sha(verifier), code_challenge_method: 'S256' }).toString();
    location.href = a.toString();
  }
  // step 2: back here with ?code=… → swap it for tokens (runs on page load, before anything else)
  async function finish() {
    const q = new URLSearchParams(location.search), p = get('luna_oauth_pending');
    if (!q.get('code') && !q.get('error')) return null;
    history.replaceState(null, '', here());
    if (!p || p.state !== q.get('state') || Date.now() - p.at > 15 * 60000) return { ok: false, msg: 'That sign-in was too old. Try Connect again.' };
    put('luna_oauth_pending', null);
    if (q.get('error')) return { ok: false, name: p.name, msg: `${p.name}: sign-in cancelled.` };
    const r = await fetch(p.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: here(), client_id: p.client_id, code_verifier: p.verifier }).toString() });
    const t = await r.json().catch(() => ({}));
    if (!r.ok || !t.access_token) return { ok: false, name: p.name, msg: `${p.name}: ${t.error_description || 'sign-in failed'}.` };
    put(keyOf(p.name), { at: t.access_token, rt: t.refresh_token, exp: Date.now() + (t.expires_in || 3600) * 1000, cid: p.client_id, token: p.token });
    return { ok: true, name: p.name, msg: `${p.name} connected ✓` };
  }
  async function refresh(name) {
    const s = get(keyOf(name)); if (!s || !s.rt) return null;
    const r = await fetch(s.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: s.rt, client_id: s.cid }).toString() }).catch(() => null);
    const t = r && r.ok ? await r.json().catch(() => null) : null;
    if (!t || !t.access_token) { if (r && r.status >= 400 && r.status < 500) put(keyOf(name), null); return null; }
    const n = Object.assign(s, { at: t.access_token, rt: t.refresh_token || s.rt, exp: Date.now() + (t.expires_in || 3600) * 1000 });
    put(keyOf(name), n); return n;
  }
  let rpc = 1;
  async function mcpCall(name, tool, args) {
    let s = get(keyOf(name)); if (!s) throw notOn(name);
    if (Date.now() > s.exp - 60000) s = await refresh(name) || s;
    const go = tok => fetch(SERVERS[name].url, { method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'Mcp-Protocol-Version': '2025-06-18' },
      body: JSON.stringify({ jsonrpc: '2.0', id: rpc++, method: 'tools/call', params: { name: tool, arguments: args || {} } }) });
    let r;
    try { r = await go(s.at); } catch (e) { throw { code: 'server_unavailable', message: 'offline?' }; }
    if (r.status === 401) { const n = await refresh(name); if (!n) throw notOn(name); r = await go(n.at); }
    if (r.status === 429) throw { code: 'rate_limited' };
    if (!r.ok) throw { code: 'upstream_error', message: `${name} error ${r.status}` };
    const j = await r.json().catch(() => null);
    if (!j || j.error) throw { code: 'tool_error', message: (j && j.error && j.error.message) || 'bad answer' };
    const content = (j.result && j.result.content) || [];
    const text = content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    if (j.result && j.result.isError) throw { code: 'tool_error', message: text || 'failed' };
    return { payload: text, content };
  }

  // ---------- Google Calendar ----------
  const CALK = 'luna_cal_token';
  const calTok = () => { const t = get(CALK); return t && t.exp > Date.now() + 60000 ? t.token : null; };
  function loadGsi() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    return new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = ok; s.onerror = () => no(new Error('Could not reach Google.')); document.head.appendChild(s); });
  }
  // from a tap only (Google opens a small window). quiet = no account picker if already allowed.
  async function connectCalendar(quiet) {
    await loadGsi();
    const hint = (window.LunaWeb && LunaWeb.passport && LunaWeb.passport.email) || undefined;
    const res = await new Promise((ok, no) => google.accounts.oauth2.initTokenClient({
      client_id: (window.PASSPORT_CONFIG || {}).googleClientId, scope: CAL_SCOPE, include_granted_scopes: true,
      callback: r => r.error ? no(new Error(r.error)) : ok(r), error_callback: e => no(new Error(e.type || 'closed')),
    }).requestAccessToken({ prompt: quiet ? '' : 'consent', login_hint: hint }));
    if (!google.accounts.oauth2.hasGrantedAllScopes(res, CAL_SCOPE)) throw new Error('Please tick the Calendar box on Google\'s screen.');
    put(CALK, { token: res.access_token, exp: Date.now() + res.expires_in * 1000 });
    put('luna_cal_on', true);
  }
  async function cal(method, path, body) {
    const t = calTok();
    if (!t) { throw get('luna_cal_on') ? (need(CAL, 'reconnect'), { code: 'tool_error', message: 'needs a quick tap to reconnect (Google signs out every hour). Tap ⚙ or the banner' }) : notOn(CAL); }
    let r;
    try { r = await fetch(CAL_API + path, { method, headers: Object.assign({ Authorization: 'Bearer ' + t }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined }); }
    catch (e) { throw { code: 'server_unavailable' }; }
    if (r.status === 401) { put(CALK, null); need(CAL, 'reconnect'); throw { code: 'tool_error', message: 'needs a quick tap to reconnect. Tap ⚙ or the banner' }; }
    if (!r.ok) {
      const e = await r.json().catch(() => ({})), msg = (e.error && e.error.message) || '';
      if (r.status === 403 && /has not been used|is disabled|accessNotConfigured/i.test(msg + JSON.stringify(e))) throw { code: 'tool_error', message: 'is switched off in Google Cloud. Turn on the Google Calendar API, wait 2 minutes, then try again' };
      throw { code: 'tool_error', message: msg || 'error ' + r.status };
    }
    return r.status === 204 ? {} : r.json();
  }
  const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London';
  async function calendar(tool, a) {
    if (tool === 'list_events') {
      const q = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: String(a.pageSize || 10),
        timeMin: new Date(a.startTime || Date.now()).toISOString(), ...(a.endTime ? { timeMax: new Date(a.endTime).toISOString() } : {}) });
      const r = await cal('GET', '?' + q); return { payload: { events: r.items || [] } };
    }
    if (tool === 'create_event') {
      const ev = { summary: a.summary, description: a.description || undefined };
      if (a.allDay) Object.assign(ev, { start: { date: a.startTime.slice(0, 10) }, end: { date: a.endTime.slice(0, 10) } });
      else Object.assign(ev, { start: { dateTime: a.startTime, timeZone: tz() }, end: { dateTime: a.endTime, timeZone: tz() } });
      return { payload: await cal('POST', '', ev) };
    }
    if (tool === 'delete_event') { await cal('DELETE', '/' + encodeURIComponent(a.eventId)); return { payload: {} }; }
    throw { code: 'tool_error', message: 'Luna has no ' + tool + ' for the diary yet.' };
  }

  window.LunaMCP = {
    SERVERS, connect, finish, connectCalendar, refresh,
    status: name => name === CAL ? (calTok() ? 'on' : get('luna_cal_on') ? 'sleeping' : 'off') : (get(keyOf(name)) ? 'on' : 'off'),
    disconnect: name => { if (name === CAL) { put(CALK, null); put('luna_cal_on', null); } else put(keyOf(name), null); },
    wipe: () => { Object.keys(SERVERS).forEach(n => put(keyOf(n), null)); put(CALK, null); put('luna_cal_on', null); put('luna_oauth_pending', null); },
    // the claude.ai mcp shape Orbit calls
    callTool: (server, tool, args) => server === CAL ? calendar(tool, args || {}) : SERVERS[server] ? mcpCall(server, tool, args)
      : Promise.reject({ code: 'server_not_found', message: server }),
  };
})();
