const path = require('path');
const express = require('express');
const rateLimit = require('express-rate-limit');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = process.env.PORT || 3000;
const targetWordCount = 1000;
const kaikkiWordListUrl = 'https://kaikki.org/dictionary/Amharic/words/kaikki.org-dictionary-Amharic-words.jsonl';

const consonantFamilies = [
  ['ሀ', 'ሁ', 'ሂ', 'ሃ', 'ሄ', 'ህ', 'ሆ'],
  ['ለ', 'ሉ', 'ሊ', 'ላ', 'ሌ', 'ል', 'ሎ'],
  ['መ', 'ሙ', 'ሚ', 'ማ', 'ሜ', 'ም', 'ሞ'],
  ['ሠ', 'ሡ', 'ሢ', 'ሣ', 'ሤ', 'ሥ', 'ሦ'],
  ['ረ', 'ሩ', 'ሪ', 'ራ', 'ሬ', 'ር', 'ሮ'],
  ['ሰ', 'ሱ', 'ሲ', 'ሳ', 'ሴ', 'ስ', 'ሶ'],
  ['ሸ', 'ሹ', 'ሺ', 'ሻ', 'ሼ', 'ሽ', 'ሾ'],
  ['ቀ', 'ቁ', 'ቂ', 'ቃ', 'ቄ', 'ቅ', 'ቆ'],
  ['በ', 'ቡ', 'ቢ', 'ባ', 'ቤ', 'ብ', 'ቦ'],
  ['ቨ', 'ቩ', 'ቪ', 'ቫ', 'ቬ', 'ቭ', 'ቮ'],
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
  ['ፐ', 'ፑ', 'ፒ', 'ፓ', 'ፔ', 'ፕ', 'ፖ']
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
    consonantFamilies.map((family) => ({
      consonant: family[0],
      vowels: family
    }))
  );
});

app.get('/api/words/random', wordsRateLimiter, (_req, res) => {
  db.get(
    `SELECT
      id,
      latin,
      amharic,
      translation,
      CASE WHEN pronunciation_audio IS NOT NULL THEN 1 ELSE 0 END AS hasAudio
    FROM words
    ORDER BY RANDOM()
    LIMIT 1`,
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Unable to load word.' });
      }

      if (!row) {
        return res.status(404).json({ error: 'No words found.' });
      }

      return res.json(row);
    }
  );
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
