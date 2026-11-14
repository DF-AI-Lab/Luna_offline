#!/usr/bin/env node
// Train the Mini Brain. Run now and then:
//   node tools/train.js                          examples only
//   node tools/train.js luna-offline-data.json   + Darren's real log (download it from Drive first)
//
// Reads:  skills/*/<action>.txt   (examples, one per line)
//         skills/*/test.txt       (the exam, never trained on)
//         skills/shared/typos.txt (typed → meant)
//         any log files you pass  (Luna Offline's Drive file, or Luna's log/*.jsonl)
// Writes: docs/brain/weights.js   (the trained brain the phone loads)
// Prints: exam score, old rules vs new brain, size, speed.
const fs = require('fs'), path = require('path');
const MB = require('../docs/brain/core.js');
const ROOT = path.join(__dirname, '..'), SK = path.join(ROOT, 'skills');

const lines = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')) : [];
const typos = {};
for (const l of lines(path.join(SK, 'shared/typos.txt'))) { const [a, b] = l.split(/\s+/); if (a && b) typos[a] = b; }

// 1) examples + exam from every skill pack
const train = [], exam = [], packs = {};
for (const app of fs.readdirSync(SK)) {
  const dir = path.join(SK, app), pf = path.join(dir, 'pack.json');
  if (!fs.existsSync(pf)) continue;
  const pack = JSON.parse(fs.readFileSync(pf, 'utf8')); packs[app] = Object.keys(pack.actions);
  for (const act of packs[app]) for (const t of lines(path.join(dir, act + '.txt'))) train.push({ text: t, label: act, from: app });
  for (const l of lines(path.join(dir, 'test.txt'))) { const [lab, ...rest] = l.split('|'); exam.push({ text: rest.join('|').trim(), label: lab.trim(), from: app }); }
}
const allLabels = [...new Set(Object.values(packs).flat())].sort();

// 2) Darren's real messages from the logs: every 5th one goes to the exam (honest score on HIS words)
const real = [];
for (const f of process.argv.slice(2)) {
  const txt = fs.readFileSync(f, 'utf8');
  const rows = f.endsWith('.jsonl') ? txt.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean)
    : (() => { const d = JSON.parse(txt).data || {}; return [...Object.values(d.log || {}), ...Object.values(d.learning || {})]; })();
  for (const r of rows) {
    let text = r.msg || r.message, label = '';
    if (r.right) label = String(r.right).split(' + ')[0].trim();                   // he moved it / picked it = the truth
    else if (r.status === 'kept' && r.picked) label = r.picked;                     // he kept it = probably right
    else if (r.app && /^add_/.test(r.action || '')) label = { calendar: 'calendar', wmm: 'money', fridge: 'other' }[r.app] || (r.action === 'add_note' ? 'note' : r.action === 'add_task' ? 'task' : '');
    if (text && allLabels.includes(label)) real.push({ text, label, weight: r.right ? 3 : 1, from: 'log' }); // his fixes count 3x
  }
}
const seen = new Set(); const realU = real.filter(r => !seen.has(r.text.toLowerCase()) && seen.add(r.text.toLowerCase()));
realU.forEach((r, i) => (i % 5 === 4 ? exam : train).push(r));

// 2b) keep the exam honest: an example that reads the same as an exam line (after tidy + swap) is left out of
//     training, and said out loud. Also flag the same line filed under two different actions.
const shape = t => MB.read(t, null, typos).tokens.join(' ');
const examShapes = new Set(exam.map(e => shape(e.text)));
const copies = [], clash = [], first = new Map();
for (let i = train.length - 1; i >= 0; i--) if (examShapes.has(shape(train[i].text))) { copies.push(train[i].text); train.splice(i, 1); }
for (const e of train) { const k = e.text.toLowerCase(), was = first.get(k); if (was && was !== e.label) clash.push(`"${e.text}" is in ${was} AND ${e.label}`); first.set(k, e.label); }

// 3) a little made-up mess: copies of some examples with one slip (dropped or swapped letter), so it gets used to typos
let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function slip(t) {
  const ws = t.split(' '), i = ws.findIndex((w, n) => /^[a-z]{5,}$/.test(w) && rnd() < 0.5 + n * 0.1); if (i < 0) return null;  // words only, never a price
  const w = ws[i], j = 1 + Math.floor(rnd() * (w.length - 2));
  ws[i] = rnd() < 0.5 ? w.slice(0, j) + w.slice(j + 1) : w.slice(0, j) + w[j + 1] + w[j] + w.slice(j + 2);
  return ws.join(' ');
}
const messOf = list => list.filter(() => rnd() < 0.35).map(e => ({ ...e, text: slip(e.text), weight: 0.5, made: true })).filter(e => e.text);
const mess = messOf(train);

// 3b) practice exam: hide a fifth of the examples, train on the rest, test on the hidden fifth. Do that 5 times so
//     every example gets hidden once. A second honest score, on far more messages than the exam has.
const practice = { n: 0, ok: 0, sure: 0, sureOk: 0 };
for (let fold = 0; fold < 5; fold++) {
  const keep = train.filter((_, i) => i % 5 !== fold), hidden = train.filter((_, i) => i % 5 === fold);
  const b = MB.create(MB.train([...keep, ...messOf(keep)], { labels: allLabels, typos }));
  for (const e of hidden) {
    const p = b.predict(e.text, { allowed: packs[e.from] || allLabels }), right = p.label === e.label;
    practice.n++; if (right) practice.ok++; if (p.sure >= 0.8) { practice.sure++; if (right) practice.sureOk++; }
  }
}

// 4) train
const t0 = Date.now();
const model = MB.train([...train, ...mess], { labels: allLabels, typos });
model.packs = packs;
const trainMs = Date.now() - t0;

// 5) the exam: new brain vs the old hand-written rules
const brain = MB.create(model);
let oldRules = null; try { oldRules = require('../docs/web/brain.js'); } catch (e) {}
const NOW = new Date(2026, 10, 8, 12, 0);
let ok = 0, okOld = 0, unsure = 0, unsureRight = 0; const wrong = [];
const t1 = process.hrtime.bigint();
for (const e of exam) {
  const p = brain.predict(e.text, { allowed: packs[e.from] || allLabels });
  if (p.label === e.label) ok++; else wrong.push(`  ✗ "${e.text}" → ${p.label} ${Math.round(p.sure * 100)}% (should be ${e.label})`);
  if (p.sure < 0.8) { unsure++; if (p.label === e.label) unsureRight++; }
  if (oldRules && oldRules.rulesKind && oldRules.rulesKind(e.text, NOW).kind === e.label) okOld++;
}
const perMsg = Number(process.hrtime.bigint() - t1) / 1e6 / Math.max(1, exam.length);
const sureN = exam.length - unsure, sureRight = ok - unsureRight;

// 6) save for the phone
const out = path.join(ROOT, 'docs/brain/weights.js');
const json = JSON.stringify(model);
fs.writeFileSync(out, `// Trained by tools/train.js on ${model.trained}. Do not edit: retrain instead.\n(function(r){var W=${json};if(typeof module==='object'&&module.exports)module.exports=W;else r.MiniBrainWeights=W;})(typeof window!=='undefined'?window:globalThis);\n`);

const pc = (a, b) => b ? Math.round(100 * a / b) + '%' : '-';
console.log(`
🧠 Mini Brain trained
  examples   ${train.length} (+${mess.length} with made-up typos)  real log lines: ${realU.length}
  actions    ${allLabels.join(', ')}
  clues kept ${Object.keys(model.w).length}   words known ${Object.keys(model.vocab).length}
  size       ${(fs.statSync(out).size / 1024).toFixed(0)} KB   train ${trainMs} ms   answer ${perMsg.toFixed(2)} ms/message

📝 Exam (${exam.length} messages it never saw)
  new brain  ${ok}/${exam.length} = ${pc(ok, exam.length)}${oldRules && oldRules.rulesKind ? `\n  old rules  ${okOld}/${exam.length} = ${pc(okOld, exam.length)}` : ''}
  sure (80%+)  ${sureN} messages, right ${pc(sureRight, sureN)}
  unsure       ${unsure} messages → would ask you / Claude

🎓 Practice exam (each example hidden once, ${practice.n} messages)
  right        ${pc(practice.ok, practice.n)}
  sure (80%+)  ${practice.sure} messages, right ${pc(practice.sureOk, practice.sure)}
${copies.length ? `\n⚠️  Left out of training (same as an exam line): ${copies.map(c => `"${c}"`).join(', ')}\n` : ''}${clash.length ? `\n⚠️  Same line, two actions:\n  ${clash.join('\n  ')}\n` : ''}
${wrong.length ? 'Wrong:\n' + wrong.join('\n') : 'No mistakes.'}
`);
