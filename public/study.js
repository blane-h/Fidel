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
let frontIsAmharic = true;
let shuffled = false;
let isFlipped = false;

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
  counterDisplay.textContent = (currentConsonantIndex + 1) + ' / ' + alphabet.length;
  flashcardInner.classList.remove('flipped');
  isFlipped = false;
  playSound();
}

function playSound() {
  if (!currentCharacter) return;
  fetch('/api/characters/audio?fidel=' + encodeURIComponent(currentCharacter.fidel))
    .then(res => res.ok ? res.blob() : Promise.reject())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    })
    .catch(() => {});
}

function renderConsonantBoxes() {
  consonantBoxes.innerHTML = '';
  const pageIndex = getCurrentPage();
  const pageSize = getPageSize(pageIndex);
  const start = getPageStart(pageIndex);
  const end = Math.min(start + pageSize, alphabet.length);

  for (let i = start; i < end; i++) {
    const box = document.createElement('div');
    box.className = 'consonant-box';
    if (!shuffled && i === currentConsonantIndex) {
      box.classList.add('active');
    }
    box.textContent = alphabet[i].latin;
    box.addEventListener('click', () => {
      currentConsonantIndex = i;
      currentVowelIndex = 0;
      shuffled = false;
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
  if (!alphabet[currentConsonantIndex]) return;
  const family = alphabet[currentConsonantIndex];
  currentVowelIndex += delta;

  if (currentVowelIndex < 0) {
    currentVowelIndex = family.vowels.length - 1;
    if (currentConsonantIndex > 0) {
      currentConsonantIndex -= 1;
      currentVowelIndex = alphabet[currentConsonantIndex].vowels.length - 1;
    }
  } else if (currentVowelIndex >= family.vowels.length) {
    currentVowelIndex = 0;
    if (currentConsonantIndex < alphabet.length - 1) {
      currentConsonantIndex += 1;
    }
  }

  renderConsonantBoxes();
  updateCard();
}

function cycleCurrentSet() {
  currentVowelIndex = 0;
  updateCard();
}

function shuffleCards() {
  if (!alphabet.length) return;
  const randomConsonant = Math.floor(Math.random() * alphabet.length);
  const randomVowel = Math.floor(Math.random() * alphabet[randomConsonant].vowels.length);
  
  const savedConsonantIndex = currentConsonantIndex;
  const savedVowelIndex = currentVowelIndex;
  
  currentConsonantIndex = randomConsonant;
  currentVowelIndex = randomVowel;
  shuffled = true;
  
  updateCard();
  
  // Restore original position so consonant list doesn't shift
  currentConsonantIndex = savedConsonantIndex;
  currentVowelIndex = savedVowelIndex;
  renderConsonantBoxes();
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

async function loadAlphabet() {
  try {
    const response = await fetch('/api/alphabet');
    const data = await response.json();
    alphabet = data;
    currentConsonantIndex = 0;
    currentVowelIndex = 0;
    renderConsonantBoxes();
    updateCard();
  } catch (_error) {
    frontText.textContent = 'Failed to load alphabet.';
  }
}

loadAlphabet();
