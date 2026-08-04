# Fidel

Prototype for learning Amharic fidel. Includes a Spell mode and a Draw mode.

## Run locally

```bash
npm install
npm start
```

Open http://localhost:3000.

## Draw mode

The Draw page (`/draw.html`) lets users draw a single Amharic fidel character on a
canvas and uses Google Gemini's vision API to recognize whether the drawing matches
the expected character. The recognition is intentionally lenient to accept imperfect
handwriting.

### Setup Gemini API key

The image recognition requires a Gemini API key. Provide it via the `GEMINI_API_KEY`
environment variable:

```bash
GEMINI_API_KEY=your-key-here npm start
```

Or set the value in the `.env` file (the server loads it automatically via `dotenv`).
The `.env` file is gitignored.

The server uses a list of Gemini models (`gemini-2.0-flash`, `gemini-2.0-flash-lite`,
`gemini-1.5-flash`) and automatically falls back to the next model when one is
rate-limited / quota exceeded. Identical submissions are cached in memory for a while,
so repeated checks of the same drawing don't re-call the API.

The Draw page also runs a **local fast-path**: it compares the drawing against the expected
glyph directly in the browser. Obvious correct drawings are accepted and obvious wrong ones
are rejected **without calling Gemini at all**, which saves API quota. Only ambiguous
drawings are sent to the server for Gemini recognition. Images are downscaled before
sending to reduce payload size, and a short cooldown prevents rapid duplicate submissions.

To keep the local comparison fair to a learner's handwriting, the drawing and the reference
glyph are both **normalized** (centered and scaled to a fixed size) before being compared, so
an off-center or differently-sized drawing is not unfairly penalized. Both images are then
**dilated** by a pixel so normal nib thickness and minor pen wobble still overlap, and the
comparison uses two complementary metrics:
- a **pixel-overlap** (normalized XOR) similarity, and
- a **Chamfer distance-based shape similarity** that measures how close each drawing pixel is
  to the reference shape (tolerant of wobble, uneven stroke thickness, and minor offset).

A drawing is accepted locally when **either** metric is confidently high (indicating the
relative shape is correct), and rejected locally only when **both** metrics are clearly low
(obviously a different shape or scribble). Everything in between is sent to Gemini for a real
identity judgment, so a similar-looking-but-different fidel is still correctly rejected. The
overlap and shape scores are logged to the browser console for tuning.

The Gemini prompt is written to be **tolerant of penmanship** (wobble, uneven stroke weight,
imperfect proportions, small tilt) but **strict about character identity** (a different fidel,
missing/extra distinguishing features, or an unreadable scribble is rejected). The model also
returns a `confidence` score in the response for future calibration.

If the API key is missing or all models are exhausted, the endpoint returns a friendly
"quota exceeded" message so the user is informed rather than silently failing.

Without a key, the Draw page will still work for obvious cases via the local fast-path,
but ambiguous drawings will report that the API is unavailable.
