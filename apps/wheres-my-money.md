# Where's My Money (connector: "Where's My Money")

Darren's money app. One bank account, payday to payday. Server code: `DF-AI-Lab/wheres-my-money-lite` → `worker/`.

## Doors (tools)
- `money_summary` → text: spare cash, spent, still to come out, card used/free, pots, bills
- `add_spend {amount, name, date?, upcoming?}` → spend from the bank (upcoming = still to come out)
- `add_bill {amount, name, day?}` → new monthly bill (day 1-31 or "varies")
- `card_spend {amount, name, date?}` → bought on the credit card
- `card_paid_off {amount, date?}` → paid off the card
- `remove_added {id}` → Undo. Only works on what Claude added

## What it sends back
- Adds: `Sent: … id c-YYYYMMDD-HHMMSS-xxxx. …` → the page keeps that id for Undo
- Changes show in the app (and the summary) after Darren next opens the app

## How it's shown
- Receipt with a green **Money** tag + Undo + Wrong app?
- "How's my money?" → 3 cards: Money this month, Pots, Bills still to go out
