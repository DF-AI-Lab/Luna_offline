# TaskNotes: notes

**Doors (MCP tools):** `add_note` (add) · `delete_item` (Undo) · `list_notes` (read, can filter by category or search word) · `add_task` (for "Make it a task?")

**What it sends back:** one line per note, oldest first:
`- [id] 🔖? Note text | Category`  (🔖 = flagged "review later")

**How Orbit shows it (code, not the model):**
- 5 newest only
- First line only (up to the first full stop, max ~70 letters); tap to open the rest
- Category as a small grey label on the right
- If the note has a date or time in it ("4 Oct", "Tue", "3pm"): a small **Make it a task?** button
- "show my notes about X" → filter by category (Home, Work, AI Lab, Health) or a search word
