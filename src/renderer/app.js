// src/renderer/app.js
'use strict';

// ── DOM refs ──────────────────────────────────────────────────────────────
const collapsedView     = document.getElementById('collapsed-view');
const expandedView      = document.getElementById('expanded-view');
const settingsPanel     = document.getElementById('settings-panel');

const collapsedCount    = document.getElementById('collapsed-count');
const collapsedBar      = document.getElementById('collapsed-bar');

const runningCountEl    = document.getElementById('running-count');
const trueCountEl       = document.getElementById('true-count');
const betAdviceBlock    = document.getElementById('bet-advice-block');
const betAdviceText     = document.getElementById('bet-advice-text');
const handAdviceBlock   = document.getElementById('hand-advice-block');
const handAdviceText    = document.getElementById('hand-advice-text');
const decksLabel        = document.getElementById('decks-label');
const progressFill      = document.getElementById('progress-fill');

const settingsBtn       = document.getElementById('settings-btn');
const settingsClose     = document.getElementById('settings-close');
const deckButtons       = document.querySelectorAll('.deck-btn');
const handAdviceToggle  = document.getElementById('hand-advice-toggle');
const opacitySlider     = document.getElementById('opacity-slider');
const captureBtn        = document.getElementById('capture-btn');
const captureStatus     = document.getElementById('capture-status');
const captureStop       = document.getElementById('capture-stop');

const strategyBlock     = document.getElementById('strategy-block');
const strategyText      = document.getElementById('strategy-text');
const playerHandRow     = document.getElementById('player-hand-row');
const dealerHandRow     = document.getElementById('dealer-hand-row');
const cardPadEl         = document.getElementById('card-pad');
const deleteBtn         = document.getElementById('delete-btn');
const newHandBtn        = document.getElementById('new-hand-btn');
const reshuffleBtn      = document.getElementById('reshuffle-btn');
const sideBetBlock      = document.getElementById('side-bet-block');
const sideBetRowsEl     = document.getElementById('side-bet-rows');

// ── State ─────────────────────────────────────────────────────────────────
let expanded       = false;
let showHandAdvice = true;
let currentDecks   = 6;

// Keys currently held — used to determine card routing
const heldKeys = new Set();

// ── Card key set (keyboard) ───────────────────────────────────────────────
const CARD_KEYS = new Set(['2','3','4','5','6','7','8','9','t','j','q','k','a']);

// ── Hand computation ──────────────────────────────────────────────────────
// Returns { total, soft, pair } or null if cards array is empty.
function computeHandInfo(cards) {
  if (cards.length === 0) return null;
  // All face cards already normalised to 't' by Counter, but guard anyway
  const norm = cards.map(c => (c === 'j' || c === 'q' || c === 'k') ? 't' : c);

  // Pair: exactly two identical cards
  const pair = norm.length === 2 && norm[0] === norm[1] ? norm[0] : false;

  // Total: aces count as 11, reduced to 1 if bust
  let total = 0;
  let aces  = 0;
  for (const c of norm) {
    if      (c === 'a') { total += 11; aces++; }
    else if (c === 't') { total += 10; }
    else                { total += parseInt(c, 10); }
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }

  // Soft: an ace is still counting as 11
  const soft = aces > 0;

  return { total, soft, pair };
}

// ── Render ────────────────────────────────────────────────────────────────
function renderState(s) {
  // Collapsed
  collapsedCount.textContent = s.runningCount >= 0 ? `+${s.runningCount}` : `${s.runningCount}`;
  collapsedBar.className = `bar ${s.betAdvice.level}`;

  // Counts
  runningCountEl.textContent = s.runningCount >= 0 ? `+${s.runningCount}` : `${s.runningCount}`;
  trueCountEl.textContent    = s.trueCount    >= 0 ? `+${s.trueCount}`    : `${s.trueCount}`;

  // Bet advice
  betAdviceBlock.className = `advice-block ${s.betAdvice.level}`;
  betAdviceText.textContent = s.betAdvice.label;

  // Count-based deviation hints
  if (showHandAdvice && s.handAdvice) {
    handAdviceBlock.classList.remove('hidden');
    handAdviceText.textContent = s.handAdvice;
  } else {
    handAdviceBlock.classList.add('hidden');
  }

  // Deck progress
  const pct = Math.max(0, Math.min(100, (s.decksRemaining / s.totalDecks) * 100));
  progressFill.style.width = `${pct}%`;
  decksLabel.textContent   = `${s.decksRemaining} / ${s.totalDecks}`;

  // Hand displays + strategy advice
  renderHandDisplay(s);

  // Side bet advice (auto-hides once hand starts)
  renderSideBetAdvice(s);
}

function renderHandDisplay(s) {
  const { playerCards, dealerCard } = s;

  // Compute hand info once — reused for both the display total and strategy lookup
  const info = (playerCards && playerCards.length > 0) ? computeHandInfo(playerCards) : null;

  // ── Player hand ──
  if (!info) {
    playerHandRow.innerHTML = '<span class="empty-hand">—</span>';
    playerHandRow.classList.remove('player-active');
  } else {
    const cardEls = playerCards
      .map(c => `<span class="mini-card player">${c.toUpperCase()}</span>`)
      .join('');
    const totalEl = `<span class="hand-total">${info.total}</span>`;
    playerHandRow.innerHTML = cardEls + totalEl;
    playerHandRow.classList.add('player-active');
  }

  // ── Dealer card ──
  if (!dealerCard) {
    dealerHandRow.innerHTML = '<span class="empty-hand">—</span>';
    dealerHandRow.classList.remove('dealer-active');
  } else {
    dealerHandRow.innerHTML = `<span class="mini-card dealer">${dealerCard.toUpperCase()}</span>`;
    dealerHandRow.classList.add('dealer-active');
  }

  // ── Strategy advice (only when both hand and dealer are set) ──
  if (info && dealerCard && info.total >= 4 && info.total <= 21) {
    const advice = window.api.getAdvice({
      total:     info.total,
      soft:      info.soft,
      pair:      info.pair,
      dealer:    dealerCard,
      trueCount: s.trueCount,
    });
    if (advice) {
      strategyBlock.style.background = advice.color + '18';
      strategyBlock.style.border     = `1px solid ${advice.color}44`;
      strategyText.style.color       = advice.color;
      strategyText.textContent       = advice.label;
      strategyBlock.classList.remove('hidden');
    } else {
      strategyBlock.classList.add('hidden');
    }
  } else {
    strategyBlock.classList.add('hidden');
  }
}

function renderSideBetAdvice(s) {
  // Guard: elements must exist (defensive against future DOM refactors)
  if (!sideBetBlock || !sideBetRowsEl) return;

  // Hide once the hand has started
  if (s.playerCards && s.playerCards.length > 0) {
    sideBetBlock.classList.add('hidden');
    return;
  }

  const bets = window.api.getSideBetAdvice(s.trueCount, s.dealerCard);
  if (!bets || bets.length === 0) {
    sideBetBlock.classList.add('hidden');
    return;
  }

  sideBetRowsEl.innerHTML = bets
    .map(b => `<div class="side-bet-row">✅ <span>${b.name}</span><span class="side-bet-reason">${b.reason}</span></div>`)
    .join('');
  sideBetBlock.classList.remove('hidden');
}

function setExpanded(ex) {
  expanded = ex;
  if (ex) {
    collapsedView.classList.add('hidden');
    expandedView.classList.remove('hidden');
  } else {
    collapsedView.classList.remove('hidden');
    expandedView.classList.add('hidden');
    settingsPanel.classList.add('hidden');
  }
}

function flashReset() {
  collapsedView.classList.add('flash-reset');
  setTimeout(() => collapsedView.classList.remove('flash-reset'), 500);
}

function setCaptureActive(active) {
  if (active) {
    captureBtn.classList.add('hidden');
    captureStatus.classList.remove('hidden');
    captureStop.classList.remove('hidden');
  } else {
    captureBtn.classList.remove('hidden');
    captureStatus.classList.add('hidden');
    captureStop.classList.add('hidden');
  }
}

// ── Modifier key tracking ─────────────────────────────────────────────────
function updatePadModifier() {
  cardPadEl.classList.remove('modifier-player', 'modifier-dealer');
  if (heldKeys.has('h')) {
    cardPadEl.classList.add('modifier-player');
  } else if (heldKeys.has('d')) {
    cardPadEl.classList.add('modifier-dealer');
  }
}

// If the window loses focus while H/D is held, clear held state
window.addEventListener('blur', () => {
  heldKeys.clear();
  updatePadModifier();
});

// ── Keyboard ──────────────────────────────────────────────────────────────
document.addEventListener('keydown', async (e) => {
  const key = e.key.toLowerCase();

  // Track H and D as modifier keys — don't treat as card keys
  if (key === 'h' || key === 'd') {
    if (!e.repeat) {   // ignore key-repeat events; Set.add is idempotent but saves DOM work
      heldKeys.add(key);
      updatePadModifier();
    }
    return;
  }

  // Card keys — route based on held modifier
  if (CARD_KEYS.has(key)) {
    const target = heldKeys.has('h') ? 'player'
                 : heldKeys.has('d') ? 'dealer'
                 : undefined;
    const state = await window.api.logCard(key, target);
    renderState(state);
    return;
  }

  // N = new hand (clear hand/dealer, keep count)
  if (key === 'n') {
    const state = await window.api.newHand();
    renderState(state);
    return;
  }

  // Backspace = delete last player card (or dealer card)
  if (key === 'backspace') {
    const state = await window.api.deleteCard();
    renderState(state);
    return;
  }

  // R = reshuffle (full hard reset)
  if (key === 'r') {
    const state = await window.api.reset();
    renderState(state);
    flashReset();
    return;
  }

  if (key === 'escape') {
    await window.api.toggleExpand();
  }
});

document.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'h' || key === 'd') {
    heldKeys.delete(key);
    updatePadModifier();
  }
});

// ── Card pad clicks ───────────────────────────────────────────────────────
cardPadEl.querySelectorAll('.card-pad-btn[data-card]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const card   = btn.dataset.card;
    const target = heldKeys.has('h') ? 'player'
                 : heldKeys.has('d') ? 'dealer'
                 : undefined;
    const state  = await window.api.logCard(card, target);
    renderState(state);
  });
});

deleteBtn.addEventListener('click', async () => {
  const state = await window.api.deleteCard();
  renderState(state);
});

newHandBtn.addEventListener('click', async () => {
  const state = await window.api.newHand();
  renderState(state);
});

reshuffleBtn.addEventListener('click', async () => {
  const state = await window.api.reset();
  renderState(state);
  flashReset();
});

// ── IPC subscriptions ─────────────────────────────────────────────────────
window.api.onStateUpdate((s)   => renderState(s));
window.api.onExpandChange((ex) => setExpanded(ex));
window.api.onReset(()          => flashReset());
window.api.onCaptureStatus((s) => setCaptureActive(s.active));

// ── Buttons ───────────────────────────────────────────────────────────────
collapsedView.addEventListener('click', () => window.api.toggleExpand());

settingsBtn.addEventListener('click', () => {
  settingsPanel.classList.remove('hidden');
  expandedView.classList.add('hidden');
});

settingsClose.addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
  expandedView.classList.remove('hidden');
});

deckButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    const n = parseInt(btn.dataset.decks, 10);
    deckButtons.forEach(b => b.classList.toggle('active', b === btn));
    await window.api.setSetting('totalDecks', n);
    const state = await window.api.setDecks(n);
    renderState(state);
    currentDecks = n;
  });
});

handAdviceToggle.addEventListener('change', async () => {
  showHandAdvice = handAdviceToggle.checked;
  await window.api.setSetting('showHandAdvice', showHandAdvice);
  const state = await window.api.getState();
  renderState(state);
});

opacitySlider.addEventListener('input', async () => {
  const val = parseInt(opacitySlider.value, 10);
  document.documentElement.style.opacity = val / 100;
  await window.api.setSetting('opacity', val);
});

captureBtn.addEventListener('click', async () => {
  const settings = await window.api.getSettings();
  if (settings.captureRegion) {
    await window.api.startCapture();
  } else {
    await window.api.openCaptureSelector();
  }
});

captureStop.addEventListener('click', async () => {
  await window.api.stopCapture();
});

// ── Initialise ────────────────────────────────────────────────────────────
(async () => {
  const [state, settings] = await Promise.all([
    window.api.getState(),
    window.api.getSettings(),
  ]);

  showHandAdvice = settings.showHandAdvice !== false;
  handAdviceToggle.checked = showHandAdvice;
  opacitySlider.value = settings.opacity || 100;
  document.documentElement.style.opacity = (settings.opacity || 100) / 100;
  currentDecks = settings.totalDecks || 6;

  deckButtons.forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.decks, 10) === currentDecks);
  });

  renderState(state);
})();
