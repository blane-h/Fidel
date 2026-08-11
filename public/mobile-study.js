const MobileStudy = (() => {
  const { fetchAlphabet, playCharacterAudio, addGestureUnlock } = MobileCommon;

  const flashcard = document.getElementById('mobileFlashcard');
  const flashcardInner = document.getElementById('mobileFlashcardInner');
  const frontText = document.getElementById('mobileFrontText');
  const backText = document.getElementById('mobileBackText');
  const consonantBoxes = document.getElementById('consonantBoxes');
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

  function renderConsonantBoxes() {
    consonantBoxes.innerHTML = '';
    alphabet.forEach((family, i) => {
      const box = document.createElement('div');
      box.className = 'consonant-box';
      if (!shuffleMode && i === currentConsonantIndex) {
        box.classList.add('active');
      }
      box.textContent = family.latin;
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
    });

    updateConsonantScrollbar();
    requestAnimationFrame(() => scrollToActiveBox(false));
  }

  function updateConsonantScrollbar() {
    const wrapper = document.querySelector('.consonant-scroll-wrapper');
    const thumb = document.getElementById('consonantScrollbarThumb');
    if (!wrapper || !thumb) return;

    const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;
    if (maxScroll <= 0) {
      thumb.style.width = '100%';
      thumb.style.left = '0';
      return;
    }

    const visibleRatio = wrapper.clientWidth / wrapper.scrollWidth;
    const thumbWidth = Math.max(visibleRatio * 100, 10);
    const scrollRatio = wrapper.scrollLeft / maxScroll;
    const thumbLeft = scrollRatio * (100 - thumbWidth);

    thumb.style.width = thumbWidth + '%';
    thumb.style.left = thumbLeft + '%';
  }

  function scrollToActiveBox(behavior = true) {
    const wrapper = document.querySelector('.consonant-scroll-wrapper');
    if (!wrapper) return;

    const activeBox = consonantBoxes.querySelector('.consonant-box.active');
    if (!activeBox) return;

    const wrapperRect = wrapper.getBoundingClientRect();
    const boxRect = activeBox.getBoundingClientRect();
    const targetScroll = wrapper.scrollLeft + (boxRect.left - wrapperRect.left) - (wrapperRect.width - boxRect.width) / 2;
    const clampedScroll = Math.max(0, Math.min(targetScroll, wrapper.scrollWidth - wrapper.clientWidth));

    wrapper.scrollTo({ left: clampedScroll, behavior: behavior ? 'smooth' : 'instant' });
  }

  function setupConsonantScroll() {
    const wrapper = document.querySelector('.consonant-scroll-wrapper');
    const scrollbar = document.getElementById('consonantScrollbar');
    if (!wrapper || !scrollbar) return;

    let prevScrollLeft = 0;

    wrapper.addEventListener('scroll', () => {
      updateConsonantScrollbar();

      const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;
      const currentScroll = wrapper.scrollLeft;

      if (currentScroll >= maxScroll && prevScrollLeft < maxScroll) {
        wrapper.dataset.atEnd = 'true';
      } else if (currentScroll <= 0 && prevScrollLeft > 0) {
        wrapper.dataset.atStart = 'true';
      } else {
        delete wrapper.dataset.atEnd;
        delete wrapper.dataset.atStart;
      }

      prevScrollLeft = currentScroll;
    });

    wrapper.addEventListener('wheel', (e) => {
      const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;
      if (maxScroll <= 0) return;
      const scrollingRight = e.deltaX > 0 || e.deltaY < 0;
      const scrollingLeft = e.deltaX < 0 || e.deltaY > 0;

      if (scrollingRight && wrapper.scrollLeft >= maxScroll - 1) {
        e.preventDefault();
        wrapper.scrollTo({ left: 0, behavior: 'smooth' });
      } else if (scrollingLeft && wrapper.scrollLeft <= 1) {
        e.preventDefault();
        wrapper.scrollTo({ left: maxScroll, behavior: 'smooth' });
      }
    }, { passive: false });

    let touchStartX = 0;
    let touchStartScroll = 0;

    wrapper.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartScroll = wrapper.scrollLeft;
    }, { passive: true });

    wrapper.addEventListener('touchend', () => {
      const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;
      if (wrapper.scrollLeft >= maxScroll - 1 && wrapper.scrollLeft > touchStartScroll) {
        wrapper.scrollTo({ left: 0, behavior: 'smooth' });
      } else if (wrapper.scrollLeft <= 1 && wrapper.scrollLeft < touchStartScroll) {
        wrapper.scrollTo({ left: maxScroll, behavior: 'smooth' });
      }
    });

    scrollbar.addEventListener('click', (e) => {
      const rect = scrollbar.getBoundingClientRect();
      const clickFraction = (e.clientX - rect.left) / rect.width;
      const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;
      wrapper.scrollTo({ left: clickFraction * maxScroll, behavior: 'smooth' });
    });
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
    renderConsonantBoxes();
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
      renderConsonantBoxes();
      updateCard();
    } else {
      currentConsonantIndex = 0;
      currentVowelIndex = 0;
      renderConsonantBoxes();
      updateCard();
    }
  });

  document.getElementById('mobileRestartFamilyBtn').addEventListener('click', () => {
    familyCompleteOverlay.hidden = true;
    familyComplete = false;
    currentVowelIndex = 0;
    renderConsonantBoxes();
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
    renderConsonantBoxes();
    setupConsonantScroll();
    frontText.textContent = '-';
    if (cycleBtn) {
      cycleBtn.click();
    } else {
      cycleCurrentSet();
    }
  }

  init();
})();
