# Plan: First four spell words use exactly 1, 2, 3, 4 answer rows

## Goal
The first four words shown in the mobile spell page must render in exactly 1, 2, 3, and 4 answer rows respectively.

## Context
- `mobile-app.js` renders answer slots with `slotsPerRow = 5`.
- Rows are calculated as `Math.ceil(amharic.length / 5)`.
- Words are currently loaded via `fetchRandomWord()` / `fetchLongestWord()` from `/api/words/random` and `/api/words/longest`.

## Decision: Filter by Amharic length
Target lengths for the first four words:
- Word 1: 1–5 characters → 1 row
- Word 2: 6–10 characters → 2 rows
- Word 3: 11–15 characters → 3 rows
- Word 4: 16–20 characters → 4 rows

## Implementation steps

1. **Add length filtering to `/api/words/random` in `server.js`**
   - Accept optional `minLength` and `maxLength` query params.
   - Apply `LENGTH(amharic) >= ?` / `LENGTH(amharic) <= ?` to the SQL query.

2. **Add length filtering to `/api/words/random` in `app.py`**
   - Same query param handling as the Node server.

3. **Update `fetchRandomWord` in `public/mobile-common.js`**
   - Accept optional `minLength` and `maxLength` arguments.
   - Append them as query parameters to the request URL.

4. **Update `loadWord` in `public/mobile-app.js`**
   - Replace the `firstLoad` longest-word behavior with length-constrained fetches.
   - Track a `wordLoadIndex` counter.
   - For the first four loads, compute `minLen = wordLoadIndex * 5 + 1` and `maxLen = (wordLoadIndex + 1) * 5`.
   - Retry up to a small limit (e.g., 10) if the returned word falls outside the target length.
   - Increment `wordLoadIndex` after each successful load.

## Risks / edge cases
- If the database lacks words in a target length range, the client will exhaust retries and accept whatever is returned. No error is thrown.
- The `specialWordRequestCount` counter on the server still advances on each call; this is acceptable because length filtering only limits the candidate set.

## Validation
- Run the server, open the mobile spell page, and confirm the first four words display in 1, 2, 3, and 4 rows respectively.
- Subsequent words should continue to load normally with no length constraint.
