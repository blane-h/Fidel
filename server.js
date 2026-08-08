const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const rateLimit = require('express-rate-limit');
const sqlite3 = require('sqlite3').verbose();
const { trainModel, saveModel, loadModel } = require('./ml/model');

// Load environment variables from .env first, then fall back to .env.example.
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.example'), override: false });

const app = express();
const port = process.env.PORT || 3000;
const targetWordCount = 1000;
const kaikkiWordListUrl = 'https://kaikki.org/dictionary/Amharic/words/kaikki.org-dictionary-Amharic-words.jsonl';
let specialWordRequestCount = 0;
const specialWordChars = ['ጸ', 'ፀ', 'ሀ', 'ሐ'];

// TODO: Add your Gemini API key here or via the GEMINI_API_KEY environment variable.
// Example: GEMINI_API_KEY=your-key-here npm start
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
// Ordered list of models. When one is rate-limited / quota exceeded, we try the next.
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash'
];
// Simple in-memory result cache to avoid re-calling Gemini for identical submissions.
const recognizeCache = new Map();
const MAX_CACHE_SIZE = 500;

function simpleHash(input) {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return String(hash >>> 0);
}

// Try each Gemini model in order. On quota/rate-limit, move to the next model.
// Throws with error.quota = true only if ALL models are rate-limited.
async function generateWithGemini(parts) {
  let lastError = null;
  let imageInputUnsupportedCount = 0;

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[gemini] model=${model} status=${response.status} body=${errorText.slice(0, 500)}`);
        const quotaExceeded = /quota|429|rate.?limit|resource exhausted/i.test(errorText);
        if (quotaExceeded) {
          lastError = new Error('Gemini quota exceeded');
          lastError.quota = true;
          continue;
        }
        const unsupportedImage = /does not support.*image|image.*not supported|cannot read.*image|image input is not supported/i.test(errorText);
        if (unsupportedImage) {
          imageInputUnsupportedCount += 1;
          lastError = new Error('Gemini model does not support image input');
          lastError.imageInputUnsupported = true;
          continue;
        }
        const requestError = new Error(`Gemini request failed: ${errorText.slice(0, 300)}`);
        requestError.status = response.status;
        throw requestError;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleaned = String(text).replace(/```(?:json)?/gi, '').trim();
      const match = /"match"\s*:\s*true/i.test(cleaned);
      // Parse the optional confidence score (0-1) the model may return.
      const confidenceMatch = cleaned.match(/"confidence"\s*:\s*([0-9]*\.?[0-9]+)/i);
      const confidence = confidenceMatch
        ? Math.max(0, Math.min(1, Number.parseFloat(confidenceMatch[1])))
        : null;
      return { match, confidence, model };
    } catch (error) {
      if (error && error.quota) {
        lastError = error;
        continue;
      }
      if (error && error.status === 404) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  if (imageInputUnsupportedCount === GEMINI_MODELS.length) {
    const err = new Error('All Gemini models do not support image input.');
    err.imageInputUnsupported = true;
    throw err;
  }

  const err = lastError || new Error('All Gemini models failed.');
  err.geminiUnavailable = true;
  throw err;
}

const vowelSuffixes = ['a', 'u', 'i', 'a', 'e', 'e', 'o'];
const latinFamilies = [
  'ha', 'la', 'ha', 'ma', 'sa', 'ra', 'sa', 'sha', 'qa', 'ba', 'ta', 'cha', 'ha', 'na', 'nya',
  'a', 'ka', 'kha', 'wa', 'a', 'za', 'zha', 'ya', 'da', 'ja', 'ga', 'ta', 'cha', 'pa', 'sa', 'sa', 'fa', 'pa', 'va'
];

const consonantFamilies = [
  ['ሀ', 'ሁ', 'ሂ', 'ሃ', 'ሄ', 'ህ', 'ሆ'],
  ['ለ', 'ሉ', 'ሊ', 'ላ', 'ሌ', 'ል', 'ሎ'],
  ['ሐ', 'ሑ', 'ሒ', 'ሓ', 'ሔ', 'ሕ', 'ሖ'],
  ['መ', 'ሙ', 'ሚ', 'ማ', 'ሜ', 'ም', 'ሞ'],
  ['ሠ', 'ሡ', 'ሢ', 'ሣ', 'ሤ', 'ሥ', 'ሦ'],
  ['ረ', 'ሩ', 'ሪ', 'ራ', 'ሬ', 'ር', 'ሮ'],
  ['ሰ', 'ሱ', 'ሲ', 'ሳ', 'ሴ', 'ስ', 'ሶ'],
  ['ሸ', 'ሹ', 'ሺ', 'ሻ', 'ሼ', 'ሽ', 'ሾ'],
  ['ቀ', 'ቁ', 'ቂ', 'ቃ', 'ቄ', 'ቅ', 'ቆ'],
  ['በ', 'ቡ', 'ቢ', 'ባ', 'ቤ', 'ብ', 'ቦ'],
  ['ተ', 'ቱ', 'ቲ', 'ታ', 'ቴ', 'ት', 'ቶ'],
  ['ቸ', 'ቹ', 'ቺ', 'ቻ', 'ቼ', 'ች', 'ቾ'],
  ['ኀ', 'ኁ', 'ኂ', 'ኃ', 'ኄ', 'ኅ', 'ኆ'],
  ['ነ', 'ኑ', 'ኒ', 'ና', 'ኔ', 'ን', 'ኖ'],
  ['ኘ', 'ኙ', 'ኚ', 'ኛ', 'ኜ', 'ኝ', 'ኞ'],
  ['አ', 'ኡ', 'ኢ', 'ኣ', 'ኤ', 'እ', 'ኦ'],
  ['ከ', 'ኩ', 'ኪ', 'ካ', 'ኬ', 'ክ', 'ኮ'],
  ['ኸ', 'ኹ', 'ኺ', 'ኻ', 'ኼ', 'ኽ', 'ኾ'],
  ['ወ', 'ዉ', 'ዊ', 'ዋ', 'ዌ', 'ው', 'ዎ'],
  ['ዐ', 'ዑ', 'ዒ', 'ዓ', 'ዔ', 'ዕ', 'ዖ'],
  ['ዘ', 'ዙ', 'ዚ', 'ዛ', 'ዜ', 'ዝ', 'ዞ'],
  ['ዠ', 'ዡ', 'ዢ', 'ዣ', 'ዤ', 'ዥ', 'ዦ'],
  ['የ', 'ዩ', 'ዪ', 'ያ', 'ዬ', 'ይ', 'ዮ'],
  ['ደ', 'ዱ', 'ዲ', 'ዳ', 'ዴ', 'ድ', 'ዶ'],
  ['ጀ', 'ጁ', 'ጂ', 'ጃ', 'ጄ', 'ጅ', 'ጆ'],
  ['ገ', 'ጉ', 'ጊ', 'ጋ', 'ጌ', 'ግ', 'ጎ'],
  ['ጠ', 'ጡ', 'ጢ', 'ጣ', 'ጤ', 'ጥ', 'ጦ'],
  ['ጨ', 'ጩ', 'ጪ', 'ጫ', 'ጬ', 'ጭ', 'ጮ'],
  ['ጰ', 'ጱ', 'ጲ', 'ጳ', 'ጴ', 'ጵ', 'ጶ'],
  ['ጸ', 'ጹ', 'ጺ', 'ጻ', 'ጼ', 'ጽ', 'ጾ'],
  ['ፀ', 'ፁ', 'ፂ', 'ፃ', 'ፄ', 'ፅ', 'ፆ'],
  ['ፈ', 'ፉ', 'ፊ', 'ፋ', 'ፌ', 'ፍ', 'ፎ'],
  ['ፐ', 'ፑ', 'ፒ', 'ፓ', 'ፔ', 'ፕ', 'ፖ'],
  ['ቨ', 'ቩ', 'ቪ', 'ቫ', 'ቬ', 'ቭ', 'ቮ']
];

const dbPath = path.join(__dirname, 'fidel.db');
const db = new sqlite3.Database(dbPath);

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function runCallback(err) {
      if (err) {
        reject(err);
        return;
      }

      resolve(this);
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows);
    });
  });
}

function isAmharicScript(word) {
  return typeof word === 'string' && /^[\u1200-\u137F]+$/u.test(word);
}

function pickRomanizedPrompt(entry) {
  const romanizedForm = entry.forms?.find((form) => form?.tags?.includes('romanization') && form.form)?.form;
  if (romanizedForm) {
    return romanizedForm;
  }

  const romanField = entry.forms?.find((form) => typeof form?.roman === 'string' && form.roman)?.roman;
  if (romanField) {
    return romanField;
  }

  const headTemplateRoman = entry.head_templates?.find((template) => template?.args?.tr)?.args?.tr;
  if (headTemplateRoman) {
    return headTemplateRoman;
  }

  const gloss = entry.senses?.[0]?.glosses?.[0];
  if (gloss) {
    return gloss;
  }

  return entry.word;
}

function pickEnglishTranslation(entry) {
  const gloss = entry.senses?.flatMap((sense) => sense?.glosses || []).find((value) => typeof value === 'string' && value.trim());
  if (gloss) {
    return gloss.trim();
  }

  return null;
}

function normalizePrompt(prompt) {
  return String(prompt || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeUniquePrompt(basePrompt, seenPrompts) {
  const normalizedPrompt = normalizePrompt(basePrompt) || 'Amharic word';
  let candidate = normalizedPrompt;
  let suffix = 2;

  while (seenPrompts.has(candidate)) {
    candidate = `${normalizedPrompt} ${suffix}`;
    suffix += 1;
  }

  seenPrompts.add(candidate);
  return candidate;
}

async function fetchRealAmharicWords(limit) {
  const response = await fetch(kaikkiWordListUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });

  if (!response.ok || !response.body) {
    throw new Error(`Unable to download word list (${response.status})`);
  }

  const words = [];
  const seenAmharic = new Set();
  const seenPrompts = new Set();
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let bufferedText = '';

  while (words.length < limit) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    bufferedText += decoder.decode(value, { stream: true });

    let newlineIndex = bufferedText.indexOf('\n');
    while (newlineIndex !== -1 && words.length < limit) {
      const line = bufferedText.slice(0, newlineIndex).trim();
      bufferedText = bufferedText.slice(newlineIndex + 1);
      newlineIndex = bufferedText.indexOf('\n');

      if (!line) {
        continue;
      }

      let entry;
      try {
        entry = JSON.parse(line);
      } catch (_error) {
        continue;
      }

      if (entry.lang_code !== 'am' || !isAmharicScript(entry.word) || !entry.senses?.length) {
        continue;
      }

      if (seenAmharic.has(entry.word)) {
        continue;
      }

      const prompt = makeUniquePrompt(pickRomanizedPrompt(entry), seenPrompts);
      const translation = pickEnglishTranslation(entry);
      const pronunciationSource = entry.sounds?.find((sound) => sound?.mp3_url || sound?.ogg_url)?.mp3_url
        || entry.sounds?.find((sound) => sound?.mp3_url || sound?.ogg_url)?.ogg_url
        || `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=am-ET&q=${encodeURIComponent(entry.word)}`;

      words.push({
        latin: prompt,
        amharic: entry.word,
        translation,
        pronunciation_source: pronunciationSource
      });
      seenAmharic.add(entry.word);
    }
  }

  if (words.length < limit) {
    throw new Error(`Only found ${words.length} real Amharic words`);
  }

  return words;
}

async function refreshWordBank() {
  const rows = await dbAll(
    `SELECT COUNT(*) AS count FROM words WHERE latin GLOB '*-[0-9][0-9][0-9][0-9]' OR latin GLOB '*-[0-9][0-9][0-9][0-9][0-9]'`
  );
  const hasGeneratedStudyWords = (rows?.[0]?.count ?? 0) > 0;
  const missingTranslationRow = await dbGet('SELECT COUNT(*) AS count FROM words WHERE translation IS NULL OR TRIM(translation) = ""');
  const hasMissingTranslations = (missingTranslationRow?.count ?? 0) > 0;

  if (!hasGeneratedStudyWords && !hasMissingTranslations) {
    const countRow = await dbGet('SELECT COUNT(*) AS count FROM words');
    if ((countRow?.count ?? 0) >= targetWordCount) {
      return { added: 0, total: countRow.count };
    }
  }

  const realWords = await fetchRealAmharicWords(targetWordCount);

  await dbRun('DELETE FROM words');
  const insert = db.prepare(
    'INSERT INTO words (latin, amharic, translation, pronunciation_source) VALUES (?, ?, ?, ?)'
  );

  for (const word of realWords) {
    insert.run(word.latin, word.amharic, word.translation, word.pronunciation_source);
  }

  await new Promise((resolve, reject) => {
    insert.finalize((err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });

  const updatedRow = await dbGet('SELECT COUNT(*) AS count FROM words');
  return { added: realWords.length, total: updatedRow?.count ?? realWords.length };
}

async function refreshCharacterBank() {
  const countRow = await dbGet('SELECT COUNT(*) AS count FROM characters');
  if ((countRow?.count ?? 0) === consonantFamilies.reduce((sum, family) => sum + family.length, 0)) {
    return { added: 0, total: countRow.count };
  }

  await dbRun('DELETE FROM characters');
  const insert = db.prepare(
    'INSERT INTO characters (fidel, latin, family) VALUES (?, ?, ?)'
  );

  consonantFamilies.forEach((family, familyIndex) => {
    const baseLatin = latinFamilies[familyIndex] || 'a';
    family.forEach((fidel, vowelIndex) => {
      const vowelSuffix = vowelSuffixes[vowelIndex] || '';
      const latin = `${baseLatin}${vowelSuffix !== 'a' ? vowelSuffix : ''}`;
      insert.run(fidel, latin, baseLatin);
    });
  });

  await new Promise((resolve, reject) => {
    insert.finalize((err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });

  const updatedRow = await dbGet('SELECT COUNT(*) AS count FROM characters');
  return { added: updatedRow?.count ?? 0, total: updatedRow?.count ?? 0 };
}

async function ensureColumn(tableName, columnName, columnDefinition) {
  const columns = await dbAll(`PRAGMA table_info(${tableName})`);
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    await dbRun(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
  }
}

async function downloadPronunciationAudio(audioUrl) {
  const response = await fetch(audioUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Pronunciation request failed with status ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    audio: Buffer.from(arrayBuffer),
    mimeType: response.headers.get('content-type') || 'audio/mpeg',
    source: audioUrl
  };
}

async function getFallbackPronunciationSource(amharicWord) {
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=am-ET&q=${encodeURIComponent(amharicWord)}`;
}

async function resolvePronunciationSource(wordRow) {
  if (wordRow.pronunciation_source) {
    return wordRow.pronunciation_source;
  }

  return getFallbackPronunciationSource(wordRow.amharic);
}

async function getOrCreatePronunciation(wordRow) {
  if (wordRow.pronunciation_audio) {
    return {
      audio: Buffer.isBuffer(wordRow.pronunciation_audio)
        ? wordRow.pronunciation_audio
        : Buffer.from(wordRow.pronunciation_audio),
      mimeType: wordRow.pronunciation_mime || 'audio/mpeg',
      source: wordRow.pronunciation_source
    };
  }

  const sourceUrl = await resolvePronunciationSource(wordRow);

  try {
    const pronunciation = await downloadPronunciationAudio(sourceUrl);
    await dbRun(
      `UPDATE words
       SET pronunciation_audio = ?, pronunciation_mime = ?, pronunciation_source = ?
       WHERE id = ?`,
      [pronunciation.audio, pronunciation.mimeType, pronunciation.source, wordRow.id]
    );

    return pronunciation;
  } catch (_error) {
    const fallbackSource = await getFallbackPronunciationSource(wordRow.amharic);
    const pronunciation = await downloadPronunciationAudio(fallbackSource);
    await dbRun(
      `UPDATE words
       SET pronunciation_audio = ?, pronunciation_mime = ?, pronunciation_source = ?
       WHERE id = ?`,
      [pronunciation.audio, pronunciation.mimeType, pronunciation.source, wordRow.id]
    );

    return pronunciation;
  }
}

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      latin TEXT NOT NULL UNIQUE,
      amharic TEXT NOT NULL,
      translation TEXT,
      pronunciation_audio BLOB,
      pronunciation_mime TEXT,
      pronunciation_source TEXT
    )
  `);

db.run(`
    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fidel TEXT NOT NULL,
      latin TEXT NOT NULL,
      family TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS drawing_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expected TEXT NOT NULL,
      features TEXT NOT NULL,
      label TEXT NOT NULL,
      image TEXT,
      source TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
});

function isMobileUserAgent(userAgent) {
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
  return mobileRegex.test(userAgent);
}

app.use((req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  if (isMobileUserAgent(ua)) {
    req.isMobile = true;
  }
  next();
});

app.get('/', (req, res) => {
  if (req.isMobile) return res.sendFile(path.join(__dirname, 'public', 'mobile-spell.html'));
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/study', (req, res) => {
  if (req.isMobile) return res.sendFile(path.join(__dirname, 'public', 'mobile-study.html'));
  return res.sendFile(path.join(__dirname, 'public', 'study.html'));
});

app.get('/draw', (req, res) => {
  if (req.isMobile) return res.sendFile(path.join(__dirname, 'public', 'mobile-draw.html'));
  return res.sendFile(path.join(__dirname, 'public', 'draw.html'));
});

app.get('/train', (_req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'train.html'));
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const wordsRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' }
});

app.get('/api/alphabet', (_req, res) => {
  res.json(
    consonantFamilies.map((family, familyIndex) => {
      const baseLatin = latinFamilies[familyIndex] || 'a';
      return {
        consonant: family[0],
        latin: baseLatin,
        vowels: family.map((fidel, vowelIndex) => {
          const vowelSuffix = vowelSuffixes[vowelIndex] || '';
          return {
            fidel,
            latin: `${baseLatin}${vowelSuffix !== 'a' ? vowelSuffix : ''}`
          };
        })
      };
    })
  );
});

app.get('/api/words/random', wordsRateLimiter, (_req, res) => {
  const useSpecialFilter = specialWordRequestCount < specialWordChars.length;
  const targetChar = specialWordChars[specialWordRequestCount] || null;
  specialWordRequestCount += 1;

  const query = useSpecialFilter && targetChar
    ? `SELECT
       id,
       latin,
       amharic,
       translation,
       CASE WHEN pronunciation_audio IS NOT NULL THEN 1 ELSE 0 END AS hasAudio
     FROM words
     WHERE amharic LIKE '%${targetChar}%'
     ORDER BY RANDOM()
     LIMIT 1`
    : `SELECT
       id,
       latin,
       amharic,
       translation,
       CASE WHEN pronunciation_audio IS NOT NULL THEN 1 ELSE 0 END AS hasAudio
     FROM words
     ORDER BY RANDOM()
     LIMIT 1`;

  db.get(query, (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to load word.' });
    }

    if (!row) {
      return res.status(404).json({ error: 'No words found.' });
    }

    return res.json(row);
  });
});

app.get('/api/words/:id/audio', wordsRateLimiter, (req, res) => {
  const wordId = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(wordId)) {
    return res.status(400).json({ error: 'Invalid word id.' });
  }

  db.get(
    'SELECT id, amharic, translation, pronunciation_audio, pronunciation_mime, pronunciation_source FROM words WHERE id = ?',
    [wordId],
    async (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Unable to load pronunciation.' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Pronunciation not found.' });
      }

      try {
        const pronunciation = await getOrCreatePronunciation(row);
        res.setHeader('Content-Type', pronunciation.mimeType || 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(pronunciation.audio);
      } catch (_error) {
        return res.status(404).json({ error: 'Pronunciation not found.' });
      }
    }
  );
});

app.get('/api/characters/audio', wordsRateLimiter, (req, res) => {
  const fidel = String(req.query.fidel || '').trim();
  if (!fidel) {
    return res.status(400).json({ error: 'Missing fidel.' });
  }

  const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=am-ET&q=${encodeURIComponent(fidel)}`;

  fetch(audioUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Pronunciation request failed: ${response.status}`);
      }
      return response.arrayBuffer().then((arrayBuffer) => {
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get('content-type') || 'audio/mpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(buffer);
      });
    })
    .catch(() => {
      res.status(404).json({ error: 'Pronunciation not available.' });
    });
});

app.get('/api/draw/random', (_req, res) => {
  db.get(
    'SELECT id, fidel, latin, family FROM characters ORDER BY RANDOM() LIMIT 1',
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Unable to load character.' });
      }

      if (!row) {
        return res.status(404).json({ error: 'No characters found.' });
      }

      return res.json(row);
    }
  );
});

const RECOGNIZE_PROMPT = (expected) => `You are an Amharic fidel (Ge'ez script) handwriting recognizer for a language-learning app. The learner drew a handwritten character. The expected character is "${expected}".

You are given TWO images:
1. The learner's drawing (the handwritten character to evaluate).
2. The REFERENCE image (the correct, expected fidel rendered as a clear glyph).

Amharic has MANY characters that look similar and differ only by small details (position of a head/loop, number of dots, a short diacritic stroke, the direction of a diagonal, a small tail, etc.). Your job is to judge whether the drawing is recognizably the SAME character as the reference, while being fair to a human learner's handwriting.

Be TOLERANT of normal handwriting variation. A drawing is still a match when the learner drew the correct character but with:
- wobble, uneven strokes, or slightly wobbly lines;
- uneven stroke thickness or different nib width than the reference;
- imperfect proportions, slightly compressed or stretched shapes;
- a small tilt or rotation, or rounded corners instead of sharp ones;
- the character drawn off-center or at a different size.

Be STRICT about the character's IDENTITY. It is NOT a match if the drawing is a DIFFERENT fidel:
- The drawing is another Amharic character that merely resembles the reference (e.g. differs in the number/position of dots, a missing or extra head/loop/tail, a wrong or missing diagonal/diacritic stroke, the wrong branch or branch direction, or the wrong orientation of a small element).
- The drawing is missing one of the reference fidel's key distinguishing features, or has an extra distinguishing feature that makes it read as a different character.
- The drawing is unreadable: a single dot, a single straight line, a simple squiggle, a random abstract shape, or any scribble that does not resemble the reference fidel.
- The drawing is incomplete or ambiguous such that a reader could not tell it is the reference fidel.

Rule of thumb: If a reasonable Amharic reader would read the drawing as the expected character, it is a match, even if the penmanship is sloppy. If the drawing would more likely be read as a DIFFERENT fidel (or anything else), it is not a match.

Return JSON with two fields:
1. "match": true if the drawing is recognizably the expected character, false otherwise.
2. "confidence": a number from 0 to 1 expressing how confident you are in your decision (1 = absolutely certain, 0 = no idea).

Only return the JSON object, nothing else.`;

app.post('/api/draw/recognize', async (req, res) => {
  const { image, reference, expected } = req.body || {};

  if (!image || !expected) {
    return res.status(400).json({ error: 'Missing image or expected character.' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'Gemini API key is not configured.',
      hint: 'Set the GEMINI_API_KEY environment variable.',
      expected
    });
  }

  const base64Data = String(image).replace(/^data:image\/\w+;base64,/, '');
  const referenceBase64 = reference ? String(reference).replace(/^data:image\/\w+;base64,/, '') : null;

  try {
    // Cache identical submissions to avoid re-calling Gemini.
    const cacheKey = simpleHash(`${base64Data}|${referenceBase64 || ''}|${expected}`);
    const cached = recognizeCache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const parts = [
      { text: RECOGNIZE_PROMPT(expected) },
      { inline_data: { mime_type: 'image/png', data: base64Data } }
    ];

    // If a reference image is provided, include it so Gemini can compare shapes.
    if (referenceBase64) {
      parts.push({ inline_data: { mime_type: 'image/png', data: referenceBase64 } });
    }

    const { match, confidence, model } = await generateWithGemini(parts);

    const result = { match, confidence, expected, model };
    recognizeCache.set(cacheKey, result);
    if (recognizeCache.size > MAX_CACHE_SIZE) {
      const oldestKey = recognizeCache.keys().next().value;
      recognizeCache.delete(oldestKey);
    }

    return res.json(result);
  } catch (error) {
    if (error && error.quota) {
      return res.status(503).json({
        error: 'Gemini is unavailable (quota exceeded). Please try again later.',
        expected
      });
    }
    const detail = error && error.message ? String(error.message) : '';
    console.error('[draw/recognize] Gemini error:', detail);
    if (error && error.imageInputUnsupported) {
      return res.json({
        match: null,
        confidence: null,
        expected,
        model: null,
        imageUnreadable: true,
        message: 'Gemini could not read the image (model does not support image input).'
      });
    }
    if (error && error.geminiUnavailable) {
      return res.json({
        match: null,
        confidence: null,
        expected,
        model: null,
        imageUnreadable: true,
        message: 'Gemini is currently unavailable. Using local comparison to make a best guess.'
      });
    }
    if (/does not support.*image|image.*not supported|cannot read.*image|image input is not supported/i.test(detail)) {
      return res.json({
        match: null,
        confidence: null,
        expected,
        model: null,
        imageUnreadable: true,
        message: 'Gemini could not read the image (model does not support image input).'
      });
    }
    return res.status(500).json({ error: 'Unable to recognize drawing.', detail });
  }
});

// ---- Trainable model endpoints --------------------------------------------

// Save a labeled drawing sample.
app.post('/api/train/sample', async (req, res) => {
  const { expected, features, label, image, source } = req.body || {};

  if (!expected || !features || !Array.isArray(features)) {
    return res.status(400).json({ error: 'Missing expected or features array.' });
  }
  if (label !== 'correct' && label !== 'incorrect') {
    return res.status(400).json({ error: 'label must be "correct" or "incorrect".' });
  }

  try {
    await dbRun(
      `INSERT INTO drawing_samples (expected, features, label, image, source)
       VALUES (?, ?, ?, ?, ?)`,
      [expected, JSON.stringify(features), label, image || null, source || 'manual']
    );
    const countRow = await dbGet('SELECT COUNT(*) AS count FROM drawing_samples');
    return res.json({ ok: true, total: countRow?.count ?? 0 });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to save sample.', detail: error.message });
  }
});

// Label counts by class and source.
app.get('/api/train/stats', async (_req, res) => {
  try {
    const rows = await dbAll(
      `SELECT label, source, COUNT(*) AS count
       FROM drawing_samples
       GROUP BY label, source`
    );
    const byLabel = { correct: 0, incorrect: 0 };
    const bySource = { manual: 0, auto: 0 };
    let total = 0;
    for (const row of rows) {
      byLabel[row.label] = (byLabel[row.label] || 0) + row.count;
      bySource[row.source] = (bySource[row.source] || 0) + row.count;
      total += row.count;
    }
    return res.json({ total, byLabel, bySource });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to read stats.', detail: error.message });
  }
});

// Wipe all labeled samples.
app.post('/api/train/clear', async (_req, res) => {
  try {
    await dbRun('DELETE FROM drawing_samples');
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to clear samples.', detail: error.message });
  }
});

// Train the neural network from all labeled samples.
app.post('/api/model/train', async (req, res) => {
  const options = req.body || {};
  try {
    const rows = await dbAll('SELECT expected, features, label FROM drawing_samples');
    if (rows.length < 2) {
      return res.status(400).json({ error: 'Not enough labeled samples to train.' });
    }

    const dataset = rows
      .filter((row) => row.label === 'correct' || row.label === 'incorrect')
      .map((row) => {
        let features;
        try {
          features = typeof row.features === 'string' ? JSON.parse(row.features) : row.features;
        } catch (_error) {
          return null;
        }
        if (!features || !features.length) {
          return null;
        }
        return { x: features.slice(), y: row.label === 'correct' ? 1 : 0 };
      })
      .filter(Boolean);

    if (dataset.length < 2) {
      return res.status(400).json({ error: 'No usable labeled samples found.' });
    }

    const result = trainModel(dataset, {
      epochs: Number(options.epochs) || 2000,
      learningRate: Number(options.learningRate) || 0.005,
      l2: Number(options.l2) || 1e-4,
      valFraction: Number(options.valFraction) || 0.15
    });

    saveModel(result.net, {
      threshold: result.threshold,
      sampleCount: result.sampleCount,
      trainAccuracy: result.train.accuracy,
      valAccuracy: result.val.accuracy,
      finalAccuracy: result.final.accuracy,
      architecture: 'mlp-436-24-1'
    });

    return res.json({
      trained: true,
      sampleCount: result.sampleCount,
      threshold: result.threshold,
      train: result.train,
      val: result.val,
      final: result.final
    });
  } catch (error) {
    return res.status(500).json({ error: 'Training failed.', detail: error.message });
  }
});

// Model status.
app.get('/api/model/info', async (_req, res) => {
  try {
    const countRow = await dbGet('SELECT COUNT(*) AS count FROM drawing_samples');
    const model = loadModel();
    return res.json({
      trained: Boolean(model),
      sampleCount: countRow?.count ?? 0,
      architecture: model ? 'mlp-436-24-1' : null,
      threshold: model && model.threshold != null ? model.threshold : null,
      metadata: model ? model.metadata : null
    });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to read model info.', detail: error.message });
  }
});

// New checker: run the trained model first, fall back to Gemini on ambiguity.
app.post('/api/draw/check', async (req, res) => {
  const { image, reference, expected, features } = req.body || {};

  if (!expected) {
    return res.status(400).json({ error: 'Missing expected character.' });
  }

  const model = loadModel();
  if (model && features && Array.isArray(features) && features.length === model.inputSize) {
    const probability = model.predict(features);
    const threshold = model.threshold != null ? model.threshold : 0.5;
    // Ambiguity band: if the model is highly confident one way, use it. Otherwise
    // defer to Gemini (identity-sensitive) when available.
    const AMBIGUITY_MARGIN = 0.15;
    if (probability >= threshold + AMBIGUITY_MARGIN) {
      return res.json({
        match: true,
        confidence: probability,
        threshold,
        expected,
        source: 'model'
      });
    }
    if (probability <= threshold - AMBIGUITY_MARGIN) {
      return res.json({
        match: false,
        confidence: probability,
        threshold,
        expected,
        source: 'model'
      });
    }
    // Ambiguous -> fall through to Gemini.
    return res.json({
      match: null,
      confidence: probability,
      threshold,
      expected,
      source: 'model-ambiguous',
      requireGemini: true
    });
  }

  // No usable model -> tell the client to use the legacy local+Gemini path.
  return res.json({
    match: null,
    expected,
    source: 'no-model',
    requireGemini: true
  });
});

app.get('/api/words/pronunciations/backfill', async (_req, res) => {
  try {
    const words = await dbAll(
      'SELECT id, amharic, translation, pronunciation_audio, pronunciation_mime, pronunciation_source FROM words WHERE pronunciation_audio IS NULL OR LENGTH(pronunciation_audio) = 0'
    );

    let found = 0;
    let missing = 0;

    for (const word of words) {
      try {
        await getOrCreatePronunciation(word);
        found += 1;
      } catch (_error) {
        missing += 1;
      }
    }

    return res.json({ total: words.length, found, missing });
  } catch (_error) {
    return res.status(500).json({ error: 'Unable to backfill pronunciations.' });
  }
});

async function startServer() {
  try {
    await dbRun('PRAGMA foreign_keys = ON');
    await ensureColumn('words', 'pronunciation_audio', 'pronunciation_audio BLOB');
    await ensureColumn('words', 'pronunciation_mime', 'pronunciation_mime TEXT');
    await ensureColumn('words', 'pronunciation_source', 'pronunciation_source TEXT');
    await ensureColumn('words', 'translation', 'translation TEXT');

    const seedSummary = await refreshWordBank();
    console.log(`Seed words ready: ${seedSummary.total} total words in database.`);

    const charSeedSummary = await refreshCharacterBank();
    console.log(`Character bank ready: ${charSeedSummary.total} total characters in database.`);
  } catch (error) {
    console.warn('Database seed skipped:', error.message);
  }

  app.listen(port, () => {
    console.log(`Fidel app listening at http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exitCode = 1;
});
