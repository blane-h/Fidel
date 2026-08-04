// features.js
// Shared feature extraction for the drawing-correctness model.
// Produces a fixed-length feature vector from a drawing and its reference glyph,
// so the same code is used for labeling (train page) and inference (draw page).
//
// The feature vector is 436-dimensional:
//   - 144  : 12x12 normalized binary ink grid of the drawing
//   - 144  : 12x12 normalized binary ink grid of the reference glyph
//   - 144  : 12x12 distance transform (chamfer) of the reference shape
//   -   4  : scalar metrics (overlap, chamfer shape, ink coverage, bbox aspect)
//
// All functions are pure and dependency-free so they can run in the browser and
// (conceptually) on the server. The grid size is 12 to keep the vector small
// while still capturing the gross shape of a fidel.

(function (global) {
  'use strict';

  const GRID_SIZE = 12;

  function inkPixelAt(data, width, x, y) {
    const index = (y * width + x) * 4;
    const alpha = data[index + 3];
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    return alpha > 60 && r < 200 && g < 200 && b < 200;
  }

  function toBinaryGrid(dataUrl, size) {
    const target = size || GRID_SIZE;
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      canvas.width = target;
      canvas.height = target;
      const ctx = canvas.getContext('2d');
      const grid = new Uint8Array(target * target);
      img.onload = () => {
        ctx.clearRect(0, 0, target, target);
        ctx.drawImage(img, 0, 0, target, target);
        const imageData = ctx.getImageData(0, 0, target, target);
        for (let y = 0; y < target; y += 1) {
          for (let x = 0; x < target; x += 1) {
            grid[y * target + x] = inkPixelAt(imageData.data, target, x, y) ? 1 : 0;
          }
        }
        resolve(grid);
      };
      img.onerror = () => resolve(new Uint8Array(target * target));
      img.src = dataUrl;
    });
  }

  function normalizeGrid(grid, size) {
    const target = size || GRID_SIZE;
    let minX = target;
    let minY = target;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < target; y += 1) {
      for (let x = 0; x < target; x += 1) {
        if (grid[y * target + x] === 1) {
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
    const targetBox = Math.round(target * 0.8);
    const scale = Math.min(targetBox / inkW, targetBox / inkH);
    const scaledW = Math.max(1, Math.round(inkW * scale));
    const scaledH = Math.max(1, Math.round(inkH * scale));
    const offsetX = Math.floor((target - scaledW) / 2);
    const offsetY = Math.floor((target - scaledH) / 2);

    const normalized = new Uint8Array(target * target);
    for (let y = 0; y < scaledH; y += 1) {
      for (let x = 0; x < scaledW; x += 1) {
        const srcX = minX + Math.min(inkW - 1, Math.floor(x / scale));
        const srcY = minY + Math.min(inkH - 1, Math.floor(y / scale));
        if (grid[srcY * target + srcX] === 1) {
          normalized[(offsetY + y) * target + (offsetX + x)] = 1;
        }
      }
    }

    return normalized;
  }

  function dilate(grid, radius, size) {
    const target = size || GRID_SIZE;
    const r = radius || 1;
    const out = new Uint8Array(target * target);
    for (let y = 0; y < target; y += 1) {
      for (let x = 0; x < target; x += 1) {
        if (grid[y * target + x] === 1) {
          for (let dy = -r; dy <= r; dy += 1) {
            for (let dx = -r; dx <= r; dx += 1) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < target && ny >= 0 && ny < target) {
                out[ny * target + nx] = 1;
              }
            }
          }
        }
      }
    }
    return out;
  }

  function distanceTransform(grid, size) {
    const target = size || GRID_SIZE;
    const dist = new Float32Array(target * target);
    const INF = 1e9;

    for (let i = 0; i < target * target; i += 1) {
      dist[i] = grid[i] === 1 ? 0 : INF;
    }

    for (let y = 0; y < target; y += 1) {
      for (let x = 0; x < target; x += 1) {
        const idx = y * target + x;
        if (dist[idx] === 0) continue;
        if (y > 0) dist[idx] = Math.min(dist[idx], dist[idx - target] + 1);
        if (x > 0) dist[idx] = Math.min(dist[idx], dist[idx - 1] + 1);
        if (y > 0 && x > 0) dist[idx] = Math.min(dist[idx], dist[idx - target - 1] + 1.4142);
        if (y > 0 && x < target - 1) dist[idx] = Math.min(dist[idx], dist[idx - target + 1] + 1.4142);
      }
    }

    for (let y = target - 1; y >= 0; y -= 1) {
      for (let x = target - 1; x >= 0; x -= 1) {
        const idx = y * target + x;
        if (y < target - 1) dist[idx] = Math.min(dist[idx], dist[idx + target] + 1);
        if (x < target - 1) dist[idx] = Math.min(dist[idx], dist[idx + 1] + 1);
        if (y < target - 1 && x < target - 1) dist[idx] = Math.min(dist[idx], dist[idx + target + 1] + 1.4142);
        if (y < target - 1 && x > 0) dist[idx] = Math.min(dist[idx], dist[idx + target - 1] + 1.4142);
      }
    }

    return dist;
  }

  function distanceSimilarity(drawing, reference, size) {
    const target = size || GRID_SIZE;
    const dist = distanceTransform(reference, target);
    const tolerance = 1.5;
    let covered = 0;
    let total = 0;
    for (let i = 0; i < target * target; i += 1) {
      if (drawing[i] === 1) {
        total += 1;
        if (dist[i] <= tolerance) covered += 1;
      }
    }
    return total === 0 ? 0 : covered / total;
  }

  function binarySimilarity(a, b, size) {
    const target = size || GRID_SIZE;
    let same = 0;
    let total = 0;
    for (let i = 0; i < target * target; i += 1) {
      if (a[i] === 1 || b[i] === 1) {
        same += a[i] === b[i] ? 1 : 0;
        total += 1;
      }
    }
    return total === 0 ? 0 : same / total;
  }

  function scalarMetrics(drawing, reference, size) {
    const target = size || GRID_SIZE;
    let ink = 0;
    let minX = target, minY = target, maxX = -1, maxY = -1;
    for (let y = 0; y < target; y += 1) {
      for (let x = 0; x < target; x += 1) {
        if (drawing[y * target + x] === 1) {
          ink += 1;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const coverage = ink / (target * target);
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const aspect = bw === 0 || bh === 0 ? 0 : Math.min(bw, bh) / Math.max(bw, bh);

    const dilatedDrawing = dilate(drawing, 1, target);
    const dilatedReference = dilate(reference, 1, target);
    const overlap = binarySimilarity(dilatedDrawing, dilatedReference, target);
    const shape = distanceSimilarity(dilatedDrawing, dilatedReference, target);

    return [overlap, shape, coverage, aspect];
  }

  async function buildFeatures(drawingDataUrl, referenceDataUrl) {
    const size = GRID_SIZE;
    const [rawDrawing, rawReference] = await Promise.all([
      toBinaryGrid(drawingDataUrl, size),
      toBinaryGrid(referenceDataUrl, size)
    ]);
    const drawing = normalizeGrid(rawDrawing, size);
    const reference = normalizeGrid(rawReference, size);
    const refDist = distanceTransform(reference, size);

    const vector = new Float32Array(GRID_SIZE * GRID_SIZE * 3 + 4);
    let idx = 0;
    for (let i = 0; i < drawing.length; i += 1) vector[idx++] = drawing[i];
    for (let i = 0; i < reference.length; i += 1) vector[idx++] = reference[i];
    for (let i = 0; i < refDist.length; i += 1) vector[idx++] = refDist[i];

    const metrics = scalarMetrics(drawing, reference, size);
    for (let i = 0; i < metrics.length; i += 1) vector[idx++] = metrics[i];

    return {
      vector,
      gridSize: size,
      drawingGrid: drawing,
      referenceGrid: reference,
      refDist,
      metrics
    };
  }

  function buildFeaturesSync(drawingDataUrl, referenceDataUrl) {
    const size = GRID_SIZE;
    const rawDrawing = toBinaryGridSync(drawingDataUrl, size);
    const rawReference = toBinaryGridSync(referenceDataUrl, size);
    const drawing = normalizeGrid(rawDrawing, size);
    const reference = normalizeGrid(rawReference, size);
    const refDist = distanceTransform(reference, size);

    const vector = new Float32Array(GRID_SIZE * GRID_SIZE * 3 + 4);
    let idx = 0;
    for (let i = 0; i < drawing.length; i += 1) vector[idx++] = drawing[i];
    for (let i = 0; i < reference.length; i += 1) vector[idx++] = reference[i];
    for (let i = 0; i < refDist.length; i += 1) vector[idx++] = refDist[i];

    const metrics = scalarMetrics(drawing, reference, size);
    for (let i = 0; i < metrics.length; i += 1) vector[idx++] = metrics[i];

    return {
      vector,
      gridSize: size,
      drawingGrid: drawing,
      referenceGrid: reference,
      refDist,
      metrics
    };
  }

  function toBinaryGridSync(dataUrl, size) {
    const target = size || GRID_SIZE;
    const img = new Image();
    const canvas = document.createElement('canvas');
    canvas.width = target;
    canvas.height = target;
    const ctx = canvas.getContext('2d');
    const grid = new Uint8Array(target * target);
    img.onload = () => {
      ctx.clearRect(0, 0, target, target);
      ctx.drawImage(img, 0, 0, target, target);
      const imageData = ctx.getImageData(0, 0, target, target);
      for (let y = 0; y < target; y += 1) {
        for (let x = 0; x < target; x += 1) {
          grid[y * target + x] = inkPixelAt(imageData.data, target, x, y) ? 1 : 0;
        }
      }
    };
    img.src = dataUrl;
    return grid;
  }

  // Lenient comparison tuned for 12x12 grids, aligned with the draw page's
  // dilation + chamfer logic but scaled for the smaller resolution.
  // Returns { verdict: 'match' | 'no-match' | null, overlap, shape }.
  async function compare(drawingDataUrl, referenceDataUrl) {
    const size = GRID_SIZE;
    const [rawDrawing, rawReference] = await Promise.all([
      toBinaryGrid(drawingDataUrl, size),
      toBinaryGrid(referenceDataUrl, size)
    ]);
    const drawing = normalizeGrid(rawDrawing, size);
    const reference = normalizeGrid(rawReference, size);
    const dilatedDrawing = dilate(drawing, 1, size);
    const dilatedReference = dilate(reference, 1, size);
    const overlap = binarySimilarity(dilatedDrawing, dilatedReference, size);
    const shape = distanceSimilarity(dilatedDrawing, dilatedReference, size);

    if (overlap >= 0.35 || shape >= 0.50) {
      return { verdict: 'match', overlap, shape };
    }
    if (overlap <= 0.15 && shape <= 0.25) {
      return { verdict: 'no-match', overlap, shape };
    }
    return { verdict: null, overlap, shape };
  }

  const FEATURE_COUNT = GRID_SIZE * GRID_SIZE * 3 + 4;

  const api = {
    GRID_SIZE,
    FEATURE_COUNT,
    toBinaryGrid,
    buildFeatures,
    buildFeaturesSync,
    toBinaryGridSync,
    normalizeGrid,
    dilate,
    distanceTransform,
    distanceSimilarity,
    binarySimilarity,
    scalarMetrics,
    compare
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.FidelFeatures = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
