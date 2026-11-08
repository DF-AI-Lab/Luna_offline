# Luna Offline 🌙

**Orbit's brain, Luna's look.**

- Logic = Orbit (from `DF-AI-Lab/app-assistant`, `orbit/orbit.html`). Unchanged.
- Look = Luna (from `DF-AI-Lab/luna`, `app/luna.html`): night sky, stars, real moon, glass cards, fonts.

## Two versions
- **claude.ai** (works now): https://claude.ai/artifact/11AeVi2bLt7z72AW4FA8MS · source `app/luna-offline.html`
- **Install on your phone** (GitHub Pages): https://df-ai-lab.github.io/Luna_offline/ · source `docs/` (built from the same file)

## Files
- `app/luna-offline.html` — the app (one page)
- `apps/*.md` — app recipes (Diary, To-do, Notes, Money)
- `screenshots/` — Luna vs Luna Offline, phone size
- `docs/` — the installable web app (GitHub Pages, from `main` / `docs`)
  - `index.html` = built by `python3 tools/build_web.py` (never edit by hand)
  - `passport/` = copy of Passport ID v0.3.5 (the lock) + `theme.json` (Luna's look)
  - `web/brain.js` = the FREE brain (offline, on the phone)
  - `web/claude.js` = Claude backup (your API key, monthly £ cap)
  - `web/connect.js` = Calendar, TaskNotes, WMM
  - `web/store.js` = memory (phone + Drive), `web/shim.js` = stands in for claude.ai
  - `web/settings.js` + `web/web.css` = ⚙ screen, lock wiring
- `patches/` — the one-line server change TaskNotes needs
- Tests: `node --test tests/brain.test.js` and `node tests/web.e2e.js`

## What changed vs Orbit
- CSS, header, fonts, colours → Luna's
- Orbit's orbit icon → a crescent moon
- Light/dark switch hidden (Luna is one dark look)
- Placeholder says "Tell Luna…"

## Not changed (on purpose)
- All JS logic, prompts, tools, database collections (`log`, `learning`)
- Some messages inside the logic still say "Orbit"

## Added after the reskin
- **Money** (Where's My Money connector): spends, upcoming, bills, card spend, card paid off, with Undo
- Ask "how's my money?" → spare cash, card, pots, bills still to go out

## Web version: how it works
- 🛂 Passport = the lock (Google sign-in, passcode, fingerprint)
- 🧠 Brain: **Free only** / **Free + Claude when unsure** (default) / **Always Claude**. Claude = Opus 5.5 by default (Haiku 5.5 to save money), low effort, stops at your £ cap
- 🔌 Apps: Diary = Google Calendar API. TaskNotes + WMM = their own servers, same login Claude uses
- 💾 Memory: this phone + Drive (App data / DF…… / Luna / luna-offline-data.json)

## Next (from Luna's plan)
- Swap Claude for a free tiny offline model, API only as a capped backup
- Learn from Luna's `log/` replies
