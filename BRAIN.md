# 🧠 Mini Brain: how it works

One small offline brain for **all** your apps.
Not an LLM. A **word-weights sorter**.

- Size: ~150 KB (≈40 KB over the web)
- Speed: under 1 ms per message
- Works offline, on phone and PC

---

## The 5 steps (every message)

**1. Tidy**
`"Dentist Tues @ 3PM!"` → `dentist tues 3pm`

**2. Spell fix**
Only for words it has never seen.
- Your own list first (`skills/shared/typos.txt`)
- Then the closest known word, 1 slip away (2 for long words)
- A "slip" = a letter added, dropped, changed, or two swapped
- `braed` → `bread` · `dentisst` → `dentist`

**3. Swap**
Prices, times, dates become tokens:
`spent £12.50 tomorrow 3pm` → `spent [money] [date] [time]`
So it learns "has a price", not every price.

**4. Clues**
From `dentist [day] [time]` it makes:
- each word → `dentist`
- word pairs → `[day] [time]`
- the first word → good for questions ("what…")
- 3-letter chunks → `<de` `den` `ent` … so typos still match a bit

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

**Slow (now and then, here)**
- Every message is logged (phone + Drive)
- We retrain from the examples + your log → new `weights.js`

**What "training" is**
- Start every weight at 0
- Guess an example
- Nudge weights **up** for the right action, **down** for the others, by how wrong it was
- Do all examples 30 times (takes 0.2 s)
- Words seen everywhere ("the", "at") end up near 0

---

## The files

| File | What |
|---|---|
| `docs/brain/core.js` | the brain (shared by every app) |
| `docs/brain/weights.js` | what it learned (made by training, don't edit) |
| `skills/luna/` | Luna's skill pack: actions + examples |
| `skills/luna/test.txt` | the exam, never trained on |
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

## Score (14 Nov 2026)

Exam of 54 messages it never saw:
- **New brain: 96%** (old rules: 85%)
- When sure (80%+): right **100%** of the time
- The 2 it got wrong were both "unsure" → it would ask you

⚠️ The exam is my writing, not yours yet. Your real messages will give the honest score.
