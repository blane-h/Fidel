// train.js
// Temporary labeling page to build a dataset for the drawing-correctness model.
//
// Two modes:
//   1. Draw mode  — you draw a fidel on the canvas, then mark it Correct/Incorrect/Skip.
//   2. Auto mode  — the page generates batches of perturbed "correct" drawings and
//                   clearly-wrong drawings for you to confirm or flip, then save.
//
// Every labeled sample is sent to POST /api/train/sample along with the 436-dim
// feature vector computed by features.js.

const F = window.FidelFeatures;

// ---- Element refs -----------------------------------------------------------
const drawCanvas = document.getElementById('drawCanvas');
const ctx = drawCanvas.getContext('2d');
const referenceCanvas = document.getElementById('referenceCanvas');
const referenceCtx = referenceCanvas.getContext('2d');
const drawPrompt = document.getElementById('drawPrompt');
const statusMessage = document.getElementById('statusMessage');
const soundBtn = document.getElementById('soundBtn');
const traceBtn = document.getElementById('traceBtn');
const clearBtn = document.getElementById('clearBtn');
const traceLayer = document.getElementById('traceLayer');
const correctBtn = document.getElementById('correctBtn');
const incorrectBtn = document.getElementById('incorrectBtn');
const skipBtn = document.getElementById('skipBtn');

const drawModeBtn = document.getElementById('drawModeBtn');
const autoModeBtn = document.getElementById('autoModeBtn');
const drawMode = document.getElementById('drawMode');
const autoMode = document.getElementById('autoMode');
const batchRow = document.getElementById('batchRow');
const batchSize = document.getElementById('batchSize');
const generateBtn = document.getElementById('generateBtn');
const autoGrid = document.getElementById('autoGrid');
const saveAutoBtn = document.getElementById('saveAutoBtn');
const cancelAutoBtn = document.getElementById('cancelAutoBtn');

// ---- State ------------------------------------------------------------------
let currentCharacter = null;
let traceMode = false;
let isDrawing = false;
let lastPoint = null;
let currentCharacterBank = [];
let strokes = [];
let autoCards = [];
let autoBatchIndex = 0;

// ---- Canvas drawing (same logic as draw.js) ---------------------------------
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

// ---- Trace / prompt ---------------------------------------------------------
function renderTrace() {
  if (traceMode && currentCharacter) {
    traceLayer.textContent = currentCharacter.fidel;
    traceLayer.hidden = false;
  } else {
    traceLayer.hidden = true;
  }
}

function renderPrompt() {
  if (!currentCharacter) return;
  drawPrompt.textContent = currentCharacter.latin;
}

function loadCharacter(char) {
  currentCharacter = char;
  clearCanvas();
  traceMode = false;
  traceBtn.classList.remove('active');
  renderTrace();
  renderPrompt();
  renderReferenceGlyph();
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

// ---- Buttons ----------------------------------------------------------------
traceBtn.addEventListener('click', () => {
  traceMode = !traceMode;
  traceBtn.classList.toggle('active', traceMode);
  renderTrace();
});
soundBtn.addEventListener('click', () => {
  if (!currentCharacter) return;
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentCharacter.latin);
    utterance.lang = 'am-ET';
    window.speechSynthesis.speak(utterance);
  }
});
clearBtn.addEventListener('click', () => {
  clearCanvas();
  statusMessage.textContent = '';
  statusMessage.className = 'status';
});

// ---- Reference image --------------------------------------------------------
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

function renderReferenceGlyph() {
  if (!currentCharacter) return;
  referenceCtx.clearRect(0, 0, referenceCanvas.width, referenceCanvas.height);
  referenceCtx.fillStyle = '#111111';
  referenceCtx.font = '8rem "Noto Sans Ethiopic", "Nyala", "Kefa", "Abyssinica SIL", serif';
  referenceCtx.textAlign = 'center';
  referenceCtx.textBaseline = 'middle';
  referenceCtx.fillText(currentCharacter.fidel, referenceCanvas.width / 2, referenceCanvas.height / 2);
}

// ---- Submitting a labeled sample --------------------------------------------
async function postSample(expected, image, reference, label, source) {
  const features = await F.buildFeatures(image, reference);
  const response = await fetch('/api/train/sample', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expected,
      features: Array.from(features.vector),
      label,
      image,
      source
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to save sample.');
  }
  return data;
}

// Submit the current hand-drawn canvas with the given label.
async function submitLabel(label) {
  if (!currentCharacter) return;
  const imageData = drawCanvas.toDataURL('image/png');
  const referenceImage = renderReferenceImage();
  try {
    const data = await postSample(currentCharacter.fidel, imageData, referenceImage, label, 'manual');
    statusMessage.textContent = `Saved (${label}). Total: ${data.total}`;
    statusMessage.className = label === 'correct' ? 'status success' : 'status error';
    setTimeout(() => loadRandomCharacter(), 250);
  } catch (error) {
    statusMessage.textContent = error.message;
    statusMessage.className = 'status error';
  }
}

correctBtn.addEventListener('click', () => submitLabel('correct'));
incorrectBtn.addEventListener('click', () => submitLabel('incorrect'));
skipBtn.addEventListener('click', () => loadRandomCharacter());

// ---- Stats ------------------------------------------------------------------
// ---- Auto generation ----------------------------------------------------------

// Render a fidel glyph onto a canvas with random perturbations to simulate
// sloppy handwriting (offset, rotation, scale, thickness, shear).
// Returns a data URL.
function renderGlyphWithPerturbation(fidel, opts) {
  const o = Object.assign(
    { offsetX: 0, offsetY: 0, rotation: 0, scale: 1, thickness: 1, shear: 0 },
    opts
  );
  const size = 420;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, size, size);
  context.save();
  context.translate(size / 2 + o.offsetX, size / 2 + o.offsetY);
  context.rotate(o.rotation);
  context.scale(o.scale * o.shearX || o.scale, o.scale);
  context.transform(1, 0, o.shear, 1, 0, 0);
  context.fillStyle = '#111111';
  context.font = `${16 * o.thicknessNormalized || 16}rem "Noto Sans Ethiopic", "Nyala", "Kefa", "Abyssinica SIL", serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(fidel, 0, 0);
  context.restore();
  return canvas.toDataURL('image/png');
}

// A random perturbation for a "correct but sloppy" drawing.
function randomCorrectPerturbation() {
  return {
    offsetX: (Math.random() * 2 - 1) * 30,
    offsetY: (Math.random() * 2 - 1) * 30,
    rotation: (Math.random() * 2 - 1) * 0.12,
    scale: 0.75 + Math.random() * 0.5,
    shearX: 1,
    shear: (Math.random() * 2 - 1) * 0.08,
    thicknessNormalized: 0.9 + Math.random() * 0.4
  };
}

// A random "scribble" for an obviously-wrong drawing.
function renderScribble() {
  const size = 420;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, size, size);
  context.strokeStyle = '#111111';
  context.lineWidth = 10 + Math.random() * 8;
  context.lineCap = 'round';
  const strokes = 2 + Math.floor(Math.random() * 4);
  for (let s = 0; s < strokes; s += 1) {
    const cx = size / 2 + (Math.random() * 2 - 1) * 120;
    const cy = size / 2 + (Math.random() * 2 - 1) * 120;
    const angle = Math.random() * Math.PI * 2;
    const len = 60 + Math.random() * 160;
    context.beginPath();
    context.moveTo(cx, cy);
    context.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    context.stroke();
  }
  // A dot or a small loop.
  if (Math.random() < 0.5) {
    context.beginPath();
    context.arc(size / 2, size / 2, 10 + Math.random() * 20, 0, Math.PI * 2);
    context.fill();
  }
  return canvas.toDataURL('image/png');
}

// Generate one auto card. Returns a card object used by the grid.
// Validates the drawing against the draw-page comparison so the suggested
// label matches what the draw page would accept/reject.
async function generateAutoCard() {
  const n = currentCharacterBank.length;
  if (n === 0) return null;
  const expected = currentCharacterBank[Math.floor(Math.random() * n)];
  const reference = renderGlyphWithPerturbation(expected.fidel, {
    offsetX: 0, offsetY: 0, rotation: 0, scale: 1, shearX: 1, shear: 0, thicknessNormalized: 1
  });

  const isCorrect = Math.random() < 0.5;
  let drawing;
  let shownFidel = expected.fidel;
  let suggestedLabel = isCorrect ? 'correct' : 'incorrect';

  if (isCorrect) {
    drawing = renderGlyphWithPerturbation(expected.fidel, randomCorrectPerturbation());
  } else if (Math.random() < 0.6) {
    const wrong = currentCharacterBank[Math.floor(Math.random() * n)];
    const wrongFidel = wrong.fidel === expected.fidel
      ? currentCharacterBank[(Math.floor(Math.random() * n) + 1) % n].fidel
      : wrong.fidel;
    shownFidel = wrongFidel;
    drawing = renderGlyphWithPerturbation(wrongFidel, randomCorrectPerturbation());
  } else {
    drawing = renderScribble();
  }

  // Validate the drawing against the reference using the same lenient logic
  // as the draw page (dilation + chamfer distance on 12x12 grids).
  const comparison = F.compare(drawing, reference);
  if (isCorrect && comparison.verdict !== 'match') {
    return null;
  }
  if (!isCorrect && comparison.verdict === 'match') {
    return null;
  }

  return {
    id: `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    expected: expected.fidel,
    expectedLatin: expected.latin,
    drawing,
    reference,
    shownFidel,
    label: suggestedLabel,
    skipped: false
  };
}

function renderAutoGrid() {
  autoGrid.innerHTML = '';
  autoCards.forEach((card, index) => {
    const cell = document.createElement('div');
    cell.className = 'auto-card';

    const preview = document.createElement('canvas');
    preview.className = 'auto-preview';
    preview.width = 140;
    preview.height = 140;
    const pctx = preview.getContext('2d');
    const img = new Image();
    img.onload = () => pctx.drawImage(img, 0, 0, 140, 140);
    img.src = card.drawing;
    cell.appendChild(preview);

    const meta = document.createElement('div');
    meta.className = 'auto-meta';
    meta.innerHTML = `Expected: <strong>${card.expected}</strong> (${card.expectedLatin})`;
    cell.appendChild(meta);

    const suggested = document.createElement('div');
    suggested.className = `auto-suggested ${card.label}`;
    suggested.textContent = card.skipped ? 'Skipped' : `Suggested: ${card.label}`;
    cell.appendChild(suggested);

    const controls = document.createElement('div');
    controls.className = 'auto-controls';

    const correctBtn2 = document.createElement('button');
    correctBtn2.className = 'tool-btn';
    correctBtn2.textContent = '✓ Correct';
    correctBtn2.addEventListener('click', () => {
      card.label = 'correct';
      card.skipped = false;
      renderAutoGrid();
    });

    const incorrectBtn2 = document.createElement('button');
    incorrectBtn2.className = 'tool-btn';
    incorrectBtn2.textContent = '✗ Incorrect';
    incorrectBtn2.addEventListener('click', () => {
      card.label = 'incorrect';
      card.skipped = false;
      renderAutoGrid();
    });

    const skipBtn2 = document.createElement('button');
    skipBtn2.className = 'tool-btn';
    skipBtn2.textContent = 'Skip';
    skipBtn2.addEventListener('click', () => {
      card.skipped = true;
      renderAutoGrid();
    });

    controls.appendChild(correctBtn2);
    controls.appendChild(incorrectBtn2);
    controls.appendChild(skipBtn2);
    cell.appendChild(controls);

    autoGrid.appendChild(cell);
  });

  const anyLabelable = autoCards.some((c) => !c.skipped);
  saveAutoBtn.disabled = !anyLabelable;
}

generateBtn.addEventListener('click', async () => {
  const count = Number.parseInt(batchSize.value, 10) || 25;
  autoCards = [];
  let attempts = 0;
  const maxAttempts = count * 5;
  while (autoCards.length < count && attempts < maxAttempts) {
    const card = await generateAutoCard();
    if (card) autoCards.push(card);
    attempts += 1;
  }
  renderAutoGrid();
});

cancelAutoBtn.addEventListener('click', () => {
  autoCards = [];
  renderAutoGrid();
});

saveAutoBtn.addEventListener('click', async () => {
  const toSave = autoCards.filter((c) => !c.skipped);
  if (toSave.length === 0) return;

  saveAutoBtn.disabled = true;
  saveAutoBtn.textContent = 'Saving…';
  let saved = 0;
  let failed = 0;

  for (const card of toSave) {
    try {
      await postSample(card.expected, card.drawing, card.reference, card.label, 'auto');
      saved += 1;
    } catch (_error) {
      failed += 1;
    }
  }

  saveAutoBtn.textContent = 'Save batch';
  saveAutoBtn.disabled = false;

  // Keep unsaved cards if there were failures, else clear.
  if (failed > 0) {
    autoCards = autoCards.filter((c) => c.skipped);
    renderAutoGrid();
    statusMessage.textContent = `Saved ${saved}, failed ${failed}.`;
    statusMessage.className = 'status error';
  } else {
    autoCards = [];
    renderAutoGrid();
    statusMessage.textContent = `Saved ${saved} samples.`;
    statusMessage.className = 'status success';
  }
});

// ---- Mode toggle ------------------------------------------------------------
function setMode(mode) {
  const isDraw = mode === 'draw';
  drawMode.hidden = !isDraw;
  autoMode.hidden = isDraw;
  batchRow.hidden = isDraw;
  drawModeBtn.classList.toggle('active', isDraw);
  autoModeBtn.classList.toggle('active', !isDraw);
}

drawModeBtn.addEventListener('click', () => setMode('draw'));
autoModeBtn.addEventListener('click', () => setMode('auto'));

// ---- Init -------------------------------------------------------------------
async function init() {
  await loadCharacterBank();
  await loadRandomCharacter();
}

init();
