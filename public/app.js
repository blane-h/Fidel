const consonantGrid = document.getElementById('consonantGrid');
const vowelCard = document.getElementById('vowelCard');
const vowelRow = document.getElementById('vowelRow');
const latinPrompt = document.getElementById('latinPrompt');
const translationText = document.getElementById('translationText');
const answerSlots = document.getElementById('answerSlots');
const statusMessage = document.getElementById('statusMessage');
const soundBtn = document.getElementById('soundBtn');
const backspaceBtn = document.getElementById('backspaceBtn');
const enterBtn = document.getElementById('enterBtn');
const newWordBtn = document.getElementById('newWordBtn');
const revealBtn = document.getElementById('revealBtn');

let alphabet = [];
let selectedFamilyIndex = null;
let currentWord = null;
let answer = [];
let cursorPosition = 0;
let currentAudio = null;
let activeConsonantBtn = null;
let showingFidel = false;
let revealMode = false;
let autoAdvanceTimeout = null;
const KEYBOARD_KEY_WIDTH = 55;
const KEYBOARD_KEY_GAP = 4;
const KEYBOARD_KEY_TOTAL = KEYBOARD_KEY_WIDTH + KEYBOARD_KEY_GAP;
const KEYBOARD_ROW_TOP = 0;
const KEYBOARD_ROW_HOME = KEYBOARD_KEY_TOTAL;
const KEYBOARD_ROW_BOTTOM = KEYBOARD_KEY_TOTAL * 2;
const KEYBOARD_KEY_HEIGHT = 55;
const KEYBOARD_ROW_GAP = 10;

const qwertyRows = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', ':'],
];

const fidelByKey = {
  q: { fidel: 'ሀ', latin: 'ha' },
  w: { fidel: 'ለ', latin: 'la' },
  e: { fidel: 'መ', latin: 'ma' },
  r: { fidel: 'ሠ', latin: 'sa' },
  t: { fidel: 'ረ', latin: 'ra' },
  y: { fidel: 'ሰ', latin: 'sa' },
  u: { fidel: 'ሸ', latin: 'sha' },
  i: { fidel: 'ቀ', latin: 'qa' },
  o: { fidel: 'በ', latin: 'ba' },
  p: { fidel: 'ቨ', latin: 'va' },
  '[': { fidel: 'ተ', latin: 'ta' },
  ']': { fidel: 'ቸ', latin: 'cha' },
  '\\': { fidel: 'ኀ', latin: 'xa' },
  a: { fidel: 'ነ', latin: 'na' },
  s: { fidel: 'ኘ', latin: 'nya' },
  d: { fidel: 'አ', latin: 'a' },
  f: { fidel: 'ከ', latin: 'ka' },
  g: { fidel: 'ኸ', latin: 'xa' },
  h: { fidel: 'ወ', latin: 'wa' },
  j: { fidel: 'ዐ', latin: 'a' },
  k: { fidel: 'ዘ', latin: 'za' },
  l: { fidel: 'ዠ', latin: 'za' },
  ';': { fidel: 'የ', latin: 'ya' },
  "'": { fidel: 'ደ', latin: 'da' },
  z: { fidel: 'ጀ', latin: 'ja' },
  x: { fidel: 'ገ', latin: 'ga' },
  c: { fidel: 'ጠ', latin: 'ta' },
  v: { fidel: 'ጨ', latin: 'cha' },
  b: { fidel: 'ጰ', latin: 'pa' },
  n: { fidel: 'ጸ', latin: 'sa' },
  m: { fidel: 'ፀ', latin: 'sa' },
  ',': { fidel: 'ፈ', latin: 'fa' },
  '.': { fidel: 'ፐ', latin: 'pa' },
  '/': { fidel: 'ሐ', latin: 'ha' },
  ':': { fidel: '፡', latin: ':' },
};

function renderSlots() {
  answerSlots.innerHTML = '';
  const length = currentWord?.amharic?.length ?? 0;

  for (let i = 0; i < length; i += 1) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    if (i === cursorPosition) {
      slot.classList.add('cursor');
    }
    slot.textContent = answer[i] || '';
    slot.addEventListener('click', () => {
      cursorPosition = i;
      renderSlots();
    });
    answerSlots.appendChild(slot);
  }
}

function normalizeAmharicChar(char) {
  const map = {
    'ሀ': 'ሀ', 'ሁ': 'ሁ', 'ሂ': 'ሂ', 'ሃ': 'ሃ', 'ሄ': 'ሄ', 'ህ': 'ህ', 'ሆ': 'ሆ',
    'ሐ': 'ሀ', 'ሑ': 'ሁ', 'ሒ': 'ሂ', 'ሓ': 'ሃ', 'ሔ': 'ሄ', 'ሕ': 'ህ', 'ሖ': 'ሆ',
    'ጸ': 'ጸ', 'ጹ': 'ጹ', 'ጺ': 'ጺ', 'ጻ': 'ጻ', 'ጼ': 'ጼ', 'ጽ': 'ጽ', 'ጾ': 'ጾ',
    'ፀ': 'ጸ', 'ፁ': 'ጹ', 'ፂ': 'ጺ', 'ፃ': 'ጻ', 'ፄ': 'ጼ', 'ፅ': 'ጽ', 'ፆ': 'ጾ'
  };
  return map[char] || char;
}

function getAlternateFidelForms(word) {
  const swapPairs = [
    { from: 'ሀ', to: 'ሐ' }, { from: 'ሁ', to: 'ሑ' }, { from: 'ሂ', to: 'ሒ' }, { from: 'ሃ', to: 'ሓ' }, { from: 'ሄ', to: 'ሔ' }, { from: 'ህ', to: 'ሕ' }, { from: 'ሆ', to: 'ሖ' },
    { from: 'ሐ', to: 'ሀ' }, { from: 'ሑ', to: 'ሁ' }, { from: 'ሒ', to: 'ሂ' }, { from: 'ሓ', to: 'ሃ' }, { from: 'ሔ', to: 'ሄ' }, { from: 'ሕ', to: 'ህ' }, { from: 'ሖ', to: 'ሆ' },
    { from: 'ጸ', to: 'ፀ' }, { from: 'ጹ', to: 'ፁ' }, { from: 'ጺ', to: 'ፂ' }, { from: 'ጻ', to: 'ፃ' }, { from: 'ጼ', to: 'ፄ' }, { from: 'ጽ', to: 'ፅ' }, { from: 'ጾ', to: 'ፆ' },
    { from: 'ፀ', to: 'ጸ' }, { from: 'ፁ', to: 'ጹ' }, { from: 'ፂ', to: 'ጺ' }, { from: 'ፃ', to: 'ጻ' }, { from: 'ፄ', to: 'ጼ' }, { from: 'ፅ', to: 'ጽ' }, { from: 'ፆ', to: 'ጾ' }
  ];
  
  const forms = new Set([word]);
  
  for (const pair of swapPairs) {
    const newForms = new Set(forms);
    for (const form of forms) {
      let i = form.indexOf(pair.from);
      while (i !== -1) {
        const swapped = form.slice(0, i) + pair.to + form.slice(i + 1);
        newForms.add(swapped);
        i = form.indexOf(pair.from, i + 1);
      }
    }
    forms.clear();
    for (const f of newForms) forms.add(f);
  }
  
  return Array.from(forms);
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
  const expected = currentWord.amharic;

  if (typed === expected) {
    statusMessage.textContent = 'Correct! Great job.';
    statusMessage.classList.add('success');
    if (autoAdvanceTimeout) clearTimeout(autoAdvanceTimeout);
    autoAdvanceTimeout = setTimeout(() => {
      autoAdvanceTimeout = null;
      loadWord();
      document.querySelectorAll('.consonant-btn').forEach(btn => {
        btn.classList.remove('revealed-green', 'revealed-yellow', 'revealed-red');
      });
      document.querySelectorAll('.vowel-btn').forEach(btn => {
        btn.classList.remove('revealed-correct');
      });
    }, 1200);
    return;
  }

  let isCorrect = true;
  for (let i = 0; i < typed.length; i += 1) {
    if (normalizeAmharicChar(typed[i]) !== normalizeAmharicChar(expected[i])) {
      isCorrect = false;
      break;
    }
  }

  if (isCorrect) {
    statusMessage.textContent = 'Correct! Great job.';
    statusMessage.classList.add('success');
    if (autoAdvanceTimeout) clearTimeout(autoAdvanceTimeout);
    autoAdvanceTimeout = setTimeout(() => {
      autoAdvanceTimeout = null;
      loadWord();
      document.querySelectorAll('.consonant-btn').forEach(btn => {
        btn.classList.remove('revealed-green', 'revealed-yellow', 'revealed-red');
      });
      document.querySelectorAll('.vowel-btn').forEach(btn => {
        btn.classList.remove('revealed-correct');
      });
    }, 1200);
  } else {
    statusMessage.textContent = 'Not quite. Try again.';
    statusMessage.classList.add('error');
  }
}

function addCharacter(char) {
  if (!currentWord || answer.length >= currentWord.amharic.length) {
    return;
  }

  if (cursorPosition < answer.length) {
    answer[cursorPosition] = char;
  } else {
    answer.push(char);
  }
  cursorPosition = Math.min(cursorPosition + 1, answer.length);
  renderSlots();
  evaluateAnswer();
}

function removeCharacter() {
  if (!currentWord || answer.length === 0) {
    return;
  }

  if (cursorPosition > 0 && cursorPosition <= answer.length) {
    answer.splice(cursorPosition - 1, 1);
    cursorPosition = Math.max(0, cursorPosition - 1);
  } else if (cursorPosition === 0 && answer.length > 0) {
    answer.pop();
  }
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

function setActiveConsonantBtn(btn) {
  if (activeConsonantBtn) {
    activeConsonantBtn.classList.remove('active');
  }
  activeConsonantBtn = btn;
  if (btn) {
    btn.classList.add('active');
  }
}

function renderVowels(index) {
  selectedFamilyIndex = index;
  vowelRow.innerHTML = '';

  const family = alphabet[index]?.vowels || [];
  family.forEach((char, vowelIndex) => {
    const btn = document.createElement('button');
    btn.className = 'vowel-btn';
    btn.type = 'button';
    btn.dataset.vowelIndex = vowelIndex;
    btn.innerHTML = `<span class="vowel-char">${char.fidel}</span><span class="vowel-number">${vowelIndex + 1}</span>`;
    btn.addEventListener('click', () => {
      if (revealMode) {
        revealNextVowel();
        addCharacter(char.fidel);
        btn.classList.remove('revealed-correct');
        if (activeConsonantBtn) {
          activeConsonantBtn.classList.remove('revealed-green', 'revealed-yellow', 'revealed-red');
          activeConsonantBtn.classList.remove('active');
          activeConsonantBtn = null;
        }
        advanceToNextStep();
      } else {
        addCharacter(char.fidel);
      }
    });
    vowelRow.appendChild(btn);
  });
}

function renderKeyboardRow(keys, rowTop, rowLeftOffset) {
  const row = document.createElement('div');
  row.className = 'keyboard-row';
  row.style.top = `${rowTop}px`;

  keys.forEach((key, index) => {
    const entry = fidelByKey[key];
    if (!entry) {
      const spacer = document.createElement('div');
      spacer.className = 'key-spacer';
      row.appendChild(spacer);
      return;
    }

    const btn = document.createElement('button');
    btn.className = 'consonant-btn';
    btn.type = 'button';
    btn.dataset.key = key;
    btn.innerHTML = `<span class="fidel-char">${entry.fidel}</span><span class="latin-hint">${key}</span>`;
    btn.style.left = `${rowLeftOffset + index * KEYBOARD_KEY_TOTAL}px`;
    btn.addEventListener('click', () => {
      const idx = alphabet.findIndex((family) => family.consonant === entry.fidel);
      if (idx !== -1) {
        setActiveConsonantBtn(btn);
        if (revealMode) {
          renderVowels(idx);
          handleRevealConsonantClick(entry.fidel);
        } else {
          if (selectedFamilyIndex !== idx) {
            renderVowels(idx);
          }
        }
      } else {
        if (revealMode) {
          handleRevealPunctuationClick(entry.fidel);
        } else {
          addCharacter(entry.fidel);
        }
      }
    });
    row.appendChild(btn);
  });

  return row;
}

function renderConsonants() {
  consonantGrid.innerHTML = '';
  const rowConfigs = [
    { keys: qwertyRows[0], top: KEYBOARD_ROW_TOP, left: KEYBOARD_ROW_TOP },
    { keys: qwertyRows[1], top: KEYBOARD_ROW_TOP + KEYBOARD_KEY_HEIGHT + KEYBOARD_ROW_GAP, left: KEYBOARD_ROW_HOME },
    { keys: qwertyRows[2], top: KEYBOARD_ROW_TOP + (KEYBOARD_KEY_HEIGHT + KEYBOARD_ROW_GAP) * 2, left: KEYBOARD_ROW_HOME },
  ];
  rowConfigs.forEach((config) => {
    consonantGrid.appendChild(renderKeyboardRow(config.keys, config.top, config.left));
  });
}

function fitKeyboard() {
  if (!consonantGrid) return;
  const section = consonantGrid.parentElement;
  if (!section) return;

  const style = getComputedStyle(section);
  const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const availableWidth = section.clientWidth - paddingX;
  const naturalWidth = 770;
  const scale = Math.min(1, availableWidth / naturalWidth);
  consonantGrid.style.transform = `scale(${scale})`;
  consonantGrid.style.transformOrigin = 'top center';
}

async function loadWord() {
  if (autoAdvanceTimeout) {
    clearTimeout(autoAdvanceTimeout);
    autoAdvanceTimeout = null;
  }
  document.querySelectorAll('.consonant-btn').forEach(btn => {
    btn.classList.remove('revealed-green', 'revealed-yellow', 'revealed-red');
  });
  document.querySelectorAll('.vowel-btn').forEach(btn => {
    btn.classList.remove('revealed-correct');
  });
  const response = await fetch('/api/words/random');
  const word = await response.json();
  currentWord = word;
  answer = [];
  cursorPosition = 0;
  translationVisible = false;
  showingFidel = false;
  selectedFamilyIndex = null;
  vowelRow.innerHTML = '';
  setActiveConsonantBtn(null);
  latinPrompt.textContent = word.latin;
  translationText.textContent = word.translation || '';
  translationText.hidden = true;
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

latinPrompt.addEventListener('click', () => {
  if (!currentWord || !currentWord.translation) {
    return;
  }

  translationVisible = !translationVisible;
  translationText.textContent = currentWord.translation;
  translationText.hidden = !translationVisible;
});

fidelToggleBtn.addEventListener('click', () => {
  if (!currentWord) {
    return;
  }

  showingFidel = !showingFidel;
  
  if (showingFidel) {
    latinPrompt.textContent = currentWord.amharic;
  } else {
    latinPrompt.textContent = currentWord.latin;
  }
  
  fidelToggleBtn.setAttribute('aria-pressed', String(showingFidel));
});

async function init() {
  const response = await fetch('/api/alphabet');
  alphabet = await response.json();

  renderConsonants();
  await loadWord();
  fitKeyboard();
}

window.addEventListener('resize', fitKeyboard);
window.addEventListener('load', fitKeyboard);

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

backspaceBtn.addEventListener('click', removeCharacter);

enterBtn.addEventListener('click', submitAnswer);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Backspace') {
    event.preventDefault();
    removeCharacter();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    submitAnswer();
    return;
  }

  const entry = fidelByKey[event.key];
  if (!entry) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      cursorPosition = Math.max(0, cursorPosition - 1);
      renderSlots();
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      cursorPosition = Math.min(answer.length, cursorPosition + 1);
      renderSlots();
      return;
    }
    const vowelIndex = Number(event.key);
    if (Number.isInteger(vowelIndex) && vowelIndex >= 1 && vowelIndex <= 7 && selectedFamilyIndex !== null) {
      const family = alphabet[selectedFamilyIndex]?.vowels || [];
      const char = family[vowelIndex - 1];
      if (char) {
        addCharacter(char.fidel);
      }
      return;
    }
    return;
  }

  if (event.key === 'Shift') return;
  
  const idx = alphabet.findIndex((family) => family.consonant === entry.fidel);
  if (idx !== -1) {
    const btn = consonantGrid.querySelector(`[data-key="${event.key}"]`);
    setActiveConsonantBtn(btn);
    if (!revealMode || selectedFamilyIndex !== idx) {
      renderVowels(idx);
    }
    if (revealMode) {
      handleRevealConsonantClick(entry.fidel);
    }
  } else if (event.key === '/' && event.shiftKey) {
    if (revealMode) {
      handleRevealPunctuationClick('፡');
    }
    addCharacter('፡');
  } else {
    addCharacter(entry.fidel);
  }
});

let revealSequence = [];
let revealIndex = 0;

function highlightNextStep() {
  if (revealSequence.length === 0 || revealIndex >= revealSequence.length) return;
  
  document.querySelectorAll('.consonant-btn').forEach(btn => {
    btn.classList.remove('revealed-green', 'revealed-yellow', 'revealed-red');
  });
  
  const item = revealSequence[revealIndex];
  if (item.type === 'consonant') {
    document.querySelectorAll('.consonant-btn').forEach(b => {
      const fidelChar = b.querySelector('.fidel-char')?.textContent || '';
      if (fidelChar === item.consonant) {
        const colors = ['revealed-green', 'revealed-yellow', 'revealed-red'];
        const colorClass = colors[revealIndex % 3];
        b.classList.add(colorClass);
        b.dataset.revealColor = colorClass;
      }
    });
  } else if (item.type === 'punctuation') {
    document.querySelectorAll('.consonant-btn').forEach(b => {
      const fidelChar = b.querySelector('.fidel-char')?.textContent || '';
      if (fidelChar === item.char) {
        const colors = ['revealed-green', 'revealed-yellow', 'revealed-red'];
        const colorClass = colors[revealIndex % 3];
        b.classList.add(colorClass);
        b.dataset.revealColor = colorClass;
      }
    });
  }
}

function revealAnswer() {
  if (!currentWord || !alphabet.length) return;
  revealMode = true;
  
  const word = currentWord.amharic;
  
  revealSequence = [];
  for (let i = 0; i < word.length; i++) {
    const char = word[i];
    const family = alphabet.find(f => {
      const normalized = normalizeAmharicChar(char);
      return f.vowels.some(v => normalizeAmharicChar(v.fidel) === normalized);
    });
    
    if (family) {
      const vowelIndex = family.vowels.findIndex(v => normalizeAmharicChar(v.fidel) === normalizeAmharicChar(char));
      revealSequence.push({
        type: 'consonant',
        consonant: family.consonant,
        vowelIndex: vowelIndex,
        char
      });
    } else {
      revealSequence.push({
        type: 'punctuation',
        char
      });
    }
  }
  
  revealIndex = 0;
  
  document.querySelectorAll('.consonant-btn').forEach(btn => {
    btn.classList.remove('revealed-green', 'revealed-yellow', 'revealed-red');
  });
  document.querySelectorAll('.vowel-btn').forEach(btn => {
    btn.classList.remove('revealed-correct');
  });
  
  highlightNextStep();
}

function revealNextVowel() {
  if (!revealMode) return;
  if (revealSequence.length === 0 || revealIndex >= revealSequence.length) return;
  
  const item = revealSequence[revealIndex];
  if (item.type !== 'consonant') return;
  
  const vowelBtn = vowelRow.children[item.vowelIndex];
  if (vowelBtn) {
    vowelBtn.classList.add('revealed-correct');
  }
}

function advanceToNextStep() {
  if (!revealMode) return;
  if (revealSequence.length === 0 || revealIndex >= revealSequence.length) return;
  
  revealIndex++;
  if (revealIndex < revealSequence.length) {
    highlightNextStep();
  }
}

function handleRevealConsonantClick(fidel) {
  if (!revealMode || revealSequence.length === 0) return;
  if (revealIndex >= revealSequence.length) return;
  
  const expected = revealSequence[revealIndex];
  
  if (expected.type === 'consonant' && expected.consonant === fidel) {
    revealNextVowel();
  }
}

function handleRevealPunctuationClick(fidel) {
  if (!revealMode || revealSequence.length === 0) return;
  if (revealIndex >= revealSequence.length) return;
  
  const expected = revealSequence[revealIndex];
  
  if (expected.type === 'punctuation' && expected.char === fidel) {
    addCharacter(fidel);
    if (activeConsonantBtn) {
      activeConsonantBtn.classList.remove('revealed-green', 'revealed-yellow', 'revealed-red');
      activeConsonantBtn.classList.remove('active');
      activeConsonantBtn = null;
    }
    advanceToNextStep();
  }
}

newWordBtn.addEventListener('click', () => {
  loadWord();
  if (revealMode) {
    revealMode = false;
    revealBtn.classList.remove('active');
    revealBtn.textContent = 'Reveal';
  }
  document.querySelectorAll('.consonant-btn').forEach(btn => {
    btn.classList.remove('revealed-green', 'revealed-yellow', 'revealed-red');
  });
  document.querySelectorAll('.vowel-btn').forEach(btn => {
    btn.classList.remove('revealed-correct');
  });
});

revealBtn.addEventListener('click', () => {
  if (autoAdvanceTimeout) {
    clearTimeout(autoAdvanceTimeout);
    autoAdvanceTimeout = null;
  }
  revealMode = !revealMode;
  if (revealMode) {
    revealAnswer();
    revealBtn.classList.add('active');
    revealBtn.textContent = 'Hide';
  } else {
    document.querySelectorAll('.consonant-btn').forEach(btn => {
      btn.classList.remove('revealed-green', 'revealed-yellow', 'revealed-red');
    });
    document.querySelectorAll('.vowel-btn').forEach(btn => {
      btn.classList.remove('revealed-correct');
    });
    revealBtn.classList.remove('active');
    revealBtn.textContent = 'Reveal';
  }
});

init().catch(() => {
  statusMessage.textContent = 'Failed to load data.';
  statusMessage.className = 'status error';
});
