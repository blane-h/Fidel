const consonantGrid = document.getElementById('consonantGrid');
const vowelCard = document.getElementById('vowelCard');
const vowelRow = document.getElementById('vowelRow');
const latinPrompt = document.getElementById('latinPrompt');
const translationText = document.getElementById('translationText');
const answerSlots = document.getElementById('answerSlots');
const statusMessage = document.getElementById('statusMessage');
const translateBtn = document.getElementById('translateBtn');
const soundBtn = document.getElementById('soundBtn');
const backspaceBtn = document.getElementById('backspaceBtn');
const enterBtn = document.getElementById('enterBtn');
const clearBtn = document.getElementById('clearBtn');
const newWordBtn = document.getElementById('newWordBtn');

let alphabet = [];
let selectedFamilyIndex = null;
let currentWord = null;
let answer = [];
let currentAudio = null;
let translationVisible = false;

function renderSlots() {
  answerSlots.innerHTML = '';
  const length = currentWord?.amharic?.length ?? 0;

  for (let i = 0; i < length; i += 1) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.textContent = answer[i] || '';
    answerSlots.appendChild(slot);
  }
}

function evaluateAnswer() {
  if (!currentWord) {
    return;
  }

  statusMessage.className = 'status';

  if (answer.length < currentWord.amharic.length) {
    statusMessage.textContent = '';
    return;
  }

  const typed = answer.join('');
  if (typed === currentWord.amharic) {
    statusMessage.textContent = 'Correct! Great job.';
    statusMessage.classList.add('success');
  } else {
    statusMessage.textContent = 'Not quite. Try again.';
    statusMessage.classList.add('error');
  }
}

function addCharacter(char) {
  if (!currentWord || answer.length >= currentWord.amharic.length) {
    return;
  }

  answer.push(char);
  renderSlots();
  evaluateAnswer();
}

function removeCharacter() {
  if (!currentWord || answer.length === 0) {
    return;
  }

  answer.pop();
  renderSlots();
  statusMessage.textContent = '';
  statusMessage.className = 'status';
}

function submitAnswer() {
  if (!currentWord) {
    return;
  }

  if (answer.length < currentWord.amharic.length) {
    statusMessage.textContent = 'Keep going.';
    statusMessage.className = 'status';
    return;
  }

  evaluateAnswer();
}

function renderVowels(index) {
  selectedFamilyIndex = index;
  vowelRow.innerHTML = '';

  const family = alphabet[index]?.vowels || [];
  family.forEach((char) => {
    const btn = document.createElement('button');
    btn.className = 'vowel-btn';
    btn.type = 'button';
    btn.textContent = char;
    btn.addEventListener('click', () => addCharacter(char));
    vowelRow.appendChild(btn);
  });

  document.querySelectorAll('.consonant-btn').forEach((btn, idx) => {
    btn.classList.toggle('active', idx === index);
  });

  vowelCard.hidden = false;
}

function renderConsonants() {
  consonantGrid.innerHTML = '';

  alphabet.forEach((family, index) => {
    const btn = document.createElement('button');
    btn.className = 'consonant-btn';
    btn.type = 'button';
    btn.textContent = family.consonant;
    btn.addEventListener('click', () => renderVowels(index));
    consonantGrid.appendChild(btn);
  });
}

async function loadWord() {
  const response = await fetch('/api/words/random');
  const word = await response.json();
  currentWord = word;
  answer = [];
  translationVisible = false;
  latinPrompt.textContent = word.latin;
  translationText.textContent = word.translation || '';
  translationText.hidden = true;
  translateBtn.setAttribute('aria-pressed', 'false');
  statusMessage.textContent = '';
  statusMessage.className = 'status';
  renderSlots();

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.src = '';
    currentAudio.load();
  }

  currentAudio = null;

  if (word?.id) {
    currentAudio = new Audio(`/api/words/${word.id}/audio`);
    currentAudio.preload = 'auto';
    currentAudio.load();
  }
}

translateBtn.addEventListener('click', () => {
  if (!currentWord || !currentWord.translation) {
    return;
  }

  translationVisible = !translationVisible;
  translationText.hidden = !translationVisible;
  translateBtn.setAttribute('aria-pressed', String(translationVisible));
});

async function init() {
  const response = await fetch('/api/alphabet');
  alphabet = await response.json();

  renderConsonants();
  await loadWord();
}

soundBtn.addEventListener('click', async () => {
  if (!currentWord?.id) {
    return;
  }

  try {
    if (currentAudio) {
      currentAudio.currentTime = 0;
      await currentAudio.play();
      return;
    }
  } catch (_error) {
    if (window.speechSynthesis && currentWord?.amharic) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentWord.amharic);
      utterance.lang = 'am-ET';
      window.speechSynthesis.speak(utterance);
    }
  }
});

clearBtn.addEventListener('click', () => {
  answer = [];
  renderSlots();
  statusMessage.textContent = '';
  statusMessage.className = 'status';
});

backspaceBtn.addEventListener('click', removeCharacter);

enterBtn.addEventListener('click', submitAnswer);

newWordBtn.addEventListener('click', loadWord);

init().catch(() => {
  statusMessage.textContent = 'Failed to load data.';
  statusMessage.className = 'status error';
});
