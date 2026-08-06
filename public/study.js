// Study page: flashcard-style review of Amharic characters ordered by the alphabet.

const flashcard = document.getElementById("flashcard");
const flashcardInner = document.getElementById("flashcardInner");
const frontText = document.getElementById("frontText");
const backText = document.getElementById("backText");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const flipSettingsBtn = document.getElementById("flipSettingsBtn");
const counterDisplay = document.getElementById("counterDisplay");
const soundBtn = document.getElementById("soundBtn");

let alphabet = [];
let currentIndex = 0;
let currentCharacter = null;
let frontIsAmharic = true;

function getCurrentCharacter() {
  if (!alphabet.length) return null;
  const family = alphabet[currentIndex];
  return family.vowels[0];
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
  counterDisplay.textContent = (currentIndex + 1) + " / " + alphabet.length;
  flashcardInner.classList.remove("flipped");
}

function goTo(index) {
  if (!alphabet.length) return;
  currentIndex = (index + alphabet.length) % alphabet.length;
  updateCard();
}

function playSound() {
  if (!currentCharacter) return;
  fetch("/api/characters/audio?fidel=" + encodeURIComponent(currentCharacter.fidel))
    .then(res => res.ok ? res.blob() : Promise.reject())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    })
    .catch(() => {});
}

prevBtn.addEventListener("click", () => goTo(currentIndex - 1));
nextBtn.addEventListener("click", () => goTo(currentIndex + 1));
flipSettingsBtn.addEventListener("click", () => {
  frontIsAmharic = !frontIsAmharic;
  updateCard();
});
flashcard.addEventListener("click", () => {
  flashcardInner.classList.toggle("flipped");
});
soundBtn.addEventListener("click", playSound);

async function loadAlphabet() {
  try {
    const response = await fetch("/api/alphabet");
    const data = await response.json();
    alphabet = data;
    currentIndex = 0;
    updateCard();
  } catch (_error) {
    frontText.textContent = "Failed to load alphabet.";
  }
}

loadAlphabet();