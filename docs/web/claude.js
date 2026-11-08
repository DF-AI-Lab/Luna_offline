// Luna Offline: Claude, the BACKUP brain. Only used when Darren turned it on in ⚙ and the free brain isn't sure.
// Uses the official Anthropic SDK (vendor/anthropic-sdk-1.3.0.js, bundled so it works installed/offline)
// with Darren's own API key, kept on this phone only. A monthly cap (£) stops every call once it's reached.
(function () {
  'use strict';
  const K = { key: 'luna_claude_key', model: 'luna_claude_model', cap: 'luna_claude_cap_gbp', spend: 'luna_claude_spend' };
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const put = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
  // $ per million tokens (Anthropic first-party prices). Opus 5.5 is the default; Haiku 5.5 is the cheapest.
  const MODELS = {
    'claude-opus-5-5': { name: 'Claude Opus 5.5', in: 4, out: 20, fallback: true },
    'claude-haiku-5-5': { name: 'Claude Haiku 5.5 (cheapest)', in: 0.10, out: 0.50, fallback: false },
  };
  const USD_TO_GBP = 0.79; // rough, for the cap only
  const month = () => new Date().toISOString().slice(0, 7);

  function spend() {
    try { const s = JSON.parse(get(K.spend) || '{}'); return s.month === month() ? s : { month: month(), usd: 0, calls: 0 }; }
    catch (e) { return { month: month(), usd: 0, calls: 0 }; }
  }
  const model = () => MODELS[get(K.model)] ? get(K.model) : 'claude-opus-5-5';
  const capGbp = () => { const c = parseFloat(get(K.cap)); return isFinite(c) && c >= 0 ? c : 5; };
  const spentGbp = () => spend().usd * USD_TO_GBP;
  const hasKey = () => !!get(K.key);
  const canSpend = () => hasKey() && spentGbp() < capGbp();

  let sdk = null;
  async function client() {
    if (!sdk) sdk = (await import('../vendor/anthropic-sdk-1.3.0.js')).default;
    return { Anthropic: sdk, c: new sdk({ apiKey: get(K.key), dangerouslyAllowBrowser: true, maxRetries: 1 }) };
  }

  // Orbit's prompt in, Claude's text out. Throws {code} like the claude.ai sample does.
  async function ask(prompt) {
    if (!hasKey()) throw { code: 'no_key', message: 'No Claude key set (⚙ → Brain).' };
    if (!canSpend()) throw { code: 'cap', message: `Monthly Claude cap of £${capGbp().toFixed(2)} reached.` };
    const id = model(), M = MODELS[id];
    const { Anthropic, c } = await client();
    const body = {
      model: id, max_tokens: 4000,
      output_config: { effort: 'low' },       // a short JSON answer: low effort keeps it quick and cheap
      messages: [{ role: 'user', content: prompt }],
    };
    if (M.fallback) Object.assign(body, { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
    let r;
    try { r = M.fallback ? await c.beta.messages.create(body) : await c.messages.create(body); }
    catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw { code: 'bad_key', message: 'Claude said the API key is wrong.' };
      if (e instanceof Anthropic.RateLimitError) throw { code: 'rate_limited', message: 'Claude is busy.' };
      if (e instanceof Anthropic.APIConnectionError) throw { code: 'offline', message: "Can't reach Claude (offline?)." };
      if (e instanceof Anthropic.APIError) throw { code: 'upstream_error', message: `Claude error ${e.status}` };
      throw { code: 'upstream_error', message: String(e && e.message || e) };
    }
    const u = r.usage || {};
    const s = spend(); s.usd += ((u.input_tokens || 0) * M.in + (u.output_tokens || 0) * M.out) / 1e6; s.calls += 1;
    put(K.spend, JSON.stringify(s));
    if (r.stop_reason === 'refusal') throw { code: 'refused', message: 'Claude declined that one.' };
    return (r.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  }
  function jsonFrom(text) {
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    if (a < 0 || b < a) throw { code: 'invalid_json', message: 'No JSON in the answer.' };
    try { return JSON.parse(text.slice(a, b + 1)); } catch (e) { throw { code: 'invalid_json', message: 'Bad JSON in the answer.' }; }
  }

  window.LunaClaude = {
    MODELS, K, ask, json: async p => jsonFrom(await ask(p)),
    hasKey, canSpend, model, capGbp, spentGbp, spend,
    setKey: v => put(K.key, v ? String(v).trim() : null),
    setModel: v => put(K.model, MODELS[v] ? v : null),
    setCap: v => put(K.cap, String(Math.max(0, parseFloat(v) || 0))),
  };
})();
