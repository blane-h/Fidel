const MobileSpell = (() => {
  const qwertyRows = MobileCommon.qwertyRows;
  const fidelByKey = MobileCommon.fidelByKey;
  const { normalizeAmharicChar, getAlternateFidelForms, fetchAlphabet, fetchRandomWord, playWordAudio, openNav, closeNav, initMobileNav } = MobileCommon;

  initMobileNav('mobileNavDrawer', 'mobileNavClose', '.mobile-nav-link', 'mobileHamburger');

  const consonantGrid = document.getElementById('mobileConsonantGrid');
  const vowelRow = document.getElementById('mobileVowelRow');
  const latinPrompt = document.getElementById('mobileLatinPrompt');
  const translationText = document.getElementById('mobileTranslationText');
  const answerRows = document.getElementById('mobileAnswerRows');
  const statusMessage = document.getElementById('mobileStatusMessage');
  const soundBtn = document.getElementById('mobileSoundBtn');
  const backspaceBtn = document.getElementById('mobileBackspaceBtn');
  const enterBtn = document.getElementById('mobileEnterBtn');
  const newWordBtn = document.getElementById('mobileNewWordBtn');
  const revealBtn = document.getElementById('mobileRevealBtn');
  const fidelToggleBtn = document.getElementById('mobileFidelToggleBtn');

  let alphabet = [];
  let selectedFamilyIndex = null;
  let currentWord = null;
  let answer = [];
  let cursorPosition = 0;
  let currentAudio = null;
  let activeConsonantBtn = null;
  let showingFidel = false;
  let revealMode = false;
  let translationVisible = false;
  let autoAdvanceTimeout = null;

  function renderAnswer() {
    answerRows.innerHTML = '';
    const length = currentWord?.amharic?.length ?? 0;
    if (length === 0) {
      const row = document.createElement('div');
      row.className = 'mobile-answer-line';
      row.style.opacity = '0.4';
      row.textContent = '...';
      answerRows.appendChild(row);
      return;
    }

    for (let i = 0; i < length; i += 1) {
      const row = document.createElement('div');
      row.className = 'mobile-answer-line';
      row.dataset.index = i;
      if (i === 0) {
        row.style.borderTop = '2px solid #545454';
      }
      row.addEventListener('click', () => {
        cursorPosition = i;
        renderAnswer();
      });
      answerRows.appendChild(row);
    }
    updateAnswerDisplay();
  }

  function updateAnswerDisplay() {
    const rows = answerRows.querySelectorAll('.mobile-answer-line');
    rows.forEach((row, i) => {
      row.textContent = answer[i] || '';
      row.classList.toggle('cursor', i === cursorPosition);
      const cursor = row.querySelector('.cursor');
      if (cursor) cursor.remove();
      if (i === cursorPosition && !answer[i]) {
        const cursorEl = document.createElement('span');
        cursorEl.className = 'cursor';
        row.appendChild(cursorEl);
      }
    });
  }

  function evaluateAnswer() {
    if (!currentWord) return;
    statusMessage.className = 'mobile-status';

    if (answer.length < currentWord.amharic.length) {
      statusMessage.textContent = '';
      return;
    }

    const typed = answer.join('');
    const expected = currentWord.amharic;

    if (typed === expected) {
      statusMessage.textContent = 'Correct! Great job.';
      statusMessage.className = 'mobile-status success';
      if (autoAdvanceTimeout) clearTimeout(autoAdvanceTimeout);
      autoAdvanceTimeout = setTimeout(() => {
        autoAdvanceTimeout = null;
        loadWord();
        clearRevealClasses();
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
      statusMessage.className = 'mobile-status success';
      if (autoAdvanceTimeout) clearTimeout(autoAdvanceTimeout);
      autoAdvanceTimeout = setTimeout(() => {
        autoAdvanceTimeout = null;
        loadWord();
        clearRevealClasses();
      }, 1200);
    } else {
      statusMessage.textContent = 'Not quite. Try again.';
      statusMessage.className = 'mobile-status error';
    }
  }

  function addCharacter(char) {
    if (!currentWord || answer.length >= currentWord.amharic.length) return;
    if (cursorPosition < answer.length) {
      answer[cursorPosition] = char;
    } else {
      answer.push(char);
    }
    cursorPosition = Math.min(cursorPosition + 1, answer.length);
    updateAnswerDisplay();
    evaluateAnswer();
  }

  function removeCharacter() {
    if (!currentWord || answer.length === 0) return;
    if (cursorPosition > 0 && cursorPosition <= answer.length) {
      answer.splice(cursorPosition - 1, 1);
      cursorPosition = Math.max(0, cursorPosition - 1);
    } else if (cursorPosition === 0 && answer.length > 0) {
      answer.pop();
    }
    updateAnswerDisplay();
    statusMessage.textContent = '';
    statusMessage.className = 'mobile-status';
  }

  function submitAnswer() {
    if (!currentWord) return;
    if (answer.length < currentWord.amharic.length) {
      statusMessage.textContent = 'Keep going.';
      statusMessage.className = 'mobile-status';
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

  function renderConsonants() {
    consonantGrid.innerHTML = '';
    const rows = [
      ['ሀ', 'ለ', 'ሐ', 'መ', 'ሠ', 'ረ', 'ሰ', 'ሸ'],
      ['ቀ', 'በ', 'ቨ', 'ተ', 'ቸ', 'ኀ', 'ነ', 'ኘ'],
      ['አ', 'ከ', 'ኸ', 'ወ', 'ዐ', 'ዘ', 'ዠ', 'የ'],
      ['ደ', 'ጀ', 'ገ', 'ጠ', 'ጨ', 'ጰ', 'ጸ', 'ፀ'],
      ['ፈ', 'ፐ']
    ];
    rows.forEach((rowChars) => {
      const row = document.createElement('div');
      row.className = 'mobile-key-row';
      rowChars.forEach((fidel) => {
        const entry = fidelByKey[Object.keys(fidelByKey).find(k => fidelByKey[k].fidel === fidel)] || { latin: '' };
        const btn = document.createElement('button');
        btn.className = 'mobile-key-btn';
        btn.type = 'button';
        btn.dataset.fidel = fidel;
        btn.textContent = fidel;
        btn.addEventListener('click', () => {
          const idx = alphabet.findIndex((family) => family.consonant === fidel);
          if (idx !== -1) {
            setActiveConsonantBtn(btn);
            if (revealMode) {
              renderVowels(idx);
              handleRevealConsonantClick(fidel);
            } else {
              if (selectedFamilyIndex !== idx) {
                renderVowels(idx);
              }
            }
          } else {
            if (revealMode) {
              handleRevealPunctuationClick(fidel);
            } else {
              addCharacter(fidel);
            }
          }
        });
        row.appendChild(btn);
      });
      consonantGrid.appendChild(row);
    });
  }

  function renderVowels(index) {
    selectedFamilyIndex = index;
    vowelRow.innerHTML = '';

    const family = alphabet[index]?.vowels || [];
    family.forEach((char, vowelIndex) => {
      const btn = document.createElement('button');
      btn.className = 'mobile-key-btn';
      btn.type = 'button';
      btn.dataset.vowelIndex = vowelIndex;
      btn.textContent = char.fidel;
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

  async function loadWord() {
    if (autoAdvanceTimeout) {
      clearTimeout(autoAdvanceTimeout);
      autoAdvanceTimeout = null;
    }
    clearRevealClasses();
    try {
      const word = await fetchRandomWord();
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
      statusMessage.className = 'mobile-status';
      renderAnswer();

      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio.src = '';
        currentAudio.load();
      }
      currentAudio = null;
      if (word?.id) {
        const blob = await playWordAudio(word.id);
        if (blob) {
          currentAudio = new Audio(blob);
          currentAudio.addEventListener('ended', () => {
            URL.revokeObjectURL(blob);
          }, { once: true });
          currentAudio.play().catch(() => {});
        }
      }
    } catch (error) {
      statusMessage.textContent = error.message || 'Failed to load word.';
      statusMessage.className = 'mobile-status error';
    }
  }

  latinPrompt.addEventListener('click', () => {
    if (!currentWord) return;
    showingFidel = !showingFidel;
    latinPrompt.textContent = showingFidel ? currentWord.amharic : currentWord.latin;
  });

  fidelToggleBtn.addEventListener('click', () => {
    if (!currentWord || !currentWord.translation) return;
    translationVisible = !translationVisible;
    translationText.hidden = !translationVisible;
  });

  soundBtn.addEventListener('click', async () => {
    if (!currentWord?.id) return;
    try {
      const blob = await playWordAudio(currentWord.id);
      if (blob) {
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
          currentAudio.src = '';
        }
        currentAudio = new Audio(blob);
        currentAudio.play().catch(() => {});
      }
    } catch (_error) {
      // ignore
    }
  });

  backspaceBtn.addEventListener('click', removeCharacter);
  enterBtn.addEventListener('click', submitAnswer);

  newWordBtn.addEventListener('click', () => {
    loadWord();
    if (revealMode) {
      revealMode = false;
      revealBtn.classList.remove('active');
      revealBtn.textContent = 'Reveal';
    }
    clearRevealClasses();
  });

  function clearRevealClasses() {
    consonantGrid.querySelectorAll('.mobile-key-btn').forEach((btn) => {
      btn.classList.remove('revealed-green', 'revealed-yellow', 'revealed-red');
    });
    vowelRow.querySelectorAll('.mobile-key-btn').forEach((btn) => {
      btn.classList.remove('revealed-correct');
    });
  }

  let revealSequence = [];
  let revealIndex = 0;

  function highlightNextStep() {
    if (revealSequence.length === 0 || revealIndex >= revealSequence.length) return;
    clearRevealClasses();
    const item = revealSequence[revealIndex];
    if (item.type === 'consonant') {
      consonantGrid.querySelectorAll('.mobile-key-btn').forEach((b) => {
        if (b.dataset.fidel === item.consonant) {
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
      const family = alphabet.find((f) => {
        const normalized = normalizeAmharicChar(char);
        return f.vowels.some((v) => normalizeAmharicChar(v.fidel) === normalized);
      });
      if (family) {
        const vowelIndex = family.vowels.findIndex((v) => normalizeAmharicChar(v.fidel) === normalizeAmharicChar(char));
        revealSequence.push({ type: 'consonant', consonant: family.consonant, vowelIndex, char });
      } else {
        revealSequence.push({ type: 'punctuation', char });
      }
    }
    revealIndex = 0;
    clearRevealClasses();
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
      clearRevealClasses();
      revealBtn.classList.remove('active');
      revealBtn.textContent = 'Reveal';
    }
  });

  async function init() {
    alphabet = await fetchAlphabet();
    renderConsonants();
    await loadWord();
  }

  init().catch(() => {
    statusMessage.textContent = 'Failed to load data.';
    statusMessage.className = 'mobile-status error';
  });
})();
