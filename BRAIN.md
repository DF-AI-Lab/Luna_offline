# 🧠 Mini Brain: how it works

One small offline brain for **all** your apps.
Not an LLM. A **word-weights sorter**.

- Size: ~200 KB (≈50 KB over the web)
- Speed: under 1 ms per message
- Works offline, on phone and PC

---

## The 5 steps (every message)

**1. Tidy**
`"Dentist Tues @ 3PM!"` → `dentist tues 3pm`

**2. Spell fix**
Only for words it has never seen.
- Your own list first (`skills/shared/typos.txt`)
- Then the closest known word, 1 slip away (2 for words of 8+ letters)
- A "slip" = a letter added, dropped, changed, or two swapped
- `braed` → `bread` · `dentisst` → `dentist`

Safety rules, so it doesn't "fix" real words:
- Only fixes **to** a word it knows well (seen 3+ times)
- First letter must match
- Short words: only swapped letters, or a letter missing in the middle
- So `costa` stays `costa` (not `cost`)

**3. Swap**
Prices, times, dates become tokens:
`spent £12.50 tomorrow 3pm` → `spent [money] [date] [time]`
So it learns "has a price", not every price.

All the tokens:

| Token | Means | Example |
|---|---|---|
| `[money]` | a price | `£12.50`, `20 quid`, `tenner` |
| `[time]` | a time or time slot | `3pm`, `8-12` |
| `[date]` `[day]` | a date / a weekday | `12th nov`, `tomoz` / `tues`, `sat` |
| `[howlong]` | a length of time | `2 hours`, `6 months` |
| `[dec]` | number with a dot | `4.20` (mostly a price) |
| `[num]` | a whole number | `40` |
| `[long]` | a long number | phone, pin, account |
| `[code]` | letters + digits mixed | `yx19`, `e14` |
| `[?]` | it had a question mark | `free sunday?` |

**4. Clues**
From `dentist [day] [time]` it makes:
- each word → `dentist`
- word pairs → `[day] [time]`
- the first word → good for questions ("what…")
- 3-letter chunks → `<de` `den` `ent` … so typos still match a bit
- **new word** → `[new]` for a word it hardly knows (a new shop, a name).
  It can't know the word, but it knows the shape:
  `[new] [dec]` = money · `[new] [day] [time]` = diary
- **how many numbers** → one number is often a price, several is often a note

**5. Score**
- Each clue has a **weight per action** (Diary, To-do, Note, Money, Question, Fridge)
- Add them up → biggest total wins
- Totals → % (they add up to 100). Big gap between top two = sure.

---

## Sure or not?

- **80%+** → does it
- **Under 80%** → "Did you mean…?" buttons
  (or Claude, if you turned Claude on in ⚙)

---

## How it learns

**Fast (on the phone, at once)**
- You tap a "Did you mean" button, or "Wrong app?"
- It nudges **your own layer** of weights until that message comes out right
- Next time: sure, no question
- It only nudges the clues from **that message's words**,
  so 40 "note" taps can't make everything lean "note"

**Slow (now and then, here)**
- Every message is logged (phone + Drive)
- We retrain from the examples + your log → new `weights.js`

**What "training" is**
- Start every weight at 0
- Guess an example
- Nudge weights **up** for the right action, **down** for the others, by how wrong it was
- Do all examples 30 times (takes under 1 s)
- Words seen everywhere ("the", "at") end up near 0

---

## The files

| File | What |
|---|---|
| `docs/brain/core.js` | the brain (shared by every app) |
| `docs/brain/weights.js` | what it learned (made by training, don't edit) |
| `skills/luna/` | Luna's skill pack: actions + examples |
| `skills/luna/test.txt` | the exam, never trained on (the trainer checks) |
| `skills/shared/typos.txt` | your typos, shared by every app |
| `tools/train.js` | the trainer |
| `docs/web/brain.js` | Luna's Stage 2: pulls out £, dates, times, titles |

**Stage 1** (the brain) picks the action.
**Stage 2** (rules) pulls out the details.
Post room: Stage 1 reads the envelope, Stage 2 opens the letter.

---

## Retrain

Examples only:
```bash
node tools/train.js
```

With your real log (download `luna-offline-data.json` from Drive first):
```bash
node tools/train.js ~/Downloads/luna-offline-data.json
```

Then rebuild + test:
```bash
python3 tools/build_web.py && npm test
```

The log file has your real messages, so **don't commit it**.

---

## Add another app later

1. New folder `skills/<app>/`
2. `pack.json` = its actions
3. One `<action>.txt` per action, ~50+ examples each
4. `test.txt` = an exam
5. Retrain

Same brain, same typos. Words learned in Luna help the new app too.

---

## Score (14 Nov 2026, v1.07)

**The exam**: 430 messages it never trained on.

| | Old brain (v1.06) | New brain (v1.07) |
|---|---|---|
| Right | 81% | **96%** |
| When sure (80%+), right | 90% | **99%** |
| Has to ask you | 136 times | 38 times |

Old hand-written rules on the same exam: 57%.

**Two more honest checks**

- **Blind batch**: 70 new messages, written last, run once → **93%** (sure → 98% right)
- **Practice exam**: hide a fifth of the examples, train on the rest, test the hidden ones.
  Repeat 5 times → **94%** on 2,046 messages (sure → 98% right)

So expect about **93 to 96%** on new messages, until we have your real log.

**Does 80% sure mean 80% right?** (from the practice exam)

| It says | It was right |
|---|---|
| 95%+ | 99% |
| 80 to 95% | 92% |
| 60 to 80% | 69% |
| under 60% | 56% |

So the 80% line is in the right place.

⚠️ The exam is still my writing, not yours. Your real messages will give the true score.

---

## What changed in v1.07, and why

**1. Four times more examples** (430 → 2,050)
- Biggest win by far. It can't know a pattern it never saw.
- Now 250 to 440 per action. Fridge had only 36.

**2. A much harder exam** (54 → 430 lines)
- The old exam was too easy: 96% hid the real 81%.
- The trainer now **refuses to train on a line that reads the same as an exam line**, and tells you.

**3. "New word" clue** (`[new]`)
- A shop it never heard of still looks like money: `zzbloggs 4.75`.

**4. More tokens**
- `[howlong]`: "come back in 6 months" was being read as £6.
- `[long]` and `[code]`: phone numbers, pins and reg plates are notes, not prices.
- `[dec]`: "4.20" and "40" are different clues now.
- `[?]`: a question mark counts.
- `sat`, `sun`, `wed` were missing from the weekdays. `tenner` works without "a".

**5. Safer spell fix**
- It was "fixing" real words: `costa` → `cost`, `chinese` → `cheese`.
- See the safety rules in step 2.
- Made-up typo copies no longer count as "known words".

**6. Taps can't skew the whole brain**
- Live learning now leaves the general clues alone.

**7. Stage 2 (the details) fixes**
- Diary times with no am/pm: `chiro thurs 5.30` → 17:30 · `gas man fri 8-1` → 08:00 to 13:00
- `tomoz`, `2moro` now reach the date finder
- "day after tomorrow" was read as tomorrow
- `put bins out` kept losing its "put"
- `a fiver` / `tenner` → £5 / £10
- `2 coffees 7.10` → £7.10, not £2
- `whats in my diary` was **added to** the diary. Now it's a question.
- `vet bill 90` is a one-off spend, not a monthly bill
- Nearly the same as something you corrected → it does what you said then

**Tried, made no real difference, left out** (kept it simple)
- A "last word" clue
- Turning the % down across the board
- Stronger "forgetting" (regularisation), more or fewer passes

---

## Still weak

- Tasks with a question word inside: `find out when bin day is` → thinks question
- Notes with one number: `parked in bay 42` → thinks money
- Bare lists: `6 eggs left`
- "Owes" messages: note or money? Even people disagree.
- All of these mostly come out "unsure", so it asks.
