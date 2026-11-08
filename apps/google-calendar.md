# Google Calendar

**Doors (MCP tools):** `create_event` (add) · `delete_event` (Undo) · `list_events` (read)

**What it sends back:** JSON, `events[]` with `id`, `summary`, `start.dateTime` (UTC) or `start.date` (all day), `location`.

**How Orbit shows it (code, not the model):**
- Next 7 days, at most 6 events
- Title in **bold**, then "Tue 10 17:30" (UK time) or "Tue 10, all day" on the right
