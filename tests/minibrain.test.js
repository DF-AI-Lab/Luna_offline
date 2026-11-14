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

// ---- v1.07: things that used to go wrong ----
test('more swaps: codes, long numbers, how long, time slots, sat/sun, question mark', () => {
  assert.deepEqual(MB.read('car reg is yx19 abc').tokens, ['car', 'reg', 'is', '[code]', 'abc']);
  assert.deepEqual(MB.read('mums number 07700 900123').tokens, ['mums', 'number', '[long]', '[long]']);
  assert.deepEqual(MB.read('come back in 6 months').tokens, ['come', 'back', 'in', '[howlong]']);
  assert.deepEqual(MB.read('boiler man tues 8-12').tokens, ['boiler', 'man', '[day]', '[time]']);
  assert.deepEqual(MB.read('footy sat').tokens, ['footy', '[day]']);
  assert.deepEqual(MB.read('tenner on the lottery').tokens, ['[money]', 'on', 'the', 'lottery']);
  assert.deepEqual(MB.read('tesco 23.50').tokens, ['tesco', '[dec]']);
  assert.deepEqual(MB.read('free on sunday?').tokens, ['free', 'on', '[day]', '[?]']);
});
test('spell fix leaves real words and shop names alone', () => {
  const vocab = { cost: 9, cheese: 9, paint: 9, bread: 9, finish: 9, fish: 9, tesco: 9, rare: 1 };
  const fix = w => MB.spellFix([w], vocab, {}).words[0];
  assert.equal(fix('costa'), 'costa');      // not "cost": never stick/drop a letter on the end of a short word
  assert.equal(fix('chinese'), 'chinese');  // not "cheese": 2 slips only for 8+ letters
  assert.equal(fix('toast'), 'toast');      // not "cost": first letter must match
  assert.equal(fix('rarre'), 'rarre');      // not "rare": it only saw that word once
  assert.equal(fix('braed'), 'bread');      // swapped letters: still fixed
  assert.equal(fix('finsh'), 'finish');     // tie with "fish": the longer word wins
  assert.equal(fix('constructor'), 'constructor');
});
test('made-up typo copies do not count as known words', () => {
  const m = MB.train([{ text: 'buy milk', label: 'task' }, { text: 'buy mlik', label: 'task', made: true }, { text: 'tesco 5', label: 'money' }]);
  assert.ok(m.vocab.milk); assert.ok(!m.vocab.mlik);
});
test('a word it has never seen still gets a sensible guess from the shape', () => {
  assert.equal(b().predict('zzbloggs 4.75').label, 'money');
  assert.equal(b().predict('zzbloggs thurs 3pm').label, 'calendar');
});
test('lots of taps of one kind do not drag everything else that way', () => {
  const x = b();
  for (let i = 0; i < 40; i++) x.learn('qqthing' + i + ' wwstuff' + i, 'note');
  for (const [m, k] of cases) assert.equal(x.predict(m).label, k, m);
  assert.ok(!x.mine().bias);
});
test('tricky pairs', () => {
  const pairs = [['pay gas bill friday', 'task'], ['gas 40 friday', 'money'], ['book dentist', 'task'], ['dentist tues 3pm', 'calendar'],
    ['tesco crisps 1.50', 'money'], ['crisps use by fri', 'other'], ['did i pay the gas bill', 'question'], ['remind me to book the mot', 'task']];
  for (const [m, k] of pairs) assert.equal(b().predict(m).label, k, m);
});
