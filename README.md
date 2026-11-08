# Luna Offline 🌙

**Orbit's brain, Luna's look.**

- Logic = Orbit (from `DF-AI-Lab/app-assistant`, `orbit/orbit.html`). Unchanged.
- Look = Luna (from `DF-AI-Lab/luna`, `app/luna.html`): night sky, stars, real moon, glass cards, fonts.

## Files
- `app/luna-offline.html` — the app (one page)
- `apps/*.md` — app recipes (Diary, To-do, Notes, Money)
- `screenshots/` — Luna vs Luna Offline, phone size

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

## Next (from Luna's plan)
- Swap Claude for a free tiny offline model, API only as a capped backup
- Learn from Luna's `log/` replies
