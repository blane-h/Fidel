const MobileCommon = (() => {
  const qwertyRows = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm']
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
    a: { fidel: 'ነ', latin: 'na' },
    s: { fidel: 'ኘ', latin: 'nya' },
    d: { fidel: 'አ', latin: 'a' },
    f: { fidel: 'ከ', latin: 'ka' },
    g: { fidel: 'ኸ', latin: 'xa' },
    h: { fidel: 'ወ', latin: 'wa' },
    j: { fidel: 'ዐ', latin: 'a' },
    k: { fidel: 'ዘ', latin: 'za' },
    l: { fidel: 'ዠ', latin: 'za' },
    z: { fidel: 'ጀ', latin: 'ja' },
    x: { fidel: 'ገ', latin: 'ga' },
    c: { fidel: 'ጠ', latin: 'ta' },
    v: { fidel: 'ጨ', latin: 'cha' },
    b: { fidel: 'ጰ', latin: 'pa' },
    n: { fidel: 'ጸ', latin: 'sa' },
    m: { fidel: 'ፀ', latin: 'sa' },
  };

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

  async function fetchAlphabet() {
    const response = await fetch('/api/alphabet');
    if (!response.ok) throw new Error('Failed to load alphabet');
    return response.json();
  }

  async function fetchRandomWord() {
    const response = await fetch('/api/words/random');
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data?.error || 'Failed to load word.');
    }
    return response.json();
  }

  async function playCharacterAudio(fidel) {
    const response = await fetch('/api/characters/audio?fidel=' + encodeURIComponent(fidel));
    if (!response.ok) return null;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  async function playWordAudio(wordId) {
    const response = await fetch('/api/words/' + wordId + '/audio');
    if (!response.ok) return null;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  let pendingAutoplay = false;
  let gestureUnlockAdded = false;

  function addGestureUnlock(callback) {
    if (gestureUnlockAdded) return;
    gestureUnlockAdded = true;
    const unlock = () => {
      pendingAutoplay = false;
      gestureUnlockAdded = false;
      callback();
    };
    const events = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((eventType) => {
      document.addEventListener(eventType, unlock, { once: true, passive: true });
    });
  }

  async function safePlay(url, onBlocked) {
    const audio = new Audio(url);
    try {
      await audio.play();
      return audio;
    } catch (_playError) {
      if (onBlocked) {
        pendingAutoplay = true;
        addGestureUnlock(onBlocked);
      }
      return null;
    }
  }

  function openNav(drawer) {
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeNav(drawer) {
    drawer.classList.remove('open');
    document.body.style.overflow = '';
  }

  function initMobileNav(drawerId, closeBtnId, linkSelector) {
    const drawer = document.getElementById(drawerId);
    if (!drawer) return;
    const closeBtn = document.getElementById(closeBtnId);
    const backdrop = drawer.querySelector('.mobile-nav-backdrop');
    const links = drawer.querySelectorAll(linkSelector);

    const close = () => closeNav(drawer);
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (backdrop) backdrop.addEventListener('click', close);

    links.forEach((link) => {
      link.addEventListener('click', () => {
        closeNav(drawer);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeNav(drawer);
    });
  }

  return {
    qwertyRows,
    fidelByKey,
    normalizeAmharicChar,
    getAlternateFidelForms,
    fetchAlphabet,
    fetchRandomWord,
    playCharacterAudio,
    playWordAudio,
    addGestureUnlock,
    safePlay,
    openNav,
    closeNav,
    initMobileNav
  };
})();

window.MobileCommon = MobileCommon;
