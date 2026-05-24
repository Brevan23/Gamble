# Card Input Pad — Design Spec

**Date:** 2026-05-24  
**Status:** Approved

---

## Overview

Replace the existing keyboard-only hand mode (H key → type digits → type dealer card) with an always-visible on-screen card pad. Every card seen at the table is entered through this pad. Modifier keys (hold H, hold D) route specific cards to the strategy advisor while also updating the running count.

---

## User Stories

1. **Other players' cards** — I tap a card button and the running count updates. No strategy change.
2. **My cards** — I hold H and tap card buttons. Each card is added to my hand display and the running count updates. Strategy advice appears once my hand and the dealer card are both set.
3. **Dealer card** — I hold D and tap a card button. The dealer card is set and the running count updates. Strategy advice appears once my hand is also set.
4. **Delete** — I tap ⌫ to remove the last card from my hand, or to clear the dealer card (if my hand is empty).
5. **New Hand** — Between hands I tap "↺ New Hand" to clear my hand and the dealer card. The running count is preserved.
6. **Reshuffle** — When the dealer reshuffles I tap "🔀 Reshuffle" to hard-reset the running count, true count, my hand, and the dealer card.

---

## UI Layout (Expanded View)

The expanded view gains a permanent card input section between the counts and the advice blocks. Existing elements reorder slightly to accommodate.

```
┌─────────────────────────────┐
│ Card Counter            ⚙  │  ← header (unchanged)
├─────────────────────────────┤
│ Running +4      True +2.1   │  ← counts (unchanged)
├─────────────────────────────┤
│ 🎯 Action   STAND           │  ← strategy advice (unchanged, hidden until hand set)
│ 💰 Bet      2× min          │  ← bet advice (unchanged)
├─────────────────────────────┤
│ YOUR HAND  · hold H         │
│ [9] [7]              16     │  ← player card display (new)
│ DEALER  · hold D            │
│ [6]                         │  ← dealer card display (new)
├─────────────────────────────┤
│ [2][3][4][5][6][7][8][9][T][A][⌫] │  ← card pad (new)
│ tap=any · H=yours · D=dealer│  ← hint text (new)
├─────────────────────────────┤
│ [↺ New Hand]  [🔀 Reshuffle]│  ← two reset buttons (replaces single Reset)
├─────────────────────────────┤
│ Decks remaining   4.2 / 6  │
│ ████████░░░░░░░░░░░░░░░░░░  │
└─────────────────────────────┘
```

---

## Card Pad Behaviour

### Modifier states (keyboard)

| Key held | Card pad colour | Effect of tap / key press |
|----------|-----------------|---------------------------|
| Neither  | Default (grey)  | Count card only — no strategy change |
| H        | Blue highlight  | Add card to player hand + count |
| D        | Orange highlight| Set dealer upcard + count |

Holding H and D simultaneously is ignored (H takes priority).

### Modifier states (mouse only)

The same modifier logic applies to mouse clicks — if the H or D key is physically held while clicking a card button, the card is routed accordingly. Users who want mouse-only can press and hold H/D while clicking.

### Card values

Buttons: `2 3 4 5 6 7 8 9 T A`  
J, Q, K are absent — all map to T (ten-value). The keyboard still accepts `j`, `q`, `k` and normalises them to T.

### Player hand logic

- Cards are stored as an array of individual card values (e.g. `['9', '7']`), not a pre-computed total.
- **Total** is computed from the array: Aces count as 11, reduced to 1 if busting.
- **Soft** is detected automatically: hand contains an Ace counting as 11.
- **Pair** is detected automatically: exactly two cards of equal value.
- Strategy lookup receives `{ total, soft, pair, dealer }` — same shape as before.
- Maximum cards in hand: no hard limit, but strategy advice only shows for totals 4–21.

### Dealer card logic

- Only one dealer card is tracked (the upcard).
- Setting a new dealer card while one exists replaces it.

### Delete (⌫) behaviour

- If player hand has cards → removes the last card.
- If player hand is empty and dealer card is set → clears the dealer card.
- Keyboard: `Backspace` key while expanded.

---

## Reset Buttons

### ↺ New Hand
- Clears player hand array.
- Clears dealer card.
- Preserves running count, true count, decks remaining.
- Strategy advice hides.
- Keyboard shortcut: `N` key (while expanded, outside settings).

### 🔀 Reshuffle
- Resets running count to 0.
- Resets true count to 0.
- Resets decks remaining to configured total.
- Clears player hand and dealer card.
- Triggers the existing red flash animation on the widget border.
- Keyboard shortcut: existing `R` key (behaviour unchanged).

---

## Removed / Changed

- **Old hand mode** (press H to enter, type digits, type dealer) is removed entirely.
- The `hand-mode-row` element and its label are removed from the DOM.
- The `enterHandMode` / `exitHandMode` / `handleHandModeKey` functions in `app.js` are removed.
- The H key no longer toggles a separate mode; it is now purely a held modifier.
- The existing Reset button in the footer is replaced by the two new buttons above.
- The footer hint text (`2–6 +1 · 7–9 0 · 10-A −1`) is removed to reclaim space; the new hint row on the card pad serves this purpose.

---

## State Shape Changes

`counter.js` stores hand state alongside the count:

```js
// Added to internal state
playerCards: [],   // e.g. ['9', '7']
dealerCard: null,  // e.g. '6'
```

`getAdvice` is called in the renderer (unchanged API). The renderer computes `total`, `soft`, `pair` from `playerCards` before calling it.

The IPC `counter:logCard` handler gains an optional second argument `target`:

```js
ipcRenderer.invoke('counter:logCard', cardKey, target)
// target: 'player' | 'dealer' | undefined (count-only)
```

The returned state object from all counter IPC calls includes `playerCards` and `dealerCard` so the renderer can re-render.

New IPC handlers:
- `counter:newHand` — clears hand/dealer, returns new state
- `counter:deleteCard` — removes last player card or dealer card, returns new state

`counter:reset` (existing) now also clears `playerCards` and `dealerCard`.

---

## Files Affected

| File | Change |
|------|--------|
| `src/renderer/index.html` | Add card pad section, hand/dealer displays, update reset buttons, remove hand-mode-row |
| `src/renderer/style.css` | Add card pad styles, hand display styles, modifier-active states |
| `src/renderer/app.js` | Remove hand mode logic, add card pad click handlers, H/D keydown/keyup listeners, delete handler, new hand handler |
| `src/counter.js` | Add `playerCards`, `dealerCard` to state; add `newHand`, `deleteCard` methods; update `reset`; update returned state shape |
| `src/preload.js` | Expose `newHand`, `deleteCard` IPC calls; update `logCard` signature |
| `src/main.js` | Register `counter:newHand`, `counter:deleteCard` IPC handlers |

---

## Out of Scope

- Auto-detection (screen capture) — unchanged.
- Settings panel — unchanged.
- Collapsed view — unchanged.
- Split / pot sizing — not in scope.
