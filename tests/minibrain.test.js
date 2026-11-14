// node --test tests/minibrain.test.js — the shared Mini Brain (docs/brain/core.js)
const test = require('node:test'), assert = require('node:assert');
const MB = require('../docs/brain/core.js'), W = require('../docs/brain/weights.js');
const b = () => MB.create(W);

test('tidy', () => assert.equal(MB.tidy("Dentist Tues @ 3PM! £12.50"), 'dentist tues 3pm £12.50'));
test('swap prices, times, dates', () => {
  assert.deepEqual(MB.read('spent £12.50 at tesco tomorrow 3pm').tokens, ['spent', '[money]', 'at', 'tesco', '[date]', '[time]']);
  assert.deepEqual(MB.read('dentist 12th nov 2-3pm').tokens, ['dentist', '[date]', '[time]']);
  assert.deepEqual(MB.read('dentist tues').tokens, ['dentist', '[day]']);
});
test('swapped letters: braed → bread (1 slip)', () => assert.equal(MB.distance('braed', 'bread', 2), 1));
test('spell fix uses known words', () => {
  const r = MB.read('dentisst tues 3pm', W.vocab, W.typos);
  assert.deepEqual(r.fixes, [['dentisst', 'dentist']]);
});
test('own typo list first', () => assert.deepEqual(MB.read('tomoz', W.vocab, W.typos).tokens, ['[date]']));
const cases = [['dentist tue 3pm', 'calendar'], ['buy bin bags', 'task'], ['wifi password is fish22', 'note'],
  ['tesco 5.10 crisps', 'money'], ['whats on tomorrow', 'question'], ['milk use by friday', 'other'],
  ['dentsit tues 3pm', 'calendar'], ['rign the council', 'task']];
for (const [m, k] of cases) test(`${m} → ${k}`, () => assert.equal(b().predict(m).label, k));
test('% sure is between 0 and 1, ranked best first', () => {
  const p = b().predict('dentist tue 3pm');
  assert.ok(p.sure > 0.8 && p.sure <= 1); assert.ok(p.ranked[0].p >= p.ranked[1].p); assert.ok(p.why.length);
});
test('only the actions an app has', () => assert.equal(b().predict('dentist tue 3pm', { allowed: ['task', 'note'] }).ranked.length, 2));
test('live learning: one tap fixes it, forget undoes', () => {
  const x = b(); const msg = 'jacket size large';
  x.learn(msg, 'note'); const p = x.predict(msg); assert.equal(p.label, 'note'); assert.ok(p.sure >= 0.9);
  x.forget(); assert.notEqual(x.predict(msg).sure >= 0.9 && x.predict(msg).label === 'note', true);
});
test('answers in under 5 ms', () => {
  const x = b(), t = Date.now(); for (let i = 0; i < 100; i++) x.predict('spent 12.50 at tesco on the card'); assert.ok((Date.now() - t) / 100 < 5);
});
