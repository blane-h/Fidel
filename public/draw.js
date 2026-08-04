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

// Compute the Euclidean distance of every pixel to the nearest ink pixel using a
// two-pass chamfer (distance transform). Ink pixels are 0; blank pixels climb as
// they move away from the shape. This lets us measure how close each drawing pixel
// is to the reference shape, which is tolerant of wobble, uneven thickness, and
// minor offset while still capturing the overall shape.
function distanceTransform(grid) {
  const size = COMPARE_SIZE;
  const dist = new Float32Array(size * size);
  const INF = 1e9;

  for (let i = 0; i < size * size; i += 1) {
    dist[i] = grid[i] === 1 ? 0 : INF;
  }

  // Forward pass.
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = y * size + x;
      if (dist[idx] === 0) {
        continue;
      }
      if (y > 0) dist[idx] = Math.min(dist[idx], dist[idx - size] + 1);
      if (x > 0) dist[idx] = Math.min(dist[idx], dist[idx - 1] + 1);
      if (y > 0 && x > 0) dist[idx] = Math.min(dist[idx], dist[idx - size - 1] + 1.4142);
      if (y > 0 && x < size - 1) dist[idx] = Math.min(dist[idx], dist[idx - size + 1] + 1.4142);
    }
  }

  // Backward pass.
  for (let y = size - 1; y >= 0; y -= 1) {
    for (let x = size - 1; x >= 0; x -= 1) {
      const idx = y * size + x;
      if (y < size - 1) dist[idx] = Math.min(dist[idx], dist[idx + size] + 1);
      if (x < size - 1) dist[idx] = Math.min(dist[idx], dist[idx + 1] + 1);
      if (y < size - 1 && x < size - 1) dist[idx] = Math.min(dist[idx], dist[idx + size + 1] + 1.4142);
      if (y < size - 1 && x > 0) dist[idx] = Math.min(dist[idx], dist[idx + size - 1] + 1.4142);
    }
  }

  return dist;
}

// Shape similarity based on Chamfer distance. For each drawing ink pixel, look up
// how far it is from the reference shape; pixels within a small tolerance count as
// "covered". Returns the fraction of drawing ink that lies close to the reference.
// This is tolerant of pen wobble and uneven stroke thickness while still requiring
// the drawing to occupy the same shape as the reference.
function distanceSimilarity(drawing, reference) {
  const size = COMPARE_SIZE;
  const dist = distanceTransform(reference);
  const DIST_TOLERANCE = 2.5; // pixels of tolerated deviation from the reference shape
  let covered = 0;
  let total = 0;

  for (let i = 0; i < size * size; i += 1) {
    if (drawing[i] === 1) {
      total += 1;
      if (dist[i] <= DIST_TOLERANCE) {
        covered += 1;
      }
    }
  }

  if (total === 0) {
    return 0;
  }
  return covered / total;
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
// Matches are accepted when EITHER the pixel overlap is high OR the shape distance
// similarity is high. This makes the local path lenient on penmanship (wobble,
// uneven thickness, minor offset) while still requiring the relative shape to be
// correct.
const HIGH_MATCH_THRESHOLD = 0.55; // normalized pixel-overlap similarity
const HIGH_SHAPE_THRESHOLD = 0.75; // Chamfer distance-based shape similarity
// Low thresholds kept very conservative: only obviously-wrong drawings (scribbles,
// clearly different glyphs) are rejected locally. Correct-but-imperfect handwriting
// that falls between the thresholds is sent to Gemini for a real judgment.
const LOW_MATCH_THRESHOLD = 0.18;
const LOW_SHAPE_THRESHOLD = 0.40;

// Returns 'match' | 'no-match' | null (null = ambiguous, call Gemini).
function localCompare(drawingDataUrl, referenceDataUrl) {
  const rawDrawing = toBinaryGrid(drawingDataUrl);
  const rawReference = toBinaryGrid(referenceDataUrl);
  // Normalize both so position/size differences don't unfairly penalize the drawing.
  const drawing = normalizeGrid(rawDrawing);
  const reference = normalizeGrid(rawReference);
  // Dilate BOTH the drawing and the reference so a slightly thinner/thicker stroke
  // or minor pen wobble still overlaps the reference shape. This is fair to normal
  // handwriting and avoids rejecting correct shapes because of stroke thickness.
  const dilatedDrawing = dilate(drawing, 1);
  const dilatedReference = dilate(reference, 1);
  const overlap = binarySimilarity(dilatedDrawing, dilatedReference);
  const shape = distanceSimilarity(dilatedDrawing, dilatedReference);
  // Log the scores to help tune thresholds in the browser console.
  console.log(`[localCompare] overlap=${overlap.toFixed(3)} shape=${shape.toFixed(3)}`);
  // Accept when either metric confidently indicates the relative shape matches.
  if (overlap >= HIGH_MATCH_THRESHOLD || shape >= HIGH_SHAPE_THRESHOLD) {
    return { verdict: 'match', overlap, shape };
  }
  // Reject only when BOTH metrics are clearly low (obviously a different shape).
  if (overlap <= LOW_MATCH_THRESHOLD && shape <= LOW_SHAPE_THRESHOLD) {
    return { verdict: 'no-match', overlap, shape };
  }
  return { verdict: null, overlap, shape };
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

// Try the trained model first via /api/draw/check.
// Returns { verdict: 'match'|'no-match'|null } where null means "ambiguous /
// no model" and the caller should fall back to Gemini.
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
      body: JSON.stringify({
        image: imageData,
        reference: referenceImage,
        expected: currentCharacter.fidel,
        features
      })
    });

    if (!response.ok) {
      return { verdict: null };
    }

    const data = await response.json();
    if (data.match === true && data.source === 'model') {
      return { verdict: 'match', confidence: data.confidence };
    }
    if (data.match === false && data.source === 'model') {
      return { verdict: 'no-match', confidence: data.confidence };
    }
    return { verdict: null, confidence: data.confidence };
  } catch (_error) {
    return { verdict: null };
  }
}

// Enter - submit for checking (model first, then legacy local+Gemini fallback)
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

  // Step 1: try the trained model.
  const modelResult = await checkWithModel(imageData, referenceImage);
  if (modelResult.verdict === 'match') {
    console.log('[check] model says match', modelResult.confidence);
    statusMessage.textContent = 'Correct! Great job.';
    statusMessage.className = 'status success';
    return;
  }
  if (modelResult.verdict === 'no-match') {
    console.log('[check] model says no-match', modelResult.confidence);
    statusMessage.textContent = 'Not quite. Try again.';
    statusMessage.className = 'status error';
    return;
  }

  // Step 2 (fallback): local fast-path for obvious cases without Gemini.
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
