# Fidel Deploy Fix Tasks

## Root Causes
- `app.py` base64 regex uses `\\w+` in a raw string → the `data:image/png;base64,` prefix is NOT stripped → Gemini gets invalid base64 and rejects every submission (deployed site marks nothing correct).
- `model/weights.json` contains all-`null` weights → Python `ml/model.py` loads them as NaN → `model.predict()` returns NaN → `/api/draw/check` crashes with "only 0-dimensional arrays can be converted to Python scalars".

## Steps
- [x] Analyze error logs and compare Flask (`app.py`) vs Node (`server.js`) implementations.
- [x] Fix `app.py` base64 regex: `r'^data:image/\\w+;base64,'` → `r'^data:image/\w+;base64,'` (both `base64_data` and `reference_base64`).
- [x] Harden `app.py` `/api/draw/check` so a non-finite model prediction falls back to "require Gemini" instead of crashing.
- [x] Harden `ml/model.py` `load_model()` to validate weights and return `None` when weights are null/NaN (fall back to local+Gemini).
- [x] Harden `ml/model.py` `forward()` to safely extract the scalar output.
- [x] Verify changes (syntax OK, load_model returns None on corrupt weights, base64 prefix correctly stripped).

