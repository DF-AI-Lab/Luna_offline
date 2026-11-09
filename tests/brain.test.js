// node --test tests/*.test.js
const test = require('node:test'), assert = require('node:assert');
const R = require('../docs/web/brain.js');
const NOW = new Date(2026, 10, 8, 20, 30); // Sun 8 Nov 2026 20:30
const g = (m, lessons) => R.guess(m, NOW, lessons || []);
const cases = [
  ['Add 20 to spends for sky', { kind: 'money', amount: 20, money_type: 'spend' }],
  ['spent 12.50 at tesco', { kind: 'money', amount: 12.5 }],
  ['dentist tue 3pm', { kind: 'calendar', title: 'Dentist', date: '2026-11-10', time: '15:00' }],
  ['tennis tonight at 6', { kind: 'calendar', title: 'Tennis', date: '2026-11-08', time: '18:00' }],
  ['buy bin bags', { kind: 'task', title: 'Buy bin bags', date: '' }],
  ['ring the council friday', { kind: 'task', date: '2026-11-13' }],
  ['note: wifi code is 1234', { kind: 'note', text: 'wifi code is 1234' }],
  ['please add to notes meeting mon 9 20:00', { kind: 'note' }],
  ["what's on this week?", { kind: 'question', about: 'diary' }],
  ["how's my money", { kind: 'question', about: 'money' }],
  ['show my notes about wifi', { kind: 'question', about: 'notes', search: 'wifi' }],
  ['show my project ideas notes', { kind: 'question', about: 'notes', category: 'AI Lab' }],
  ['£12.50 tesco', { kind: 'money', money_type: 'spend', amount: 12.5, title: 'Tesco' }],
  ['spent £8 at greggs', { kind: 'money', money_type: 'spend', amount: 8, title: 'Greggs' }],
  ['£25 amazon on the card', { kind: 'money', money_type: 'card', amount: 25, title: 'Amazon' }],
  ['paid £100 off the card', { kind: 'money', money_type: 'paid_off', amount: 100 }],
  ['netflix £11 a month on the 3rd', { kind: 'money', money_type: 'bill', amount: 11, day: '3', title: 'Netflix' }],
  ['£40 gas next friday', { kind: 'money', money_type: 'upcoming', amount: 40, date: '2026-11-13', title: 'Gas' }],
  ['dentist 12th nov 2-3pm', { kind: 'calendar', date: '2026-11-12', time: '14:00', end: '15:00' }],
  ['fix the shed takes 2 hours', { kind: 'task', estimate_mins: 120 }],
  ['haircut thursday 10am', { kind: 'calendar', title: 'Haircut', date: '2026-11-12', time: '10:00' }],
  ['put bins out in my diary sunday 8pm', { kind: 'calendar', date: '2026-11-15', time: '20:00' }],
];
for (const [m, want] of cases) test(m, () => {
  const got = g(m);
  for (const [k, v] of Object.entries(want)) assert.deepStrictEqual(got[k], v, `${m} → ${k}: ${JSON.stringify(got)}`);
});
test('a past correction wins', () => {
  const got = g('add mum birthday present', [{ msg: 'add mum birthday present idea', right: 'note', picked: 'task' }]);
  assert.equal(got.kind, 'note');
});
test('reads Orbit prompt', () => {
  const p = `You are Orbit\nNow: Sunday 2026-11-08 20:30 (UK time).\n\nDarren's past corrections (follow these):\n- "x y z" → note (NOT calendar)\n\nReply...\nMessage: buy milk`;
  const r = R.readPrompt(p);
  assert.equal(r.msg, 'buy milk'); assert.equal(r.lessons[0].right, 'note'); assert.equal(r.now.getHours(), 20);
});
