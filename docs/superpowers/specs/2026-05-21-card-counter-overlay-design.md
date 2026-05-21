# Card Counter Overlay — Design Spec
**Date:** 2026-05-21  
**Status:** Approved

---

## Overview

A floating desktop overlay app for Blackjack card counting. Built with Electron, it lives as a small always-on-top corner widget that shows the running count, true count, bet advice, and hand advice in real time. Cards are logged via global keyboard shortcuts so the user never needs to touch the mouse while playing.

---

## Tech Stack

- **Runtime:** Electron (v32+)
- **UI:** Vanilla HTML/CSS/JS in the renderer process (no framework needed — the UI is small)
- **Counting logic:** Pure JS module, fully unit-testable without Electron
- **Packaging:** electron-builder for Windows `.exe` installer

---

## Window Behaviour

- **Frameless, transparent** Electron `BrowserWindow` anchored to the **bottom-right corner** of the primary display
- **Always on top** (`alwaysOnTop: true`, level `'screen-saver'` on Windows)
- **Draggable** — user can reposition it; position persists via `electron-store`
- **Two states:**
  - **Collapsed** — compact badge (~80×80px): running count + colour bar only
  - **Expanded** — full card (~210×280px): all details visible
  - Toggle with the `~` global shortcut or by hovering (auto-expand on hover, auto-collapse on mouse-leave with 1.5s delay)
- **No taskbar entry** — `skipTaskbar: true`
- **System tray icon** with a context menu: Show/Hide, Reset Shoe, Settings, Quit

---

## Counting Algorithm — Hi-Lo

| Cards | Value |
|-------|-------|
| 2, 3, 4, 5, 6 | +1 |
| 7, 8, 9 | 0 |
| 10, J, Q, K, A | −1 |

**True Count** = Running Count ÷ Decks Remaining  
**Decks Remaining** = (Total Cards − Cards Seen) ÷ 52

---

## UI — Expanded State

```
┌─────────────────────────┐
│ Card Counter    ⚙ 6 dec │  ← deck config button
├─────────────────────────┤
│ Running         True    │
│   +4             +1.3   │
├─────────────────────────┤
│ 💰 Bet   Raise 2–3×     │  ← green / yellow / red
├─────────────────────────┤
│ 🃏 Hand  HIT            │  ← blue
├─────────────────────────┤
│ Decks remaining         │
│ ████████░░░░  2.5 / 6   │  ← progress bar
├─────────────────────────┤
│ 2–6 +1 · 7–9 0 · 10-A−1│  ↺ Reset │
└─────────────────────────┘
```

**Colour coding for bet advice:**
- True Count ≥ +2 → green — "Raise 2–3×"
- True Count +1 to +1.9 → yellow — "Raise slightly"
- True Count 0 to +0.9 → neutral — "Table minimum"
- True Count < 0 → red — "Sit out / minimum"

**Hand advice** is count-based deviation hints — at high true counts the app surfaces the most common index plays (e.g. "Insurance profitable at TC ≥ +3", "Stand 16 vs 10 at TC ≥ 0"). No hand-total input required in v1; advice updates automatically as the count changes.

---

## Keyboard Shortcuts (Global — work even when window is not focused)

| Key | Action |
|-----|--------|
| `2` `3` `4` `5` `6` | Log card → count +1 |
| `7` `8` `9` | Log card → count ±0 |
| `T` `J` `Q` `K` `A` | Log card → count −1 |
| `` ` `` (backtick / tilde key) | Toggle expand/collapse |
| `R` | Reset shoe (with confirmation flash) |
| `Esc` | Collapse widget |

> All shortcuts are registered via Electron's `globalShortcut` API so they fire regardless of which window has focus.

---

## Settings Panel

Accessed via the ⚙ button or system tray. A small modal overlay on the widget:

- **Number of decks:** 1 / 2 / 4 / 6 / 8 (default: 6)
- **Hand advice:** On / Off toggle
- **Auto-expand on hover:** On / Off toggle
- **Opacity:** slider 40–100%

Settings persisted with `electron-store` (JSON on disk).

---

## State Model

All state lives in a single plain JS object managed by the counting engine:

```js
{
  runningCount: 0,       // integer, can be negative
  cardsSeen: 0,          // total cards logged this shoe
  totalDecks: 6,         // from settings
  // derived:
  decksRemaining,        // (totalDecks * 52 - cardsSeen) / 52
  trueCount,             // runningCount / decksRemaining
  betAdvice,             // string from colour-coded thresholds
}
```

The renderer subscribes to state via Electron's `ipcRenderer` — main process owns state, renderer displays it. This keeps the counting logic testable in isolation.

---

## File Structure

```
card-counter/
├── package.json
├── electron-builder.yml
├── src/
│   ├── main.js            # Electron main process: window, tray, globalShortcut
│   ├── counter.js         # Pure counting logic (no Electron dependency)
│   ├── settings.js        # electron-store wrapper
│   ├── preload.js         # contextBridge — exposes safe IPC to renderer
│   └── renderer/
│       ├── index.html
│       ├── style.css
│       └── app.js         # DOM updates, IPC listeners
└── test/
    └── counter.test.js    # Unit tests for counting logic
```

---

## Error Handling

- **Count goes stale:** `R` key resets the shoe — a brief red flash confirms the reset
- **Window off-screen:** On startup, clamp position to display bounds
- **Settings corruption:** Fall back to defaults silently, re-write the file

---

## Out of Scope (v1)

- Card recognition via screen capture / OCR (future enhancement)
- Multiple display support beyond primary monitor
- Mac / Linux builds (Windows only for v1)
- Multiplayer / shared counting sessions
