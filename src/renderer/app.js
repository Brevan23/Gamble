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
const resetBtn          = document.getElementById('reset-btn');
const deckButtons       = document.querySelectorAll('.deck-btn');
const handAdviceToggle  = document.getElementById('hand-advice-toggle');
const opacitySlider     = document.getElementById('opacity-slider');
const captureBtn    = document.getElementById('capture-btn');
const captureStatus = document.getElementById('capture-status');
const captureStop   = document.getElementById('capture-stop');
const handModeRow   = document.getElementById('hand-mode-row');
const handModeLabel = document.getElementById('hand-mode-label');
const strategyBlock = document.getElementById('strategy-block');
const strategyText  = document.getElementById('strategy-text');

// ── State ─────────────────────────────────────────────────────────────────
let expanded        = false;
let showHandAdvice  = true;
let currentDecks    = 6;

// Hand mode state
let handMode       = false;
let handPrefix     = 'hard';   // 'hard' | 'soft' | 'pair'
let playerDigits   = [];       // digit strings building the total
let playerPairCard = null;     // card value string for pair mode
let hdDealerCard   = null;     // dealer upcard for strategy lookup

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

  // Hand advice
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

// ── Card keys ─────────────────────────────────────────────────────────────
const CARD_KEYS = new Set(['2','3','4','5','6','7','8','9','t','j','q','k','a']);

function enterHandMode() {
  handMode       = true;
  handPrefix     = 'hard';
  playerDigits   = [];
  playerPairCard = null;
  hdDealerCard   = null;
  handModeRow.classList.remove('hidden');
  strategyBlock.classList.add('hidden');
  renderHandMode();
}

function exitHandMode() {
  handMode       = false;
  handPrefix     = 'hard';
  playerDigits   = [];
  playerPairCard = null;
  hdDealerCard   = null;
  handModeRow.classList.add('hidden');
  strategyBlock.classList.add('hidden');
}

function renderHandMode() {
  // Build player display string
  let playerDisplay = '';
  if (handPrefix === 'soft')      playerDisplay = 'soft ';
  else if (handPrefix === 'pair') playerDisplay = 'pair ';

  if (handPrefix === 'pair' && playerPairCard) {
    playerDisplay += playerPairCard.toUpperCase() + 's';
  } else if (playerDigits.length > 0) {
    playerDisplay += playerDigits.join('');
  } else {
    playerDisplay += '—';
  }

  const dealerDisplay = hdDealerCard ? hdDealerCard.toUpperCase() : '—';
  handModeLabel.textContent = `H: ${playerDisplay} · D: ${dealerDisplay}`;

  // Determine if we have enough info for a lookup
  const playerTotal = handPrefix !== 'pair'
    ? (playerDigits.length > 0 ? parseInt(playerDigits.join(''), 10) : null)
    : null;
  const hasPair  = handPrefix === 'pair' && playerPairCard !== null;
  const hasTotal = hasPair || (playerTotal !== null && playerTotal >= 4);

  if (!hasTotal || !hdDealerCard) {
    strategyBlock.classList.add('hidden');
    return;
  }

  const advice = window.api.getAdvice({
    total:  playerTotal,
    soft:   handPrefix === 'soft',
    pair:   hasPair ? playerPairCard : false,
    dealer: hdDealerCard,
  });

  if (advice) {
    strategyBlock.style.background   = advice.color + '18';
    strategyBlock.style.border       = `1px solid ${advice.color}44`;
    strategyText.style.color         = advice.color;
    strategyText.textContent         = advice.label;
    strategyBlock.classList.remove('hidden');
  } else {
    strategyBlock.classList.add('hidden');
  }
}

function handleHandModeKey(key) {
  // Toggle / escape exits hand mode
  if (key === 'h' || key === 'escape') { exitHandMode(); return; }

  // Prefix keys — only before any input
  if (key === 's' && playerDigits.length === 0 && !playerPairCard && handPrefix === 'hard') {
    handPrefix = 'soft'; renderHandMode(); return;
  }
  if (key === 'p' && playerDigits.length === 0 && !playerPairCard && handPrefix === 'hard') {
    handPrefix = 'pair'; renderHandMode(); return;
  }

  // Pair mode: next card key sets the pair card value
  if (handPrefix === 'pair' && playerPairCard === null) {
    if (CARD_KEYS.has(key)) {
      playerPairCard = ['j','q','k'].includes(key) ? 't' : key;
      renderHandMode(); return;
    }
    return;
  }

  // Digit entry (hard/soft) — only while dealer not yet set
  if (handPrefix !== 'pair' && hdDealerCard === null && /^\d$/.test(key)) {
    const tentative = parseInt([...playerDigits, key].join(''), 10);
    if (tentative <= 21 && playerDigits.length < 2) {
      playerDigits.push(key);
      renderHandMode();
    }
    return;
  }

  // Dealer card — consumed when player input is ready
  const playerReady = handPrefix === 'pair'
    ? playerPairCard !== null
    : playerDigits.length > 0;

  if (playerReady && CARD_KEYS.has(key)) {
    if (hdDealerCard !== null) {
      // Second dealer card = reset for new hand
      playerDigits   = [];
      playerPairCard = null;
      hdDealerCard   = null;
      handPrefix     = 'hard';
    }
    hdDealerCard = ['j','q','k'].includes(key) ? 't' : key;
    renderHandMode();
  }
}

// ── Keyboard ──────────────────────────────────────────────────────────────
document.addEventListener('keydown', async (e) => {
  const key = e.key.toLowerCase();

  // Hand mode intercepts all keys first
  if (handMode) {
    handleHandModeKey(key);
    return;
  }

  // Toggle hand mode
  if (key === 'h') { enterHandMode(); return; }

  if (CARD_KEYS.has(key)) {
    const state = await window.api.logCard(key);
    renderState(state);
    return;
  }

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

// ── IPC subscriptions ─────────────────────────────────────────────────────
window.api.onStateUpdate((s)  => renderState(s));
window.api.onExpandChange((ex) => setExpanded(ex));
window.api.onReset(()         => flashReset());
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

resetBtn.addEventListener('click', async () => {
  const state = await window.api.reset();
  renderState(state);
  flashReset();
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

  // Apply saved settings
  showHandAdvice = settings.showHandAdvice !== false;
  handAdviceToggle.checked = showHandAdvice;
  opacitySlider.value = settings.opacity || 100;
  document.documentElement.style.opacity = (settings.opacity || 100) / 100;
  currentDecks = settings.totalDecks || 6;

  // Highlight active deck button
  deckButtons.forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.decks, 10) === currentDecks);
  });

  renderState(state);
})();
