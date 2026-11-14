// Mini Brain: ONE small offline brain for all of Darren's apps. Not an LLM. A word-weights sorter.
// Same file runs on the phone (browser) and in training (node tools/train.js). No libraries.
//
// The 5 steps every message goes through (see BRAIN.md for the plain-English version):
//   1. tidy     lower case, drop odd marks:          "Dentist Tues @ 3PM!"  → "dentist tues 3pm"
//   2. spell    fix words it doesn't know:            "dentsit"              → "dentist"
//   3. swap     prices/dates/times → tokens:          "3pm"                  → "[time]"
//   4. clues    words + word pairs + 3-letter chunks: "dentist" → w:dentist, c:<de, c:den, ...
//               + "a word I hardly know" ([new]) + "how many numbers" (n:one / n:many)
//   5. score    add up each action's weights for the clues; biggest total wins; % sure = softmax
(function (root) {
  'use strict';

  // ---------- 1. tidy ----------
  function tidy(text) {
    let s = String(text || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9£.:\/\- ]/g, ' ');
    // keep . : / - only between digits (12.50, 15:30, 12/11, 2-3pm); anywhere else they are just gaps
    s = s.replace(/[.:\/\-]/g, (c, i, str) => (/\d/.test(str[i - 1] || '') && /\d/.test(str[i + 1] || '') ? c : ' '));
    return s.replace(/\s+/g, ' ').trim();
  }

  // ---------- 2. spell fix ----------
  // How far apart two words are: letters added, dropped, changed, or two side by side swapped (braed → bread = 1).
  function distance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const d = [];
    for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      let rowMin = Infinity;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
        d[i][j] = v; if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
    }
    return d[a.length][b.length];
  }
  // short words: is v just w with two letters swapped, or one letter dropped/added in the middle?
  function safeShort(w, v) {
    if (w.length === v.length) {                       // same length → only a swap counts (braed → bread)
      let i = 0; while (i < w.length && w[i] === v[i]) i++;
      return i < w.length - 1 && w[i] === v[i + 1] && w[i + 1] === v[i] && w.slice(i + 2) === v.slice(i + 2);
    }
    const [a, b] = w.length < v.length ? [w, v] : [v, w];   // a is one shorter
    if (b.length - a.length !== 1) return false;
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    return i < a.length && a.slice(i) === b.slice(i + 1);   // the extra letter is not the last one
  }
  // Only fix a word it has never seen. Darren's own typo list first, then the closest known word
  // (1 slip for 4-7 letters, 2 for 8+). Ties go to the longer word, then the word seen most in training.
  // Safety rules, so real words and shop names are left alone ("costa" is not "cost", "chinese" is not "cheese"):
  //   - only fix TO a word it knows well (seen 3+ times), never to a word it saw once
  //   - the first letter must match (people rarely get the first letter wrong)
  //   - a short word (4-5 letters) is only fixed for swapped letters or a missing/extra letter in the MIDDLE,
  //     never by sticking a letter on the end or changing one
  function spellFix(words, vocab, typos) {
    const fixes = [];
    const has = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);   // so a word like "constructor" can't trip it up
    const out = words.map(w => {
      if (has(typos, w)) { fixes.push([w, typos[w]]); return typos[w]; }
      if (!vocab || has(vocab, w) || w.length < 4 || /\d|£/.test(w)) return w;
      const max = w.length >= 8 ? 2 : 1;
      let best = null, bestD = max + 1, bestN = 0;
      for (const v in vocab) {
        if (v.length < 3 || v[0] !== w[0] || vocab[v] < 3) continue;
        if (w.length <= 5 && !safeShort(w, v)) continue;
        const dd = distance(w, v, max);
        const n = vocab[v] + (v.length > w.length ? 1000 : 0);   // a longer word wins a tie (a dropped letter is the usual slip)
        if (dd < bestD || (dd === bestD && n > bestN)) { best = v; bestD = dd; bestN = n; }
      }
      if (best && bestD <= max) { fixes.push([w, best]); return best; }
      return w;
    });
    return { words: out, fixes };
  }

  // ---------- 3. swap the bits that change every time ----------
  // So it learns "has a price" instead of every price there is.
  const MON = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';
  const SWAPS = [
    [/£ ?\d+(?:[.,]\d{1,2})?|\b\d+(?:\.\d{1,2})? ?(?:quid|pounds?|gbp)\b|\b\d{1,3}p\b|\b(?:a )?(?:fiver|tenner)\b/g, ' [money] '],
    [/\b\d{1,2}(?:[:.]\d\d)? ?(?:am|pm)? ?(?:-|to|till|until) ?\d{1,2}(?:[:.]\d\d)? ?(?:am|pm)\b/g, ' [time] '],
    [/\b\d{1,2}(?:[:.]\d\d)? ?(?:am|pm)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(?:noon|midday)\b/g, ' [time] '],
    [new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?(?: of)? ${MON}\\b|\\b${MON} \\d{1,2}(?:st|nd|rd|th)?\\b|\\b\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?\\b|\\bthe \\d{1,2}(?:st|nd|rd|th)\\b|\\b\\d{1,2}(?:st|nd|rd|th)\\b`, 'g'), ' [date] '],
    [/\b(?:today|tonight|tomorrow|tmrw|tmr|tomoz)\b/g, ' [date] '],
    [/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)\b/g, ' [day] '],
    [/\b\d+(?:\.\d+)? ?(?:mins?|minutes?|hours?|hrs?|days?|weeks?|wks?|months?|years?|yrs?)\b/g, ' [howlong] '],  // "2 hours", "6 months"
    [/(^| )\d{1,2}-\d{1,2}(?= |$)/g, ' [time] '],                          // "8-12" = a time slot
    [/\b(?=[a-z0-9]*\d)(?=[a-z0-9]*[a-z])[a-z0-9]+\b/g, ' [code] '],         // letters+digits mixed: "yx19", "e14", "sunny22"
    [/\b\d{4,}\b|\b\d+(?:-\d+)+\b/g, ' [long] '],                           // long numbers: phone, pin, account, ref
    [/\b\d+\.\d\d?\b/g, ' [dec] '],                                         // 4.20, 5.30: mostly a price, sometimes a time
    [/\b\d+\b/g, ' [num] '],                                                // any other whole number
  ];
  function swap(s) { for (const [re, tok] of SWAPS) s = s.replace(re, tok); return s.replace(/\s+/g, ' ').trim(); }

  // steps 1-3 together: message → list of words/tokens (+ what was spell-fixed)
  function read(text, vocab, typos) {
    const t = tidy(text);
    const sf = spellFix(t.split(' ').filter(Boolean), vocab, typos);
    const tokens = swap(sf.words.join(' ')).split(' ').filter(Boolean);
    if (/\?/.test(String(text))) tokens.push('[?]');     // a question mark is a clue too
    return { tokens, fixes: sf.fixes };
  }

  // ---------- 4. clues (features) ----------
  // w: the word itself · f: the first word ("what…", "buy…") · p: two words together ("on card")
  // c: 3-letter chunks, so a bad spelling still shares most chunks with the real word ("vegtables" ~ "vegetables")
  // [new]: a word seen once or never in training (a new shop, a name). It can't know the word, but it CAN learn
  //        the shape: "[new] [dec]" is nearly always money, "[new] [day] [time]" is nearly always the diary.
  // n: how many numbers there are. One number → often a price. Several → often a note (sizes, phone numbers).
  const CHUNK = 0.5; // a chunk counts half as much as a whole word
  const NUMBERS = { '[num]': 1, '[dec]': 1, '[long]': 1, '[code]': 1 };
  function features(tokens, vocab) {
    const f = new Map();
    const add = (k, v) => f.set(k, (f.get(k) || 0) + v);
    const isNew = t => !!vocab && t[0] !== '[' && !(vocab[t] > 1);
    const name = t => (isNew(t) ? '[new]' : t);
    add('bias', 1);
    const n = tokens.filter(t => NUMBERS[t]).length;
    if (n) add(n > 1 ? 'n:many' : 'n:one', 1);
    tokens.forEach((t, i) => {
      const next = tokens[i + 1];
      add('w:' + t, 1);
      if (i === 0) add('f:' + t, 1);
      if (next) add('p:' + t + '_' + next, 1);
      if (isNew(t)) { add('w:[new]', 1); if (i === 0) add('f:[new]', 1); }
      if (next && (isNew(t) || isNew(next))) add('p:' + name(t) + '_' + name(next), 1);
      if (t[0] !== '[' && t.length >= 3) { const s = '<' + t + '>'; for (let j = 0; j + 3 <= s.length; j++) add('c:' + s.substr(j, 3), CHUNK); }
    });
    return f;
  }

  // ---------- 5. score ----------
  function softmax(xs) { const m = Math.max(...xs); const e = xs.map(x => Math.exp(x - m)); const s = e.reduce((a, b) => a + b, 0); return e.map(x => x / s); }

  // A brain = base weights (from training) + Darren's own layer (his "Did you mean" taps, learned live on the phone).
  function create(model) {
    const labels = model.labels.slice();
    const W = model.w;            // feature → [weight per label]
    const vocab = model.vocab || {};
    const typos = Object.assign({}, model.typos || {});
    let mine = {};                // Darren's own layer: same shape as W, starts empty

    function scores(feats) {
      const s = labels.map(() => 0);
      for (const [k, v] of feats) {
        const a = W[k], b = mine[k];
        if (a) for (let i = 0; i < s.length; i++) s[i] += v * (a[i] || 0);
        if (b) for (let i = 0; i < s.length; i++) s[i] += v * (b[i] || 0);
      }
      return s;
    }
    // allowed = the actions this app's skill pack has (one brain, many apps)
    function predict(text, opts) {
      const allowed = (opts && opts.allowed) || labels;
      const r = read(text, vocab, typos), feats = features(r.tokens, vocab);
      const s = scores(feats);
      const idx = labels.map((_, i) => i).filter(i => allowed.includes(labels[i]));
      const p = softmax(idx.map(i => s[i]));
      const ranked = idx.map((i, n) => ({ label: labels[i], p: p[n], score: s[i] })).sort((a, b) => b.p - a.p);
      const top = ranked[0], second = ranked[1] || { p: 0, label: '' };
      // why: the clues that pushed the winner past the runner-up most
      const ti = labels.indexOf(top.label), si = labels.indexOf(second.label);
      const why = [...feats].filter(([k]) => k[0] === 'w' || k[0] === 'p')
        .map(([k, v]) => [k.slice(2), v * (((W[k] || [])[ti] || 0) + ((mine[k] || [])[ti] || 0) - (si < 0 ? 0 : ((W[k] || [])[si] || 0) + ((mine[k] || [])[si] || 0)))])
        .filter(x => x[1] > 0.2).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0].replace('_', ' '));
      return { label: top.label, sure: top.p, gap: top.p - second.p, ranked, tokens: r.tokens, fixes: r.fixes, why };
    }
    // One nudge: up for the right action, down for the others, by how wrong it was (that's all "learning" is).
    // skip = clues to leave alone (see learn)
    function nudge(layer, feats, right, rate, skip) {
      const s = scores(feats), p = softmax(s), y = labels.indexOf(right);
      for (const [k, v] of feats) {
        if (skip && skip(k)) continue;
        const row = layer[k] || (layer[k] = labels.map(() => 0));
        for (let i = 0; i < labels.length; i++) row[i] += rate * v * ((i === y ? 1 : 0) - p[i]);
      }
      return p[y];
    }
    // Live learning (on the phone, at once): nudge Darren's own layer until this message comes out right and sure.
    // It only nudges the clues that belong to THIS message's words. The general clues (bias, [new], number count)
    // are left alone, or 20 "note" taps would slowly make every message lean towards "note".
    const GENERAL = k => k === 'bias' || k[0] === 'n' || k.indexOf('[new]') >= 0;
    function learn(text, right, opts) {
      if (!labels.includes(right)) return false;
      const feats = features(read(text, vocab, typos).tokens, vocab);
      const want = (opts && opts.sure) || 0.9;
      for (let n = 0; n < 30; n++) if (nudge(mine, feats, right, 0.5, GENERAL) >= want) break;
      return true;
    }
    return {
      labels, predict, learn,
      addTypo: (bad, good) => { typos[String(bad).toLowerCase()] = String(good).toLowerCase(); },
      mine: () => mine, setMine: m => { mine = m || {}; }, forget: () => { mine = {}; },
      _nudge: nudge, _scores: scores,
    };
  }

  // ---------- training (runs in node, now and then, from the examples + Darren's logs) ----------
  // examples: [{text, label}] → a model (plain JSON). Softmax regression with small nudges, many passes.
  function train(examples, opts) {
    opts = Object.assign({ epochs: 30, rate: 0.2, l2: 1e-5, seed: 7, typos: {}, minWeight: 0.12 }, opts || {});
    const labels = opts.labels || [...new Set(examples.map(e => e.label))].sort();
    // words it knows = words in the real examples (not the made-up typo copies, or typos would count as "known")
    const vocab = {};
    for (const e of examples) if (!e.made) for (const w of tidy(e.text).split(' ')) if (w && !/\d/.test(w)) vocab[w] = (vocab[w] || 0) + 1;
    const brain = create({ labels, w: {}, vocab: {}, typos: {} });
    const W = {};
    brain.setMine(W);                                       // train straight into a layer
    // every example goes through the same steps as a real message (tidy, spell fix, swap, clues)
    const rows = examples.map(e => ({ f: features(read(e.text, vocab, opts.typos).tokens, vocab), y: e.label, k: e.weight || 1 }));
    let seed = opts.seed; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let ep = 0; ep < opts.epochs; ep++) {
      for (let i = rows.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }
      const rate = opts.rate / (1 + ep * 0.1);
      for (const r of rows) brain._nudge(W, r.f, r.y, rate * r.k);
      if (opts.l2) for (const k in W) for (let i = 0; i < labels.length; i++) W[k][i] *= (1 - opts.l2);
    }
    // keep it small: drop clues that hardly point anywhere, round to 2 places
    const w = {};
    for (const k in W) {
      if (Math.max(...W[k].map(Math.abs)) < opts.minWeight) continue;
      w[k] = W[k].map(x => Math.round(x * 100) / 100);
    }
    return { v: 1, labels, w, vocab, typos: opts.typos, trained: new Date().toISOString(), examples: examples.length };
  }

  const api = { tidy, distance, spellFix, swap, read, features, create, train };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MiniBrain = api;
})(typeof window !== 'undefined' ? window : globalThis);
