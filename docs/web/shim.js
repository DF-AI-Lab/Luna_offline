// Luna Offline web: window.claude stand-in, so Orbit's code (unchanged) runs outside claude.ai.
// claude.use('mcp' | 'sample' | 'db') waits until Passport is unlocked, then hands over Luna's own versions.
(function () {
  'use strict';
  let open; const unlocked = new Promise(r => { open = r; });
  const MODE = 'luna_brain_mode'; // offline | smart | claude
  const mode = () => { try { return localStorage.getItem(MODE) || 'smart'; } catch (e) { return 'smart'; } };
  const last = { by: '', why: '' };

  // sample.json(prompt) = Orbit asking "what does this message mean?"
  async function decide(prompt) {
    const { msg, now, lessons } = LunaRules.readPrompt(prompt);
    const free = LunaRules.guess(msg, now, lessons);
    const m = mode();
    const useClaude = m !== 'offline' && LunaClaude.canSpend() && (m === 'claude' || free.confidence < 0.7);
    if (useClaude) {
      try { const r = await LunaClaude.json(prompt); last.by = 'claude'; last.why = ''; return r; }
      catch (e) { last.by = 'free'; last.why = e.message || e.code; return free; }
    }
    last.by = 'free'; last.why = free.why; return free;
  }
  const sample = async () => { throw { code: 'not_granted', message: 'Luna Offline only answers in JSON.' }; };
  sample.json = (prompt) => decide(prompt);

  window.LunaWeb = { unlock: () => open(), passport: null, mode, setMode: v => { try { localStorage.setItem(MODE, v); } catch (e) {} }, last };
  window.claude = { use: async name => { await unlocked; return { mcp: window.LunaMCP, sample, db: window.LunaDB }[name] || null; } };
})();
