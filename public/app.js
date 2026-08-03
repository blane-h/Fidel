const consonantGrid = document.getElementById('consonantGrid');
const vowelCard = document.getElementById('vowelCard');
const vowelRow = document.getElementById('vowelRow');
const latinPrompt = document.getElementById('latinPrompt');
const answerSlots = document.getElementById('answerSlots');
const statusMessage = document.getElementById('statusMessage');
const soundBtn = document.getElementById('soundBtn');
const clearBtn = document.getElementById('clearBtn');
const newWordBtn = document.getElementById('newWordBtn');

let alphabet = [];
let selectedFamilyIndex = null;
let currentWord = null;
let answer = [];

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
  latinPrompt.textContent = word.latin;
  statusMessage.textContent = '';
  statusMessage.className = 'status';
  renderSlots();
}

async function init() {
  const response = await fetch('/api/alphabet');
  alphabet = await response.json();

  renderConsonants();
  await loadWord();
}

soundBtn.addEventListener('click', () => {
  if (!currentWord?.amharic || !window.speechSynthesis) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(currentWord.amharic);
  utterance.lang = 'am-ET';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
});

clearBtn.addEventListener('click', () => {
  answer = [];
  renderSlots();
  statusMessage.textContent = '';
  statusMessage.className = 'status';
});

newWordBtn.addEventListener('click', loadWord);

init().catch(() => {
  statusMessage.textContent = 'Failed to load data.';
  statusMessage.className = 'status error';
});
