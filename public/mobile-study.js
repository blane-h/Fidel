const MobileStudy = (() => {
  const { fetchAlphabet, playCharacterAudio, openNav, closeNav, initMobileNav } = MobileCommon;

  const flashcard = document.getElementById('mobileFlashcard');
  const flashcardInner = document.getElementById('mobileFlashcardInner');
  const frontText = document.getElementById('mobileFrontText');
  const backText = document.getElementById('mobileBackText');
  const consonantChips = document.getElementById('mobileConsonantChips');
  const cycleBtn = document.getElementById('mobileCycleBtn');
  const flipBtn = document.getElementById('mobileFlipBtn');
  const soundBtn = document.getElementById('mobileSoundBtn');
  const shuffleBtn = document.getElementById('mobileShuffleBtn');
  const prevVowelBtn = document.getElementById('mobilePrevVowelBtn');
  const nextVowelBtn = document.getElementById('mobileNextVowelBtn');
  const familyCompleteOverlay = document.getElementById('mobileFamilyCompleteOverlay');

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

  function getCurrentCharacter() {
    if (!alphabet.length) return null;
    const family = alphabet[currentConsonantIndex];
    if (!family || !family.vowels[currentVowelIndex]) return null;
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
    flashcardInner.classList.remove('flipped');
    isFlipped = false;
    playCurrentSound();
  }

  async function playCurrentSound() {
    if (!currentCharacter) return;
    const url = await playCharacterAudio(currentCharacter.fidel);
    if (!url) return;
    const audio = new Audio(url);
    audio.addEventListener('ended', () => {
      URL.revokeObjectURL(url);
    }, { once: true });
    try {
      await audio.play();
      pendingAutoplay = false;
    } catch (_playError) {
      pendingAutoplay = true;
      addGestureUnlock(() => playCurrentSound());
    }
  }

  function addGestureUnlock(callback) {
    if (gestureUnlockAdded) return;
    gestureUnlockAdded = true;
    const unlock = () => {
      if (!pendingAutoplay) return;
      pendingAutoplay = false;
      gestureUnlockAdded = false;
      callback();
    };
    const events = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((eventType) => {
      document.addEventListener(eventType, unlock, { once: true, passive: true });
    });
  }

  function renderConsonantChips() {
    consonantChips.innerHTML = '';
    const effectiveIndex = shuffleMode ? shuffleBaseConsonantIndex : currentConsonantIndex;
    alphabet.forEach((family, i) => {
      const chip = document.createElement('button');
      chip.className = 'mobile-chip';
      chip.type = 'button';
      if (!shuffleMode && i === effectiveIndex) {
        chip.classList.add('active');
      }
      chip.textContent = family.latin;
      chip.addEventListener('click', () => {
        if (shuffleMode) {
          shuffleMode = false;
          shuffleBtn.classList.remove('active');
          cycleBtn.disabled = false;
          shuffleHistory = [];
          shuffleHistoryIndex = -1;
        }
        currentConsonantIndex = i;
        currentVowelIndex = 0;
        renderConsonantChips();
        updateCard();
      });
      consonantChips.appendChild(chip);
    });
    consonantChips.scrollLeft = consonantChips.scrollWidth;
  }

  function advanceConsonant(delta) {
    if (!alphabet.length) return;
    if (shuffleMode) {
      if (delta > 0) addShuffledCharacter();
      else navigateShuffleHistory(delta);
      return;
    }
    currentConsonantIndex += delta;
    if (currentConsonantIndex < 0) currentConsonantIndex = alphabet.length - 1;
    else if (currentConsonantIndex >= alphabet.length) currentConsonantIndex = 0;
    currentVowelIndex = 0;
    renderConsonantChips();
    updateCard();
  }

  function advanceVowel(delta) {
    if (!alphabet.length) return;
    if (shuffleMode) {
      if (delta > 0) addShuffledCharacter();
      else navigateShuffleHistory(delta);
      return;
    }
    const family = alphabet[currentConsonantIndex];
    const nextIndex = currentVowelIndex + delta;
    if (nextIndex < 0) return;
    currentVowelIndex = nextIndex;
    if (currentVowelIndex >= family.vowels.length && delta > 0) {
      showFamilyComplete();
      return;
    }
    updateCard();
  }

  function cycleCurrentSet() {
    if (shuffleMode) return;
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
    renderConsonantChips();
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
    renderConsonantChips();
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
      renderConsonantChips();
      updateCard();
    }
  }

  cycleBtn.addEventListener('click', cycleCurrentSet);
  shuffleBtn.addEventListener('click', shuffleCards);
  flipBtn.addEventListener('click', () => {
    frontIsAmharic = !frontIsAmharic;
    updateCard();
  });

  flashcard.addEventListener('click', () => {
    isFlipped = !isFlipped;
    flashcardInner.classList.toggle('flipped', isFlipped);
  });

  soundBtn.addEventListener('click', playCurrentSound);
  prevVowelBtn.addEventListener('click', () => advanceVowel(-1));
  nextVowelBtn.addEventListener('click', () => advanceVowel(1));

  function showFamilyComplete() {
    familyComplete = true;
    const family = alphabet[currentConsonantIndex];
    const messageEl = document.getElementById('mobileFamilyCompleteMessage');
    if (messageEl) {
      messageEl.textContent = '';
      const prefix = document.createTextNode('You finished the ');
      const strong = document.createElement('strong');
      strong.textContent = family.latin;
      const suffix = document.createTextNode(' family! Use the cycle icon to restart this family, or the next arrow to continue.');
      messageEl.appendChild(prefix);
      messageEl.appendChild(strong);
      messageEl.appendChild(suffix);
    }
    familyCompleteOverlay.hidden = false;
  }

  document.getElementById('mobileNextFamilyBtn').addEventListener('click', () => {
    familyCompleteOverlay.hidden = true;
    familyComplete = false;
    if (currentConsonantIndex < alphabet.length - 1) {
      currentConsonantIndex += 1;
      currentVowelIndex = 0;
      renderConsonantChips();
      updateCard();
    } else {
      currentConsonantIndex = 0;
      currentVowelIndex = 0;
      renderConsonantChips();
      updateCard();
    }
  });

  document.getElementById('mobileRestartFamilyBtn').addEventListener('click', () => {
    familyCompleteOverlay.hidden = true;
    familyComplete = false;
    currentVowelIndex = 0;
    renderConsonantChips();
    updateCard();
  });

  document.getElementById('mobileCloseFamilyCompleteBtn').addEventListener('click', () => {
    familyCompleteOverlay.hidden = true;
    familyComplete = false;
  });

  async function init() {
    alphabet = await fetchAlphabet();
    currentConsonantIndex = 0;
    currentVowelIndex = 0;
    renderConsonantChips();
    frontText.textContent = '-';
    if (cycleBtn) {
      cycleBtn.click();
    } else {
      cycleCurrentSet();
    }
  }

  init();
})();
