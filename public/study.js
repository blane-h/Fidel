// Study page: flashcard review of Amharic characters ordered by the alphabet.

const flashcard = document.getElementById('flashcard');
const flashcardInner = document.getElementById('flashcardInner');
const frontText = document.getElementById('frontText');
const backText = document.getElementById('backText');
const prevConsonantBtn = document.getElementById('prevConsonantBtn');
const nextConsonantBtn = document.getElementById('nextConsonantBtn');
const backBtn = document.getElementById('backBtn');
const nextBtn = document.getElementById('nextBtn');
const cycleBtn = document.getElementById('cycleBtn');
const flipBtn = document.getElementById('flipBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const soundBtn = document.getElementById('soundBtn');
const counterDisplay = document.getElementById('counterDisplay');
const consonantBoxes = document.getElementById('consonantBoxes');

let alphabet = [];
let currentConsonantIndex = 0;
let currentVowelIndex = 0;
let currentCharacter = null;
let frontIsAmharic = false;
let shuffleMode = false;
let shuffleHistory = [];
let shuffleHistoryIndex = -1;
let shuffleBaseConsonantIndex = 0;
let familyComplete = false;
let isFlipped = false;
let pendingAutoplay = false;
let gestureUnlockAdded = false;

const PAGE_SIZE = 8;
const PAGE_SIZES = [PAGE_SIZE, PAGE_SIZE, 9, 9];
const TOTAL_PAGES = PAGE_SIZES.length;

function getPageSize(pageIndex) {
  return PAGE_SIZES[pageIndex] || PAGE_SIZE;
}

function getCurrentPage() {
  let accumulated = 0;
  for (let i = 0; i < TOTAL_PAGES; i++) {
    accumulated += PAGE_SIZES[i];
    if (currentConsonantIndex < accumulated) {
      return i;
    }
  }
  return TOTAL_PAGES - 1;
}

function getCurrentPageForIndex(consIndex) {
  let accumulated = 0;
  for (let i = 0; i < TOTAL_PAGES; i++) {
    accumulated += PAGE_SIZES[i];
    if (consIndex < accumulated) {
      return i;
    }
  }
  return TOTAL_PAGES - 1;
}

function getPageStart(pageIndex) {
  let start = 0;
  for (let i = 0; i < pageIndex; i++) {
    start += PAGE_SIZES[i];
  }
  return start;
}

function getCurrentCharacter() {
  if (!alphabet.length) return null;
  const family = alphabet[currentConsonantIndex];
  if (!family || !family.vowels[currentVowelIndex]) {
    return null;
  }
  return family.vowels[currentVowelIndex];
}

function updateCard() {
  const char = getCurrentCharacter();
  if (!char) return;
  currentCharacter = char;
  if (frontIsAmharic) {
    frontText.textContent = char.fidel;
    backText.textContent = char.latin;
  } else {
    frontText.textContent = char.latin;
    backText.textContent = char.fidel;
  }
  if (counterDisplay) {
    counterDisplay.textContent = (currentConsonantIndex + 1) + ' / ' + alphabet.length;
  }
  flashcardInner.classList.remove('flipped');
  isFlipped = false;
  playSound();
}

async function playSound() {
  if (!currentCharacter) return;
  try {
    const response = await fetch('/api/characters/audio?fidel=' + encodeURIComponent(currentCharacter.fidel));
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    try {
      await audio.play();
      pendingAutoplay = false;
    } catch (_playError) {
      // Autoplay was blocked (no user gesture yet). Remember to replay on the
      // first user interaction so the initial card's sound is still heard.
      pendingAutoplay = true;
      addGestureUnlock();
    }
  } catch (_error) {
    // ignore
  }
}

function addGestureUnlock() {
  if (gestureUnlockAdded) return;
  gestureUnlockAdded = true;

  const unlock = () => {
    if (!pendingAutoplay) return;
    pendingAutoplay = false;
    playSound();
  };

  const events = ['pointerdown', 'keydown', 'touchstart'];
  events.forEach((eventType) => {
    document.addEventListener(eventType, unlock, { once: true, passive: true });
  });
}

function renderConsonantBoxes() {
  consonantBoxes.innerHTML = '';
  const effectiveIndex = shuffleMode ? shuffleBaseConsonantIndex : currentConsonantIndex;
  const pageIndex = getCurrentPageForIndex(effectiveIndex);
  const pageSize = getPageSize(pageIndex);
  const start = getPageStart(pageIndex);
  const end = Math.min(start + pageSize, alphabet.length);

  for (let i = start; i < end; i++) {
    const box = document.createElement('div');
    box.className = 'consonant-box';
    if (!shuffleMode && i === currentConsonantIndex) {
      box.classList.add('active');
    }
    box.textContent = alphabet[i].latin;
    box.addEventListener('click', () => {
      if (shuffleMode) {
        shuffleMode = false;
        shuffleBtn.classList.remove('active');
        cycleBtn.disabled = false;
        shuffleHistory = [];
        shuffleHistoryIndex = -1;
      }
      currentConsonantIndex = i;
      currentVowelIndex = 0;
      renderConsonantBoxes();
      updateCard();
    });
    consonantBoxes.appendChild(box);
  }

  prevConsonantBtn.disabled = alphabet.length === 0;
  nextConsonantBtn.disabled = alphabet.length === 0;
}

function advanceConsonant(delta) {
  if (!alphabet.length) return;
  if (shuffleMode) {
    if (delta > 0) {
      addShuffledCharacter();
    } else {
      navigateShuffleHistory(delta);
    }
    return;
  }
  currentConsonantIndex += delta;
  if (currentConsonantIndex < 0) {
    currentConsonantIndex = alphabet.length - 1;
  } else if (currentConsonantIndex >= alphabet.length) {
    currentConsonantIndex = 0;
  }
  currentVowelIndex = 0;
  renderConsonantBoxes();
  updateCard();
}

function advanceVowel(delta) {
  if (!alphabet.length) return;
  if (shuffleMode) {
    if (delta > 0) {
      addShuffledCharacter();
    } else {
      navigateShuffleHistory(delta);
    }
    return;
  }
  if (!alphabet[currentConsonantIndex]) return;
  const family = alphabet[currentConsonantIndex];
  currentVowelIndex += delta;

  if (currentVowelIndex < 0) {
    currentVowelIndex = family.vowels.length - 1;
    if (currentConsonantIndex > 0) {
      currentConsonantIndex -= 1;
      currentVowelIndex = alphabet[currentConsonantIndex].vowels.length - 1;
    }
  } else if (currentVowelIndex >= family.vowels.length && delta > 0) {
    showFamilyComplete();
    return;
  }

  renderConsonantBoxes();
  updateCard();
}

function cycleCurrentSet() {
  if (shuffleMode) {
    return;
  }
  currentVowelIndex = 0;
  updateCard();
}

function addShuffledCharacter() {
  const randomConsonant = Math.floor(Math.random() * alphabet.length);
  const randomVowel = Math.floor(Math.random() * alphabet[randomConsonant].vowels.length);

  shuffleHistory = shuffleHistory.slice(0, shuffleHistoryIndex + 1);
  shuffleHistory.push({ consonantIndex: randomConsonant, vowelIndex: randomVowel });
  shuffleHistoryIndex = shuffleHistory.length - 1;

  currentConsonantIndex = randomConsonant;
  currentVowelIndex = randomVowel;
  renderConsonantBoxes();
  updateCard();
}

function navigateShuffleHistory(delta) {
  if (!shuffleMode || shuffleHistory.length === 0) return;

  const newIndex = shuffleHistoryIndex + delta;
  if (newIndex < 0 || newIndex >= shuffleHistory.length) return;

  shuffleHistoryIndex = newIndex;
  const entry = shuffleHistory[shuffleHistoryIndex];
  currentConsonantIndex = entry.consonantIndex;
  currentVowelIndex = entry.vowelIndex;
  renderConsonantBoxes();
  updateCard();
}

function shuffleCards() {
  if (!alphabet.length) return;

  shuffleMode = !shuffleMode;
  shuffleBtn.classList.toggle('active', shuffleMode);
  cycleBtn.disabled = shuffleMode;

  if (shuffleMode) {
    shuffleBaseConsonantIndex = currentConsonantIndex;
    shuffleHistory = [];
    shuffleHistoryIndex = -1;
    addShuffledCharacter();
  } else {
    shuffleHistory = [];
    shuffleHistoryIndex = -1;
    currentConsonantIndex = 0;
    currentVowelIndex = 0;
    renderConsonantBoxes();
    updateCard();
  }
}

prevConsonantBtn.addEventListener('click', () => advanceConsonant(-1));
nextConsonantBtn.addEventListener('click', () => advanceConsonant(1));
backBtn.addEventListener('click', () => advanceVowel(-1));
nextBtn.addEventListener('click', () => advanceVowel(1));
cycleBtn.addEventListener('click', cycleCurrentSet);
shuffleBtn.addEventListener('click', shuffleCards);

flashcard.addEventListener('click', () => {
  isFlipped = !isFlipped;
  flashcardInner.classList.toggle('flipped', isFlipped);
});

flipBtn.addEventListener('click', () => {
  isFlipped = !isFlipped;
  flashcardInner.classList.toggle('flipped', isFlipped);
});

soundBtn.addEventListener('click', playSound);

function showFamilyComplete() {
  familyComplete = true;
  const family = alphabet[currentConsonantIndex];
  document.getElementById('familyCompleteMessage').innerHTML =
    'You finished the <strong>' + family.latin + '</strong> family!<br>Use the <strong>cycle</strong> icon to restart this family, or the <strong>next arrow</strong> to continue.';
  document.getElementById('familyCompleteOverlay').hidden = false;
}

document.getElementById('nextFamilyBtn').addEventListener('click', () => {
  document.getElementById('familyCompleteOverlay').hidden = true;
  familyComplete = false;

  if (currentConsonantIndex < alphabet.length - 1) {
    currentConsonantIndex += 1;
    currentVowelIndex = 0;
    renderConsonantBoxes();
    updateCard();
  } else {
    currentConsonantIndex = 0;
    currentVowelIndex = 0;
    renderConsonantBoxes();
    updateCard();
  }
});

document.getElementById('restartFamilyBtn').addEventListener('click', () => {
  document.getElementById('familyCompleteOverlay').hidden = true;
  familyComplete = false;
  currentVowelIndex = 0;
  renderConsonantBoxes();
  updateCard();
});

async function loadAlphabet() {
  try {
    const response = await fetch('/api/alphabet');
    if (!response.ok) return;
    const data = await response.json();
    alphabet = data;
  } catch (_error) {
    // silently ignore load errors
  }
}

async function init() {
  await loadAlphabet();
  currentConsonantIndex = 0;
  currentVowelIndex = 0;
  renderConsonantBoxes();
  frontText.textContent = '-';
  // Trigger the cycle button on first load so the initial character's sound
  // is played (the autoplay recovery in playSound replays it if the browser
  // blocks audio before the first user gesture).
  const cycle = document.getElementById('cycleBtn');
  if (cycle) {
    cycle.click();
  } else {
    cycleCurrentSet();
  }
}

init();
