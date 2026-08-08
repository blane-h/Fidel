const MobileDraw = (() => {
  const { fetchAlphabet, playCharacterAudio, openNav, closeNav, initMobileNav, addGestureUnlock } = MobileCommon;

  const drawCanvas = document.getElementById('mobileDrawCanvas');
  const ctx = drawCanvas.getContext('2d');
  const drawPrompt = document.getElementById('mobileDrawPrompt');
  const drawHint = document.getElementById('mobileDrawHint');
  const statusMessage = document.getElementById('mobileStatusMessage');
  const consonantBoxes = document.getElementById('consonantBoxes');
  const shuffleBtn = document.getElementById('mobileShuffleBtn');
  const completionMessage = document.getElementById('mobileCompletionMessage');
  const clearBtn = document.getElementById('mobileClearBtn');
  const enterBtn = document.getElementById('mobileEnterBtn');
  const traceBtn = document.getElementById('mobileTraceBtn');
  const traceLayer = document.getElementById('mobileTraceLayer');
  const soundBtn = document.getElementById('mobileSoundBtn');
  const prevVowelBtn = document.getElementById('mobilePrevVowelBtn');
  const nextVowelBtn = document.getElementById('mobileNextVowelBtn');
  const cycleBtn = document.getElementById('mobileCycleBtn');
  const feedbackOverlay = document.getElementById('mobileFeedbackOverlay');

  let alphabet = [];
  let consonants = [];
  let currentConsonantIndex = 0;
  let currentVowelIndex = 0;
  let currentCharacter = null;
  let traceMode = false;
  let isDrawing = false;
  let lastPoint = null;
  let currentAudio = null;
  let studyComplete = false;
  let familyComplete = false;
  let shuffleMode = false;
  let shuffleHistory = [];
  let shuffleHistoryIndex = -1;
  let shuffleBaseConsonantIndex = 0;
  let showFidel = false;
  let strokes = [];

  const MIN_INK_COVERAGE = 0.02;
  const STRAIGHT_BAND_RATIO = 0.12;
  const MIN_BBOX_RATIO = 0.15;

  function getCanvasPoint(event) {
    const rect = drawCanvas.getBoundingClientRect();
    const scaleX = drawCanvas.width / rect.width;
    const scaleY = drawCanvas.height / rect.height;
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function clearCanvas() {
    ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
    strokes = [];
  }

  function startDrawing(event) {
    event.preventDefault();
    isDrawing = true;
    lastPoint = getCanvasPoint(event);
    strokes.push([lastPoint]);
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111111';
  }

  function drawStroke(event) {
    if (!isDrawing) return;
    event.preventDefault();
    const point = getCanvasPoint(event);
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPoint = point;
    const currentStroke = strokes[strokes.length - 1];
    if (currentStroke) currentStroke.push(point);
  }

  function stopDrawing() {
    isDrawing = false;
    lastPoint = null;
  }

  drawCanvas.addEventListener('mousedown', startDrawing);
  drawCanvas.addEventListener('mousemove', drawStroke);
  drawCanvas.addEventListener('mouseup', stopDrawing);
  drawCanvas.addEventListener('mouseleave', stopDrawing);
  drawCanvas.addEventListener('touchstart', startDrawing, { passive: false });
  drawCanvas.addEventListener('touchmove', drawStroke, { passive: false });
  drawCanvas.addEventListener('touchend', stopDrawing);

  function renderTrace() {
    if (traceMode && currentCharacter) {
      traceLayer.textContent = currentCharacter.fidel;
      traceLayer.hidden = false;
    } else {
      traceLayer.hidden = true;
    }
  }

  traceBtn.addEventListener('click', () => {
    traceMode = !traceMode;
    traceBtn.classList.toggle('active', traceMode);
    if (!traceMode) {
      traceLayer.textContent = '';
      traceLayer.hidden = true;
    } else {
      renderTrace();
    }
  });

  function getCurrentCharacter() {
    if (!consonants[currentConsonantIndex]) return null;
    const family = consonants[currentConsonantIndex];
    if (!family || !family.vowels[currentVowelIndex]) return null;
    return family.vowels[currentVowelIndex];
  }

  function updatePrompt() {
    const char = getCurrentCharacter();
    if (!char) return;
    currentCharacter = char;
    clearCanvas();
    renderTrace();
    drawPrompt.textContent = showFidel ? char.fidel : char.latin;
    drawHint.hidden = true;
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

  function renderConsonantBoxes() {
    consonantBoxes.innerHTML = '';
    const effectiveIndex = shuffleMode ? shuffleBaseConsonantIndex : currentConsonantIndex;
    consonants.forEach((family, i) => {
      const box = document.createElement('div');
      box.className = 'consonant-box';
      if (!shuffleMode && i === effectiveIndex) {
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
        updatePrompt();
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

  function advancePage(delta) {
    if (!consonants.length) return;
    if (shuffleMode) {
      if (delta > 0) addShuffledCharacter();
      else navigateShuffleHistory(delta);
      return;
    }
    currentConsonantIndex += delta;
    if (currentConsonantIndex < 0) currentConsonantIndex = consonants.length - 1;
    else if (currentConsonantIndex >= consonants.length) currentConsonantIndex = 0;
    currentVowelIndex = 0;
    renderConsonantBoxes();
    updatePrompt();
  }

  function advanceVowel(delta) {
    if (!consonants.length) return;
    if (shuffleMode) {
      if (delta > 0) addShuffledCharacter();
      else navigateShuffleHistory(delta);
      return;
    }
    if (!consonants[currentConsonantIndex]) return;
    const family = consonants[currentConsonantIndex];
    const nextIndex = currentVowelIndex + delta;
    if (nextIndex < 0) return;
    currentVowelIndex = nextIndex;
    if (currentVowelIndex >= family.vowels.length && delta > 0) {
      showFamilyComplete();
      return;
    }
    updatePrompt();
  }

  function cycleCurrentSet() {
    if (shuffleMode) return;
    currentVowelIndex = 0;
    updatePrompt();
  }

  function advanceCharacter() {
    if (shuffleMode) {
      addShuffledCharacter();
      return;
    }
    currentVowelIndex += 1;
    if (currentVowelIndex >= 7) {
      showFamilyComplete();
      return;
    }
    renderConsonantBoxes();
    updatePrompt();
  }

  function showCompletion() {
    completionMessage.textContent = 'You have finished studying all fidel characters!';
    completionMessage.hidden = false;
    currentCharacter = null;
    clearCanvas();
    traceLayer.hidden = true;
    drawPrompt.textContent = '-';
    drawHint.hidden = true;
  }

  function validateDrawing() {
    const canvasWidth = drawCanvas.width;
    const canvasHeight = drawCanvas.height;
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const pixels = imageData.data;

    let inkedPixels = 0;
    let minX = canvasWidth;
    let minY = canvasHeight;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < canvasHeight; y += 1) {
      for (let x = 0; x < canvasWidth; x += 1) {
        const index = (y * canvasWidth + x) * 4;
        const alpha = pixels[index + 3];
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const isInk = alpha > 60 && r < 200 && g < 200 && b < 200;
        if (isInk) {
          inkedPixels += 1;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const totalPixels = canvasWidth * canvasHeight;
    const coverage = inkedPixels / totalPixels;
    if (coverage < MIN_INK_COVERAGE) {
      return { valid: false, reason: 'Your drawing is blank or too faint. Please draw the character.' };
    }

    const bboxWidth = maxX - minX + 1;
    const bboxHeight = maxY - minY + 1;
    const bboxRatio = Math.min(bboxWidth / canvasWidth, bboxHeight / canvasHeight);
    if (bboxRatio < MIN_BBOX_RATIO) {
      return { valid: false, reason: 'Your drawing is too small to recognize. Please draw larger.' };
    }

    if (strokes.length === 1) {
      const stroke = strokes[0];
      if (stroke.length >= 3) {
        let sxMin = Infinity;
        let sxMax = -Infinity;
        let syMin = Infinity;
        let syMax = -Infinity;
        stroke.forEach((p) => {
          if (p.x < sxMin) sxMin = p.x;
          if (p.x > sxMax) sxMax = p.x;
          if (p.y < syMin) syMin = p.y;
          if (p.y > syMax) syMax = p.y;
        });
        const sw = sxMax - sxMin;
        const sh = syMax - syMin;
        const isStraight = Math.min(sw, sh) <= Math.max(sw, sh) * STRAIGHT_BAND_RATIO;
        if (isStraight) {
          return { valid: false, reason: 'A single straight line is not a valid fidel. Please draw the full character.' };
        }
      }
    }

    return { valid: true };
  }

  const compareCanvas = document.createElement('canvas');
  const compareCtx = compareCanvas.getContext('2d');
  const COMPARE_SIZE = 64;

  function inkPixelAt(data, width, x, y) {
    const index = (y * width + x) * 4;
    const alpha = data[index + 3];
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    return alpha > 60 && r < 200 && g < 200 && b < 200;
  }

  function toBinaryGrid(dataUrl) {
    const img = new Image();
    img.src = dataUrl;
    const size = COMPARE_SIZE;
    compareCanvas.width = size;
    compareCanvas.height = size;
    const ctx = compareCtx;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const grid = new Uint8Array(size * size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        grid[y * size + x] = inkPixelAt(imageData.data, size, x, y) ? 1 : 0;
      }
    }
    return grid;
  }

  function normalizeGrid(grid) {
    const size = COMPARE_SIZE;
    let minX = size;
    let minY = size;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (grid[y * size + x] === 1) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) return grid;

    const inkW = maxX - minX + 1;
    const inkH = maxY - minY + 1;
    const target = Math.round(size * 0.8);
    const scale = Math.min(target / inkW, target / inkH);
    const scaledW = Math.max(1, Math.round(inkW * scale));
    const scaledH = Math.max(1, Math.round(inkH * scale));
    const offsetX = Math.floor((size - scaledW) / 2);
    const offsetY = Math.floor((size - scaledH) / 2);

    const normalized = new Uint8Array(size * size);
    for (let y = 0; y < scaledH; y += 1) {
      for (let x = 0; x < scaledW; x += 1) {
        const srcX = minX + Math.min(inkW - 1, Math.floor(x / scale));
        const srcY = minY + Math.min(inkH - 1, Math.floor(y / scale));
        if (grid[srcY * size + srcX] === 1) {
          normalized[(offsetY + y) * size + (offsetX + x)] = 1;
        }
      }
    }
    return normalized;
  }

  function dilate(grid, radius = 1) {
    const size = COMPARE_SIZE;
    const out = new Uint8Array(size * size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (grid[y * size + x] === 1) {
          for (let dy = -radius; dy <= radius; dy += 1) {
            for (let dx = -radius; dx <= radius; dx += 1) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
                out[ny * size + nx] = 1;
              }
            }
          }
        }
      }
    }
    return out;
  }

  function distanceTransform(grid) {
    const size = COMPARE_SIZE;
    const dist = new Float32Array(size * size);
    const INF = 1e9;
    for (let i = 0; i < size * size; i += 1) {
      dist[i] = grid[i] === 1 ? 0 : INF;
    }
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const idx = y * size + x;
        if (dist[idx] === 0) continue;
        if (y > 0) dist[idx] = Math.min(dist[idx], dist[idx - size] + 1);
        if (x > 0) dist[idx] = Math.min(dist[idx], dist[idx - 1] + 1);
        if (y > 0 && x > 0) dist[idx] = Math.min(dist[idx], dist[idx - size - 1] + 1.4142);
        if (y > 0 && x < size - 1) dist[idx] = Math.min(dist[idx], dist[idx - size + 1] + 1.4142);
      }
    }
    for (let y = size - 1; y >= 0; y -= 1) {
      for (let x = size - 1; x >= 0; x -= 1) {
        const idx = y * size + x;
        if (y < size - 1) dist[idx] = Math.min(dist[idx], dist[idx + size] + 1);
        if (x < size - 1) dist[idx] = Math.min(dist[idx], dist[idx + 1] + 1);
        if (y < size - 1 && x < size - 1) dist[idx] = Math.min(dist[idx], dist[idx + size + 1] + 1);
        if (y < size - 1 && x > 0) dist[idx] = Math.min(dist[idx], dist[idx + size - 1] + 1.4142);
      }
    }
    return dist;
  }

  function distanceSimilarity(drawing, reference) {
    const size = COMPARE_SIZE;
    const dist = distanceTransform(reference);
    const DIST_TOLERANCE = 2.5;
    let covered = 0;
    let total = 0;
    for (let i = 0; i < size * size; i += 1) {
      if (drawing[i] === 1) {
        total += 1;
        if (dist[i] <= DIST_TOLERANCE) covered += 1;
      }
    }
    if (total === 0) return 0;
    return covered / total;
  }

  function binarySimilarity(a, b) {
    const size = COMPARE_SIZE;
    let same = 0;
    let total = 0;
    for (let i = 0; i < size * size; i += 1) {
      if (a[i] === 1 || b[i] === 1) {
        same += a[i] === b[i] ? 1 : 0;
        total += 1;
      }
    }
    if (total === 0) return 0;
    return same / total;
  }

  function localCompare(drawingDataUrl, referenceDataUrl) {
    const rawDrawing = toBinaryGrid(drawingDataUrl);
    const rawReference = toBinaryGrid(referenceDataUrl);
    const drawing = normalizeGrid(rawDrawing);
    const reference = normalizeGrid(rawReference);
    const dilatedDrawing = dilate(drawing, 1);
    const dilatedReference = dilate(reference, 1);
    const overlap = binarySimilarity(dilatedDrawing, dilatedReference);
    const shape = distanceSimilarity(dilatedDrawing, dilatedReference);
    if (overlap >= 0.55 || shape >= 0.75) return { verdict: 'match', overlap, shape };
    if (overlap <= 0.18 && shape <= 0.40) return { verdict: 'no-match', overlap, shape };
    return { verdict: null, overlap, shape };
  }

  function renderReferenceImage() {
    if (!currentCharacter) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 420;
    canvas.height = 420;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#111111';
    context.font = '16rem "Noto Sans Ethiopic", "Nyala", "Kefa", "Abyssinica SIL", serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(currentCharacter.fidel, canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL('image/png');
  }

  function downscaleDataUrl(dataUrl, maxSize = 256) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const context = canvas.getContext('2d');
        context.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  let lastSubmitTime = 0;
  const SUBMIT_COOLDOWN_MS = 1200;

  function showFeedback(isCorrect, duration = 1500) {
    const icon = document.getElementById('mobileFeedbackIcon');
    const text = document.getElementById('mobileFeedbackText');
    if (!icon || !text) return;
    icon.textContent = isCorrect ? '✓' : '✗';
    icon.className = 'mobile-feedback-icon ' + (isCorrect ? 'correct' : 'incorrect');
    text.textContent = isCorrect ? 'Correct' : 'Incorrect';
    text.className = 'mobile-feedback-text ' + (isCorrect ? 'correct' : 'incorrect');
    feedbackOverlay.hidden = false;
    requestAnimationFrame(() => {
      feedbackOverlay.classList.add('visible');
    });
    setTimeout(() => {
      feedbackOverlay.classList.remove('visible');
      setTimeout(() => {
        feedbackOverlay.hidden = true;
      }, 200);
    }, duration);
  }

  async function checkWithModel(imageData, referenceImage) {
    try {
      let features = null;
      const F = window.FidelFeatures;
      if (F && F.buildFeatures) {
        const result = await F.buildFeatures(imageData, referenceImage);
        features = Array.from(result.vector);
      }
      const response = await fetch('/api/draw/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData, reference: referenceImage, expected: currentCharacter.fidel, features })
      });
      if (!response.ok) return { verdict: null };
      const data = await response.json();
      if (data.match === true && data.source === 'model') return { verdict: 'match', confidence: data.confidence };
      if (data.match === false && data.source === 'model') return { verdict: 'no-match', confidence: data.confidence };
      return { verdict: null, confidence: data.confidence };
    } catch (_error) {
      return { verdict: null };
    }
  }

  async function submitDrawing() {
    if (!currentCharacter) {
      statusMessage.textContent = 'No character loaded. Please wait or select a character.';
      statusMessage.className = 'mobile-status error';
      return;
    }
    if (studyComplete) {
      statusMessage.textContent = 'Study complete! Start a new session to continue.';
      statusMessage.className = 'mobile-status error';
      return;
    }
    if (familyComplete) {
      statusMessage.textContent = 'Finish the current family or continue to the next one.';
      statusMessage.className = 'mobile-status error';
      return;
    }
    const now = Date.now();
    if (now - lastSubmitTime < SUBMIT_COOLDOWN_MS) return;
    lastSubmitTime = now;

    const validation = validateDrawing();
    if (!validation.valid) {
      statusMessage.textContent = validation.reason;
      statusMessage.className = 'mobile-status error';
      return;
    }

    const imageData = drawCanvas.toDataURL('image/png');
    const referenceImage = renderReferenceImage();

    const modelResult = await checkWithModel(imageData, referenceImage);
    if (modelResult.verdict === 'match') {
      statusMessage.textContent = 'Correct! Great job. (model ' + Math.round((modelResult.confidence || 0) * 100) + '%)';
      statusMessage.className = 'mobile-status success';
      showFeedback(true);
      advanceCharacter();
      return;
    }
    if (modelResult.verdict === 'no-match') {
      statusMessage.textContent = 'Not quite. Try again.';
      statusMessage.className = 'mobile-status error';
      showFeedback(false);
      return;
    }

    const local = localCompare(imageData, referenceImage);
    if (local.verdict === 'no-match') {
      statusMessage.textContent = 'Not quite. Try again.';
      statusMessage.className = 'mobile-status error';
      showFeedback(false);
      return;
    }

    statusMessage.textContent = 'Checking with Gemini...';
    statusMessage.className = 'mobile-status checking';

    try {
      const [smallImage, smallReference] = await Promise.all([
        downscaleDataUrl(imageData),
        downscaleDataUrl(referenceImage)
      ]);
      const response = await fetch('/api/draw/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: smallImage, reference: smallReference, expected: currentCharacter.fidel })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        statusMessage.textContent = data?.error || 'Unable to check drawing.';
        statusMessage.className = 'mobile-status error';
        showFeedback(false);
        return;
      }
      const data = await response.json();
      if (data.imageUnreadable) {
        const VERY_HIGH_OVERLAP = 0.70;
        const VERY_HIGH_SHAPE = 0.85;
        const veryConfidentMatch = local.overlap > VERY_HIGH_OVERLAP || local.shape > VERY_HIGH_SHAPE;
        if (veryConfidentMatch) {
          statusMessage.textContent = data.message || 'Correct (Gemini unavailable, but local comparison is very confident).';
          statusMessage.className = 'mobile-status success';
          showFeedback(true);
          advanceCharacter();
        } else {
          statusMessage.textContent = 'Not quite. Try again.';
          statusMessage.className = 'mobile-status error';
          showFeedback(false);
        }
      } else if (data.match) {
        statusMessage.textContent = 'Correct! Great job. (Gemini)';
        statusMessage.className = 'mobile-status success';
        showFeedback(true);
        advanceCharacter();
      } else {
        statusMessage.textContent = 'Not quite. Try again.';
        statusMessage.className = 'mobile-status error';
        showFeedback(false);
      }
    } catch (_error) {
      statusMessage.textContent = 'Unable to check drawing.';
      statusMessage.className = 'mobile-status error';
      showFeedback(false);
    }
  }

  enterBtn.addEventListener('click', submitDrawing);
  clearBtn.addEventListener('click', () => {
    clearCanvas();
    statusMessage.textContent = '';
    statusMessage.className = 'mobile-status';
  });

  function addShuffledCharacter() {
    const randomConsonant = Math.floor(Math.random() * consonants.length);
    const randomVowel = Math.floor(Math.random() * consonants[randomConsonant].vowels.length);
    shuffleHistory = shuffleHistory.slice(0, shuffleHistoryIndex + 1);
    shuffleHistory.push({ consonantIndex: randomConsonant, vowelIndex: randomVowel });
    shuffleHistoryIndex = shuffleHistory.length - 1;
    currentConsonantIndex = randomConsonant;
    currentVowelIndex = randomVowel;
    renderConsonantBoxes();
    updatePrompt();
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
    updatePrompt();
  }

  shuffleBtn.addEventListener('click', () => {
    if (!consonants.length) return;
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
      updatePrompt();
    }
  });

  soundBtn.addEventListener('click', playCurrentSound);
  cycleBtn.addEventListener('click', cycleCurrentSet);

  drawPrompt.addEventListener('click', () => {
    showFidel = !showFidel;
    if (currentCharacter) {
      drawPrompt.textContent = showFidel ? currentCharacter.fidel : currentCharacter.latin;
    }
  });

  function showFamilyComplete() {
    familyComplete = true;
    const family = consonants[currentConsonantIndex];
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
    document.getElementById('mobileFamilyCompleteOverlay').hidden = false;
  }

  document.getElementById('mobileNextFamilyBtn').addEventListener('click', () => {
    document.getElementById('mobileFamilyCompleteOverlay').hidden = true;
    familyComplete = false;
    if (currentConsonantIndex < consonants.length - 1) {
      currentConsonantIndex += 1;
      currentVowelIndex = 0;
      renderConsonantBoxes();
      updatePrompt();
    } else {
      studyComplete = true;
      showCompletion();
    }
  });

  document.getElementById('mobileRestartFamilyBtn').addEventListener('click', () => {
    document.getElementById('mobileFamilyCompleteOverlay').hidden = true;
    familyComplete = false;
    currentVowelIndex = 0;
    renderConsonantBoxes();
    updatePrompt();
  });

  document.getElementById('mobileCloseFamilyCompleteBtn').addEventListener('click', () => {
    document.getElementById('mobileFamilyCompleteOverlay').hidden = true;
    familyComplete = false;
  });

  prevVowelBtn.addEventListener('click', () => advanceVowel(-1));
  nextVowelBtn.addEventListener('click', () => advanceVowel(1));

  async function loadAlphabet() {
    try {
      const data = await fetchAlphabet();
      alphabet = data;
      consonants = [...data];
    } catch (_error) {
      statusMessage.textContent = 'Failed to load alphabet.';
      statusMessage.className = 'mobile-status error';
    }
  }

  async function init() {
    await loadAlphabet();
    renderConsonantBoxes();
    setupConsonantScroll();
    updatePrompt();
  }

  init();
})();
