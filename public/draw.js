const drawCanvas = document.getElementById('drawCanvas');
const ctx = drawCanvas.getContext('2d');
const drawPrompt = document.getElementById('drawPrompt');
const drawHint = document.getElementById('drawHint');
const statusMessage = document.getElementById('statusMessage');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const swapBtn = document.getElementById('swapBtn');
const soundBtn = document.getElementById('soundBtn');
const traceBtn = document.getElementById('traceBtn');
const clearBtn = document.getElementById('clearBtn');
const enterBtn = document.getElementById('enterBtn');
const traceLayer = document.getElementById('traceLayer');

let currentCharacter = null;
let showFidelSpelling = false;
let traceMode = false;
let isDrawing = false;
let lastPoint = null;
let currentAudio = null;
let currentCharacterBank = [];

// Stroke tracking for validating the drawing before submission.
let strokes = [];

// Minimum ink coverage (as a fraction of total canvas pixels) required.
const MIN_INK_COVERAGE = 0.02;
// A stroke is considered "straight" if its points stay within this band of the bounding box.
const STRAIGHT_BAND_RATIO = 0.12;
// Minimum bounding-box size (relative to canvas) before a drawing is considered a real attempt.
const MIN_BBOX_RATIO = 0.15;

// Canvas drawing state
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
  if (!isDrawing) {
    return;
  }

  event.preventDefault();
  const point = getCanvasPoint(event);
  ctx.beginPath();
  ctx.moveTo(lastPoint.x, lastPoint.y);
  ctx.lineTo(point.x, point.y);
  ctx.stroke();
  lastPoint = point;
  const currentStroke = strokes[strokes.length - 1];
  if (currentStroke) {
    currentStroke.push(point);
  }
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

// Trace mode
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
  renderTrace();
});

// Prompt display toggling
function renderPrompt() {
  if (!currentCharacter) {
    return;
  }

  if (showFidelSpelling) {
    drawPrompt.textContent = currentCharacter.fidel;
    drawHint.textContent = `Latin: ${currentCharacter.latin}`;
    drawHint.hidden = false;
  } else {
    drawPrompt.textContent = currentCharacter.latin;
    drawHint.textContent = 'Draw the matching fidel';
    drawHint.hidden = false;
  }
}

prevBtn.addEventListener('click', () => {
  showFidelSpelling = !showFidelSpelling;
  renderPrompt();
});

swapBtn.addEventListener('click', () => {
  showFidelSpelling = !showFidelSpelling;
  renderPrompt();
});

nextBtn.addEventListener('click', () => {
  if (currentCharacterBank.length > 0) {
    const nextChar = currentCharacterBank[Math.floor(Math.random() * currentCharacterBank.length)];
    loadCharacter(nextChar);
  } else {
    loadRandomCharacter();
  }
});

// Sound playback
async function playSound() {
  if (!currentCharacter) {
    return;
  }

  const textToSpeak = showFidelSpelling ? currentCharacter.fidel : currentCharacter.latin;
  try {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'am-ET';
      window.speechSynthesis.speak(utterance);
    }
  } catch (_error) {
    // Speech synthesis may not be available; ignore.
  }
}

soundBtn.addEventListener('click', playSound);

// Clear
clearBtn.addEventListener('click', () => {
  clearCanvas();
  statusMessage.textContent = '';
  statusMessage.className = 'status';
});

// Drawing validation helpers
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

  // Blank or nearly empty canvas.
  if (coverage < MIN_INK_COVERAGE) {
    return { valid: false, reason: 'Your drawing is blank or too faint. Please draw the character.' };
  }

  // Ink confined to a tiny region (dot or small scribble).
  const bboxWidth = maxX - minX + 1;
  const bboxHeight = maxY - minY + 1;
  const bboxRatio = Math.min(bboxWidth / canvasWidth, bboxHeight / canvasHeight);
  if (bboxRatio < MIN_BBOX_RATIO) {
    return { valid: false, reason: 'Your drawing is too small to recognize. Please draw larger.' };
  }

  // A single nearly-straight stroke is not a genuine attempt at a fidel.
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

// ---- Local fast-path: compare the drawing against the reference glyph ----
// This avoids calling Gemini for obvious correct/wrong drawings, saving quota.
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

// Downscale a data URL to a small binary grid of ink / blank pixels.
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

// Normalize a binary grid so its ink is centered and scaled to a fixed size.
// This makes the comparison invariant to the drawing's position and overall size,
// which is important because a correct handwriting attempt may be off-center or
// drawn larger/smaller than the font-rendered reference glyph.
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

  if (maxX < minX || maxY < minY) {
    return grid;
  }

  const inkW = maxX - minX + 1;
  const inkH = maxY - minY + 1;
  // Scale the ink bounding box to fill a fixed inner box (e.g. 80% of the grid),
  // keeping aspect ratio, then center it.
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

// Grow the ink in a grid by one pixel in all 8 directions. Used on the reference
// glyph so a slightly thicker or marginally offset stroke still overlaps, which
// accommodates normal nib thickness and minor pen wobble.
function dilate(grid) {
  const size = COMPARE_SIZE;
  const out = new Uint8Array(grid);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (grid[y * size + x] === 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
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

// Simple normalized XOR similarity between two binary grids.
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
  if (total === 0) {
    return 0;
  }
  return same / total;
}

// Thresholds tuned so we only short-circuit on confident cases.
const HIGH_MATCH_THRESHOLD = 0.72;
// Low threshold kept very conservative: only obviously-wrong drawings (scribbles,
// clearly different glyphs) are rejected locally. Correct-but-imperfect handwriting
// that falls between the two thresholds is sent to Gemini for a real judgment.
const LOW_MATCH_THRESHOLD = 0.30;

// Returns 'match' | 'no-match' | null (null = ambiguous, call Gemini).
function localCompare(drawingDataUrl, referenceDataUrl) {
  const rawDrawing = toBinaryGrid(drawingDataUrl);
  const rawReference = toBinaryGrid(referenceDataUrl);
  // Normalize both so position/size differences don't unfairly penalize the drawing.
  const drawing = normalizeGrid(rawDrawing);
  const reference = normalizeGrid(dilate(rawReference));
  const similarity = binarySimilarity(drawing, reference);
  // Log the score to help tune thresholds in the browser console.
  console.log(`[localCompare] similarity=${similarity.toFixed(3)}`);
  if (similarity >= HIGH_MATCH_THRESHOLD) {
    return { verdict: 'match', similarity };
  }
  if (similarity <= LOW_MATCH_THRESHOLD) {
    return { verdict: 'no-match', similarity };
  }
  return { verdict: null, similarity };
}

// Render the expected fidel onto an offscreen canvas so Gemini can visually
// compare the user's drawing against the correct shape.
function renderReferenceImage() {
  if (!currentCharacter) {
    return null;
  }

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

// Downscale an image data URL to a smaller size to reduce API payload size.
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

// Simple cooldown to prevent rapid duplicate submissions / spamming.
let lastSubmitTime = 0;
const SUBMIT_COOLDOWN_MS = 1200;

// Enter - submit to Gemini
async function submitDrawing() {
  if (!currentCharacter) {
    return;
  }

  const now = Date.now();
  if (now - lastSubmitTime < SUBMIT_COOLDOWN_MS) {
    return;
  }
  lastSubmitTime = now;

  const validation = validateDrawing();
  if (!validation.valid) {
    statusMessage.textContent = validation.reason;
    statusMessage.className = 'status error';
    return;
  }

  const imageData = drawCanvas.toDataURL('image/png');
  const referenceImage = renderReferenceImage();

  // Local fast-path: decide obvious cases without calling Gemini.
  const local = localCompare(imageData, referenceImage);
  if (local.verdict === 'match') {
    statusMessage.textContent = 'Correct! Great job.';
    statusMessage.className = 'status success';
    return;
  }
  if (local.verdict === 'no-match') {
    statusMessage.textContent = 'Not quite. Try again.';
    statusMessage.className = 'status error';
    return;
  }

  statusMessage.textContent = 'Checking your drawing...';
  statusMessage.className = 'status checking';

  try {
    // Downscale images to reduce payload size before sending to the server.
    const [smallImage, smallReference] = await Promise.all([
      downscaleDataUrl(imageData),
      downscaleDataUrl(referenceImage)
    ]);

    const response = await fetch('/api/draw/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: smallImage,
        reference: smallReference,
        expected: currentCharacter.fidel
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      statusMessage.textContent = data?.error || 'Unable to check drawing.';
      statusMessage.className = 'status error';
      return;
    }

    const data = await response.json();

    if (data.match) {
      statusMessage.textContent = 'Correct! Great job.';
      statusMessage.className = 'status success';
      // Keep current character until user presses Next, but allow retry.
    } else {
      statusMessage.textContent = 'Not quite. Try again.';
      statusMessage.className = 'status error';
    }
  } catch (_error) {
    statusMessage.textContent = 'Unable to check drawing.';
    statusMessage.className = 'status error';
  }
}

enterBtn.addEventListener('click', submitDrawing);

// Load character functions
function loadCharacter(char) {
  currentCharacter = char;
  clearCanvas();
  showFidelSpelling = false;
  traceMode = false;
  traceBtn.classList.remove('active');
  renderTrace();
  renderPrompt();
  statusMessage.textContent = '';
  statusMessage.className = 'status';
}

async function loadRandomCharacter() {
  try {
    const response = await fetch('/api/draw/random');
    const char = await response.json();
    loadCharacter(char);
  } catch (_error) {
    statusMessage.textContent = 'Failed to load character.';
    statusMessage.className = 'status error';
  }
}

// Load full character bank for "next" navigation
async function loadCharacterBank() {
  try {
    const response = await fetch('/api/alphabet');
    const alphabet = await response.json();
    const chars = [];
    alphabet.forEach((family) => {
      family.vowels.forEach((vowel) => {
        chars.push({ fidel: vowel.fidel, latin: vowel.latin });
      });
    });
    currentCharacterBank = chars;
  } catch (_error) {
    currentCharacterBank = [];
  }
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitDrawing();
  }
});

async function init() {
  await loadCharacterBank();
  await loadRandomCharacter();
}

init();
