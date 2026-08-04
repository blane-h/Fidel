# TODO — Trainable drawing correctness model

Goal: Replace hardcoded local-compare thresholds in the draw checker with a
small neural network trained on labeled samples. Gemini becomes a fallback for
ambiguous predictions.

## 1. Shared feature extraction — `public/features.js`
- [x] 12x12 normalized binary grid of drawing (144)
- [x] 12x12 normalized binary grid of reference glyph (144)
- [x] 12x12 distance-transform of reference shape (144)
- [x] Scalar metrics: overlap, chamfer shape, ink coverage, bbox aspect (4)
- [x] Total 436-dim feature vector; reuse normalize/dilate/distance logic

## 2. Temporary labeling page — `public/train.html` + `public/train.js`
- [x] Draw mode: random fidel, canvas, Correct/Incorrect/Skip buttons
- [x] Auto-provide mode: generate perturbed correct + wrong drawings, batch label
- [x] Post each labeled sample (features, expected, label, image) to server
- [x] Batch size selector (10/25/50)

## 3. Persistence — SQLite `drawing_samples` table (server.js)
- [x] Create table: expected, features JSON, label, image, source, timestamp
- [x] Endpoint POST /api/train/sample
- [x] Endpoint GET /api/train/stats
- [x] Endpoint POST /api/train/clear

## 4. Small NN — `ml/model.js` (pure JS, no deps)
- [x] Architecture: 436 -> 24 tanh -> 1 sigmoid
- [x] Binary cross-entropy + Adam + L2, train/validation split, early stopping
- [x] save/load weights to `model/weights.json` (gitignored)

## 5. Server endpoints (server.js)
- [x] POST /api/model/train — train + save, return metrics + threshold
- [x] GET /api/model/info — status, sample count, accuracy
- [x] POST /api/draw/check — NN first, Gemini fallback on ambiguity

## 6. Wire the draw page — `public/draw.js`/`draw.html`
- [x] Include features.js; compute feature vector on submit
- [x] Call /api/draw/check; fall back to current local thresholds + Gemini if no model

## 7. Housekeeping
- [x] styles.css — train page styling + nav Train link
- [x] .gitignore — model/weights.json
- [x] README.md + TODO-drawing-leniency.md — document workflow

## Testing
- [x] node --check on all new JS files
- [ ] Start server, label batch on /train.html, train model
- [ ] Verify /draw.html sloppy-correct passes, similar-wrong fails, existing false/similar cases
