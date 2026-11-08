# TaskNotes: tasks

**Doors (MCP tools):** `add_task` (add) · `delete_item` (Undo, Darren confirms in the app) · `day_summary` (read)

**What it sends back:** one line per task:
`- [id] Title | Category | when | time | 📝 job notes`
- `when` = `OVERDUE, was 2026-10-26` / `today` / `tomorrow` / `2026-11-12` / `no date`
- `time` = `30m`, `1h 15m` (only if set)

**How Orbit shows it (code, not the model):**
- Title in **bold**
- Date chip: 🔴 overdue · 🟠 today · 🔵 tomorrow · ⚪ later · none if no date
- Time chip: ⏱ 30m
- Job notes: one small grey line under the title
- At most 6 rows
