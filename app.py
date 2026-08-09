import os
import json
import time
import random
import hashlib
import sqlite3
import requests
import threading
import re
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple

from flask import Flask, request, jsonify, Response, send_file, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
load_dotenv('.env.example', override=False)

app = Flask(__name__, static_folder='public', static_url_path='')
CORS(app)

def find_available_port(start_port: int = 5000, max_tries: int = 20) -> int:
    import socket
    for port in range(start_port, start_port + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            result = s.connect_ex(('localhost', port))
            if result != 0:
                return port
    return start_port


PORT = int(os.getenv('PORT', 8080))
TARGET_WORD_COUNT = 1000
KAIKKI_WORD_LIST_URL = 'https://kaikki.org/dictionary/Amharic/words/kaikki.org-dictionary-Amharic-words.jsonl'
KAIKKI_WORD_LIST_URL_HTTP = 'http://kaikki.org/dictionary/Amharic/words/kaikki.org-dictionary-Amharic-words.jsonl'
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
GEMINI_MODELS = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash'
]

DB_PATH = Path(__file__).parent / 'fidel.db'

# Rate limiting state
words_rate_limit_lock = threading.Lock()
words_rate_limit_data = {"window_start": time.time(), "count": 0}
WORDS_RATE_LIMIT_WINDOW = 60
WORDS_RATE_LIMIT_MAX = 120

# Special word filter for initial seeding
special_word_request_count = 0
special_word_chars = ['ጸ', 'ፀ', 'ሀ', 'ሐ']

# Gemini cache
recognize_cache: Dict[str, Dict[str, Any]] = {}
MAX_CACHE_SIZE = 500

# ---- Constants ----
VOWEL_SUFFIXES = ['a', 'u', 'i', 'a', 'e', 'e', 'o']
LATIN_FAMILIES = [
    'ha', 'la', 'ha', 'ma', 'sa', 'ra', 'sa', 'sha', 'qa', 'ba', 'ta', 'cha', 'ha', 'na', 'nya',
    'a', 'ka', 'kha', 'wa', 'a', 'za', 'zha', 'ya', 'da', 'ja', 'ga', 'ta', 'cha', 'pa', 'sa', 'sa', 'fa', 'pa', 'va'
]

CONSONANT_FAMILIES = [
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
]

# ---- Database helpers ----

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    return conn


def init_db():
    conn = get_db_connection()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                latin TEXT NOT NULL UNIQUE,
                amharic TEXT NOT NULL,
                translation TEXT,
                pronunciation_audio BLOB,
                pronunciation_mime TEXT,
                pronunciation_source TEXT
            );
            CREATE TABLE IF NOT EXISTS characters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fidel TEXT NOT NULL,
                latin TEXT NOT NULL,
                family TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS drawing_samples (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                expected TEXT NOT NULL,
                features TEXT NOT NULL,
                label TEXT NOT NULL,
                image TEXT,
                source TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
        """)
        conn.commit()
    finally:
        conn.close()


def ensure_column(table_name: str, column_name: str, column_definition: str):
    conn = get_db_connection()
    try:
        columns = conn.execute(f'PRAGMA table_info({table_name})').fetchall()
        has_column = any(col['name'] == column_name for col in columns)
        if not has_column:
            conn.execute(f'ALTER TABLE {table_name} ADD COLUMN {column_definition}')
            conn.commit()
    finally:
        conn.close()


def is_amharic_script(word: str) -> bool:
    return isinstance(word, str) and bool(__import__('re').match(r'^[\u1200-\u137F]+$', word))


def normalize_prompt(prompt: str) -> str:
    return ' '.join(str(prompt or '').split())


def make_unique_prompt(base_prompt: str, seen_prompts: set) -> str:
    normalized = normalize_prompt(base_prompt) or 'Amharic word'
    candidate = normalized
    suffix = 2
    while candidate in seen_prompts:
        candidate = f'{normalized} {suffix}'
        suffix += 1
    seen_prompts.add(candidate)
    return candidate


def pick_romanized_prompt(entry: dict) -> Optional[str]:
    romanized_form = entry.get('forms', [])
    for form in romanized_form:
        if form and form.get('tags') and 'romanization' in form['tags'] and form.get('form'):
            return form['form']

    roman_field = entry.get('forms', [])
    for form in roman_field:
        if form and isinstance(form.get('roman'), str) and form['roman']:
            return form['roman']

    head_template = entry.get('head_templates', [])
    for template in head_template:
        if template and isinstance(template.get('args', {}).get('tr'), str) and template['args']['tr']:
            return template['args']['tr']

    gloss = entry.get('senses', [{}])[0].get('glosses', [None])[0]
    if gloss:
        return gloss
    return entry.get('word')


def pick_english_translation(entry: dict) -> Optional[str]:
    glosses = entry.get('senses', [])
    for sense in glosses:
        g = sense.get('glosses', [])
        for value in g:
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None


def fetch_real_amharic_words(limit: int) -> List[dict]:
    urls = [KAIKKI_WORD_LIST_URL, KAIKKI_WORD_LIST_URL_HTTP]
    response = None
    for url in urls:
        try:
            response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, stream=True, timeout=30)
            if response.ok:
                break
        except Exception:
            continue

    if not response or not response.ok:
        raise Exception(
            'Unable to download word list. '
            'If you are on PythonAnywhere, upload your local fidel.db to the server '
            'or run setup from a network that can access kaikki.org.'
        )

    words = []
    seen_amharic = set()
    seen_prompts = set()
    buffer = ''

    for line in response.iter_lines(decode_unicode=True):
        if line is None:
            continue
        buffer += line + '\n'
        while '\n' in buffer and len(words) < limit:
            line_text, buffer = buffer.split('\n', 1)
            line_text = line_text.strip()
            if not line_text:
                continue
            try:
                entry = json.loads(line_text)
            except json.JSONDecodeError:
                continue

            if entry.get('lang_code') != 'am' or not is_amharic_script(entry.get('word', '')) or not entry.get('senses'):
                continue
            if entry['word'] in seen_amharic:
                continue

            prompt = make_unique_prompt(pick_romanized_prompt(entry) or entry.get('word', 'Amharic word'), seen_prompts)
            translation = pick_english_translation(entry)
            sounds = entry.get('sounds', [])
            pronunciation_source = None
            for sound in sounds:
                if sound and (sound.get('mp3_url') or sound.get('ogg_url')):
                    pronunciation_source = sound.get('mp3_url') or sound.get('ogg_url')
                    break
            if not pronunciation_source:
                pronunciation_source = f'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=am-ET&q={entry["word"]}'

            words.append({
                'latin': prompt,
                'amharic': entry['word'],
                'translation': translation,
                'pronunciation_source': pronunciation_source
            })
            seen_amharic.add(entry['word'])

        if len(words) >= limit:
            break

    if len(words) < limit:
        raise Exception(f'Only found {len(words)} real Amharic words')
    return words


def refresh_word_bank() -> dict:
    conn = get_db_connection()
    try:
        row = conn.execute('SELECT COUNT(*) AS count FROM words').fetchone()
        current_count = row['count'] if row else 0

        if current_count >= TARGET_WORD_COUNT:
            return {'added': 0, 'total': current_count}

        try:
            real_words = fetch_real_amharic_words(TARGET_WORD_COUNT)
        except Exception as fetch_error:
            print('Word refresh skipped:', fetch_error)
            if current_count > 0:
                return {'added': 0, 'total': current_count}
            raise

        conn.execute('DELETE FROM words')
        for word in real_words:
            conn.execute(
                'INSERT INTO words (latin, amharic, translation, pronunciation_source) VALUES (?, ?, ?, ?)',
                (word['latin'], word['amharic'], word['translation'], word['pronunciation_source'])
            )
        conn.commit()

        row = conn.execute('SELECT COUNT(*) AS count FROM words').fetchone()
        return {'added': len(real_words), 'total': row['count'] if row else len(real_words)}
    finally:
        conn.close()


def refresh_character_bank() -> dict:
    conn = get_db_connection()
    try:
        row = conn.execute('SELECT COUNT(*) AS count FROM characters').fetchone()
        current_count = row['count'] if row else 0
        expected_count = sum(len(family) for family in CONSONANT_FAMILIES)
        if current_count == expected_count:
            return {'added': 0, 'total': current_count}

        conn.execute('DELETE FROM characters')
        for family_index, family in enumerate(CONSONANT_FAMILIES):
            base_latin = LATIN_FAMILIES[family_index] or 'a'
            for vowel_index, fidel in enumerate(family):
                vowel_suffix = VOWEL_SUFFIXES[vowel_index] if vowel_index < len(VOWEL_SUFFIXES) else ''
                latin = f'{base_latin}{vowel_suffix if vowel_suffix != "a" else ""}'
                conn.execute(
                    'INSERT INTO characters (fidel, latin, family) VALUES (?, ?, ?)',
                    (fidel, latin, base_latin)
                )
        conn.commit()

        row = conn.execute('SELECT COUNT(*) AS count FROM characters').fetchone()
        return {'added': row['count'] if row else 0, 'total': row['count'] if row else 0}
    finally:
        conn.close()


def download_pronunciation_audio(audio_url: str) -> Tuple[bytes, str]:
    response = requests.get(audio_url, headers={'User-Agent': 'Mozilla/5.0'})
    if not response.ok:
        raise Exception(f'Pronunciation request failed with status {response.status_code}')
    return response.content, response.headers.get('content-type', 'audio/mpeg')


def get_fallback_pronunciation_source(amharic_word: str) -> str:
    return f'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=am-ET&q={amharic_word}'


def resolve_pronunciation_source(word_row: dict) -> str:
    if word_row.get('pronunciation_source'):
        return word_row['pronunciation_source']
    return get_fallback_pronunciation_source(word_row['amharic'])


def get_or_create_pronunciation(word_row: dict) -> Tuple[bytes, str]:
    if word_row.get('pronunciation_audio'):
        audio = word_row['pronunciation_audio']
        if isinstance(audio, bytes):
            return audio, word_row.get('pronunciation_mime') or 'audio/mpeg'
        return bytes(audio), word_row.get('pronunciation_mime') or 'audio/mpeg'

    source_url = resolve_pronunciation_source(word_row)
    try:
        audio, mime_type = download_pronunciation_audio(source_url)
    except Exception:
        fallback = get_fallback_pronunciation_source(word_row['amharic'])
        audio, mime_type = download_pronunciation_audio(fallback)
        source_url = fallback

    conn = get_db_connection()
    try:
        conn.execute(
            'UPDATE words SET pronunciation_audio = ?, pronunciation_mime = ?, pronunciation_source = ? WHERE id = ?',
            (audio, mime_type, source_url, word_row['id'])
        )
        conn.commit()
    finally:
        conn.close()

    return audio, mime_type


def words_rate_limiter():
    with words_rate_limit_lock:
        now = time.time()
        if now - words_rate_limit_data['window_start'] > WORDS_RATE_LIMIT_WINDOW:
            words_rate_limit_data['window_start'] = now
            words_rate_limit_data['count'] = 0
        if words_rate_limit_data['count'] >= WORDS_RATE_LIMIT_MAX:
            return False
        words_rate_limit_data['count'] += 1
        return True


# ---- Gemini helpers ----

def simple_hash(input_str: str) -> str:
    h = 5381
    for char in input_str:
        h = ((h << 5) + h + ord(char)) | 0
    return str(h & 0xFFFFFFFF)


async def generate_with_gemini(parts: list) -> dict:
    last_error = None
    image_input_unsupported_count = 0

    for model in GEMINI_MODELS:
        try:
            response = requests.post(
                f'{GEMINI_BASE_URL}/{model}:generateContent?key={GEMINI_API_KEY}',
                headers={'Content-Type': 'application/json'},
                json={
                    'contents': [{'parts': parts}],
                    'generationConfig': {'temperature': 0, 'responseMimeType': 'application/json'}
                }
            )

            if not response.ok:
                error_text = response.text
                print(f'[gemini] model={model} status={response.status_code} body={error_text[:500]}')
                quota_exceeded = bool(__import__('re').search(r'quota|429|rate.?limit|resource exhausted', error_text, re.I))
                if quota_exceeded:
                    last_error = Exception('Gemini quota exceeded')
                    last_error.quota = True
                    continue
                unsupported_image = bool(__import__('re').search(r'does not support.*image|image.*not supported|cannot read.*image|image input is not supported', error_text, re.I))
                if unsupported_image:
                    image_input_unsupported_count += 1
                    last_error = Exception('Gemini model does not support image input')
                    last_error.image_inputUnsupported = True
                    continue
                raise Exception(f'Gemini request failed: {error_text[:300]}')

            data = response.json()
            text = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')
            cleaned = str(text).replace('```json', '').replace('```', '').strip()
            match = bool(__import__('re').search(r'"match"\s*:\s*true', cleaned, re.I))
            confidence_match = __import__('re').search(r'"confidence"\s*:\s*([0-9]*\.?[0-9]+)', cleaned, re.I)
            confidence = float(confidence_match.group(1)) if confidence_match else None
            return {'match': match, 'confidence': confidence, 'model': model}
        except Exception as error:
            if getattr(error, 'quota', False):
                last_error = error
                continue
            if getattr(error, 'status', None) == 404:
                last_error = error
                continue
            raise error

    if image_input_unsupported_count == len(GEMINI_MODELS):
        err = Exception('All Gemini models do not support image input.')
        err.imageInputUnsupported = True
        raise err

    err = last_error or Exception('All Gemini models failed.')
    err.geminiUnavailable = True
    raise err


# ---- Routes ----

def is_mobile_user_agent(user_agent: str) -> bool:
    mobile_regex = re.compile(r'Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS', re.IGNORECASE)
    return bool(mobile_regex.search(user_agent))


@app.route('/')
@app.route('/spell')
def index():
    if is_mobile_user_agent(request.headers.get('User-Agent', '')):
        return send_from_directory('public', 'mobile-spell.html')
    return send_from_directory('public', 'index.html')


@app.route('/study')
def study_page():
    if is_mobile_user_agent(request.headers.get('User-Agent', '')):
        return send_from_directory('public', 'mobile-study.html')
    return send_from_directory('public', 'study.html')


@app.route('/draw')
def draw_page():
    if is_mobile_user_agent(request.headers.get('User-Agent', '')):
        return send_from_directory('public', 'mobile-draw.html')
    return send_from_directory('public', 'draw.html')


@app.route('/train')
def train_page():
    return send_from_directory('public', 'train.html')


@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('public', path)


@app.route('/api/alphabet')
def api_alphabet():
    result = []
    for family_index, family in enumerate(CONSONANT_FAMILIES):
        base_latin = LATIN_FAMILIES[family_index] or 'a'
        vowels = []
        for vowel_index, fidel in enumerate(family):
            vowel_suffix = VOWEL_SUFFIXES[vowel_index] if vowel_index < len(VOWEL_SUFFIXES) else ''
            latin = f'{base_latin}{vowel_suffix if vowel_suffix != "a" else ""}'
            vowels.append({'fidel': fidel, 'latin': latin})
        result.append({'consonant': family[0], 'latin': base_latin, 'vowels': vowels})
    return jsonify(result)


@app.route('/api/words/random')
def api_words_random():
    global special_word_request_count
    if not words_rate_limiter():
        return jsonify({'error': 'Too many requests. Please try again shortly.'}), 429

    use_special_filter = special_word_request_count < len(special_word_chars)
    target_char = special_word_chars[special_word_request_count] if use_special_filter else None
    if use_special_filter:
        special_word_request_count += 1

    conn = get_db_connection()
    try:
        if use_special_filter and target_char:
            query = """
                SELECT id, latin, amharic, translation,
                       CASE WHEN pronunciation_audio IS NOT NULL THEN 1 ELSE 0 END AS hasAudio
                FROM words
                WHERE amharic LIKE ?
                ORDER BY RANDOM()
                LIMIT 1
            """
            row = conn.execute(query, (f'%{target_char}%',)).fetchone()
        else:
            query = """
                SELECT id, latin, amharic, translation,
                       CASE WHEN pronunciation_audio IS NOT NULL THEN 1 ELSE 0 END AS hasAudio
                FROM words
                ORDER BY RANDOM()
                LIMIT 1
            """
            row = conn.execute(query).fetchone()

        if not row:
            fallback = {
                'id': 0,
                'latin': 'house',
                'amharic': 'ቤት',
                'translation': 'house',
                'hasAudio': 0
            }
            return jsonify(fallback)
        return jsonify(dict(row))
    finally:
        conn.close()


@app.route('/api/words/<int:word_id>/audio')
def api_words_audio(word_id: int):
    if not words_rate_limiter():
        return jsonify({'error': 'Too many requests. Please try again shortly.'}), 429

    conn = get_db_connection()
    try:
        row = conn.execute(
            'SELECT id, amharic, translation, pronunciation_audio, pronunciation_mime, pronunciation_source FROM words WHERE id = ?',
            (word_id,)
        ).fetchone()
        if not row:
            return jsonify({'error': 'Pronunciation not found.'}), 404

        word_row = dict(row)
        try:
            audio, mime_type = get_or_create_pronunciation(word_row)
            return Response(audio, mimetype=mime_type, headers={'Cache-Control': 'public, max-age=86400'})
        except Exception:
            return jsonify({'error': 'Pronunciation not available.'}), 404
    finally:
        conn.close()


@app.route('/api/characters/audio')
def api_characters_audio():
    if not words_rate_limiter():
        return jsonify({'error': 'Too many requests. Please try again shortly.'}), 429

    fidel = request.args.get('fidel', '').strip()
    if not fidel:
        return jsonify({'error': 'Missing fidel.'}), 400

    audio_url = f'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=am-ET&q={fidel}'
    try:
        audio, mime_type = download_pronunciation_audio(audio_url)
        return Response(audio, mimetype=mime_type, headers={'Cache-Control': 'public, max-age=86400'})
    except Exception:
        return jsonify({'error': 'Pronunciation not available.'}), 404


@app.route('/api/draw/random')
def api_draw_random():
    conn = get_db_connection()
    try:
        row = conn.execute('SELECT id, fidel, latin, family FROM characters ORDER BY RANDOM() LIMIT 1').fetchone()
        if not row:
            return jsonify({'error': 'No characters found.'}), 404
        return jsonify(dict(row))
    finally:
        conn.close()


@app.route('/api/draw/recognize', methods=['POST'])
def api_draw_recognize():
    data = request.get_json() or {}
    image = data.get('image')
    expected = data.get('expected')

    if not image or not expected:
        return jsonify({'error': 'Missing image or expected character.'}), 400

    if not GEMINI_API_KEY:
        return jsonify({'error': 'Gemini API key is not configured.', 'hint': 'Set the GEMINI_API_KEY environment variable.', 'expected': expected}), 503

    base64_data = str(image).replace('data:image/\\w+;base64,', '')
    reference_base64 = str(data.get('reference', '')).replace('data:image/\\w+;base64,', '') if data.get('reference') else None

    cache_key = simple_hash(f'{base64_data}|{reference_base64 or ""}|{expected}')
    if cache_key in recognize_cache:
        return jsonify({**recognize_cache[cache_key], 'cached': True})

    try:
        parts = [
            {'text': get_recognize_prompt(expected)},
            {'inline_data': {'mime_type': 'image/png', 'data': base64_data}}
        ]
        if reference_base64:
            parts.append({'inline_data': {'mime_type': 'image/png', 'data': reference_base64}})

        result = generate_with_gemini(parts)
        recognize_cache[cache_key] = result
        if len(recognize_cache) > MAX_CACHE_SIZE:
            oldest_key = next(iter(recognize_cache))
            del recognize_cache[oldest_key]
        return jsonify({**result, 'cached': False})
    except Exception as error:
        if getattr(error, 'quota', False):
            return jsonify({'error': 'Gemini is unavailable (quota exceeded). Please try again later.', 'expected': expected}), 503
        detail = str(getattr(error, 'message', error))
        print('[draw/recognize] Gemini error:', detail)
        if getattr(error, 'imageInputUnsupported', False):
            return jsonify({
                'match': None, 'confidence': None, 'expected': expected, 'model': None,
                'imageUnreadable': True, 'message': 'Gemini could not read the image (model does not support image input).'
            })
        if getattr(error, 'geminiUnavailable', False):
            return jsonify({
                'match': None, 'confidence': None, 'expected': expected, 'model': None,
                'imageUnreadable': True, 'message': 'Gemini is currently unavailable. Using local comparison to make a best guess.'
            })
        return jsonify({'error': 'Unable to recognize drawing.', 'detail': detail}), 500


@app.route('/api/train/sample', methods=['POST'])
def api_train_sample():
    data = request.get_json() or {}
    expected = data.get('expected')
    features = data.get('features')
    label = data.get('label')
    image = data.get('image')
    source = data.get('source', 'manual')

    if not expected or not features or not isinstance(features, list):
        return jsonify({'error': 'Missing expected or features array.'}), 400
    if label not in ('correct', 'incorrect'):
        return jsonify({'error': 'label must be "correct" or "incorrect".'}), 400

    conn = get_db_connection()
    try:
        conn.execute(
            'INSERT INTO drawing_samples (expected, features, label, image, source) VALUES (?, ?, ?, ?, ?)',
            (expected, json.dumps(features), label, image, source)
        )
        conn.commit()
        row = conn.execute('SELECT COUNT(*) AS count FROM drawing_samples').fetchone()
        return jsonify({'ok': True, 'total': row['count'] if row else 0})
    except Exception as error:
        return jsonify({'error': 'Unable to save sample.', 'detail': str(error)}), 500
    finally:
        conn.close()


@app.route('/api/train/stats')
def api_train_stats():
    conn = get_db_connection()
    try:
        rows = conn.execute('SELECT label, source, COUNT(*) AS count FROM drawing_samples GROUP BY label, source').fetchall()
        by_label = {'correct': 0, 'incorrect': 0}
        by_source = {'manual': 0, 'auto': 0}
        total = 0
        for row in rows:
            by_label[row['label']] = by_label.get(row['label'], 0) + row['count']
            by_source[row['source']] = by_source.get(row['source'], 0) + row['count']
            total += row['count']
        return jsonify({'total': total, 'byLabel': by_label, 'bySource': by_source})
    except Exception as error:
        return jsonify({'error': 'Unable to read stats.', 'detail': str(error)}), 500
    finally:
        conn.close()


@app.route('/api/train/clear', methods=['POST'])
def api_train_clear():
    conn = get_db_connection()
    try:
        conn.execute('DELETE FROM drawing_samples')
        conn.commit()
        return jsonify({'ok': True})
    except Exception as error:
        return jsonify({'error': 'Unable to clear samples.', 'detail': str(error)}), 500
    finally:
        conn.close()


@app.route('/api/model/info')
def api_model_info():
    try:
        from ml.model import load_model
        model = load_model()
        conn = get_db_connection()
        row = conn.execute('SELECT COUNT(*) AS count FROM drawing_samples').fetchone()
        sample_count = row['count'] if row else 0
        return jsonify({
            'trained': bool(model),
            'sampleCount': sample_count,
            'architecture': 'mlp-436-24-1' if model else None,
            'threshold': getattr(model, 'threshold', None) if model else None,
            'metadata': getattr(model, 'metadata', None) if model else None
        })
    except Exception as error:
        return jsonify({'error': 'Unable to read model info.', 'detail': str(error)}), 500


@app.route('/api/model/train', methods=['POST'])
def api_model_train():
    options = request.get_json() or {}
    conn = get_db_connection()
    try:
        rows = conn.execute('SELECT expected, features, label FROM drawing_samples').fetchall()
        if len(rows) < 2:
            return jsonify({'error': 'Not enough labeled samples to train.'}), 400

        dataset = []
        for row in rows:
            if row['label'] not in ('correct', 'incorrect'):
                continue
            try:
                features = json.loads(row['features']) if isinstance(row['features'], str) else row['features']
            except Exception:
                continue
            if not features or not len(features):
                continue
            dataset.append({'x': list(features), 'y': 1 if row['label'] == 'correct' else 0})

        if len(dataset) < 2:
            return jsonify({'error': 'No usable labeled samples found.'}), 400

        from ml.model import train_model, save_model
        result = train_model(dataset, {
            'epochs': int(options.get('epochs', 2000)),
            'learningRate': float(options.get('learningRate', 0.005)),
            'l2': float(options.get('l2', 1e-4)),
            'valFraction': float(options.get('valFraction', 0.15))
        })

        save_model(result['net'], {
            'threshold': result['threshold'],
            'sampleCount': result['sampleCount'],
            'trainAccuracy': result['train']['accuracy'],
            'valAccuracy': result['val']['accuracy'],
            'finalAccuracy': result['final']['accuracy'],
            'architecture': 'mlp-436-24-1'
        })

        return jsonify({
            'trained': True,
            'sampleCount': result['sampleCount'],
            'threshold': result['threshold'],
            'train': result['train'],
            'val': result['val'],
            'final': result['final']
        })
    except Exception as error:
        return jsonify({'error': 'Training failed.', 'detail': str(error)}), 500
    finally:
        conn.close()


@app.route('/api/draw/check', methods=['POST'])
def api_draw_check():
    data = request.get_json() or {}
    expected = data.get('expected')
    features = data.get('features')

    if not expected:
        return jsonify({'error': 'Missing expected character.'}), 400

    try:
        from ml.model import load_model
        model = load_model()
        if model and features and isinstance(features, list) and len(features) == getattr(model, 'input_size', 436):
            probability = float(model.predict(features))
            threshold = getattr(model, 'threshold', 0.5) or 0.5
            ambiguity_margin = 0.15
            if probability >= threshold + ambiguity_margin:
                return jsonify({'match': True, 'confidence': probability, 'threshold': threshold, 'expected': expected, 'source': 'model'})
            if probability <= threshold - ambiguity_margin:
                return jsonify({'match': False, 'confidence': probability, 'threshold': threshold, 'expected': expected, 'source': 'model'})
            return jsonify({'match': None, 'confidence': probability, 'threshold': threshold, 'expected': expected, 'source': 'model-ambiguous', 'requireGemini': True})

        reason = 'no-model'
        if model and (not features or not isinstance(features, list) or len(features) != getattr(model, 'input_size', 436)):
            reason = f'bad-features (expected {getattr(model, "input_size", 436)}, got {len(features) if isinstance(features, list) else type(features).__name__})'
        return jsonify({'match': None, 'expected': expected, 'source': reason, 'requireGemini': True})
    except Exception as error:
        print('[draw/check] error:', error)
        return jsonify({'match': None, 'expected': expected, 'source': 'error', 'requireGemini': True})


@app.route('/api/words/pronunciations/backfill')
def api_words_backfill():
    conn = get_db_connection()
    try:
        rows = conn.execute(
            'SELECT id, amharic, translation, pronunciation_audio, pronunciation_mime, pronunciation_source FROM words WHERE pronunciation_audio IS NULL OR LENGTH(pronunciation_audio) = 0'
        ).fetchall()
        found = 0
        missing = 0
        for row in rows:
            try:
                get_or_create_pronunciation(dict(row))
                found += 1
            except Exception:
                missing += 1
        return jsonify({'total': len(rows), 'found': found, 'missing': missing})
    except Exception as error:
        return jsonify({'error': 'Unable to backfill pronunciations.'}), 500
    finally:
        conn.close()


def get_recognize_prompt(expected: str) -> str:
    return (
        f'You are an Amharic fidel (Ge\'ez script) handwriting recognizer for a language-learning app. '
        f'The learner drew a handwritten character. The expected character is "{expected}".\n\n'
        'You are given TWO images:\n'
        '1. The learner\'s drawing (the handwritten character to evaluate).\n'
        '2. The REFERENCE image (the correct, expected fidel rendered as a clear glyph).\n\n'
        'Amharic has MANY characters that look similar and differ only by small details '
        '(position of a head/loop, number of dots, a short diacritic stroke, the direction of a diagonal, '
        'a small tail, etc.). Your job is to judge whether the drawing is recognizably the SAME character '
        'as the reference, while being fair to a human learner\'s handwriting.\n\n'
        'Be TOLERANT of normal handwriting variation. A drawing is still a match when the learner drew the '
        'correct character but with: wobble, uneven strokes, or slightly wobbly lines; uneven stroke thickness '
        'or different nib width than the reference; imperfect proportions, slightly compressed or stretched shapes; '
        'a small tilt or rotation, or rounded corners instead of sharp ones; the character drawn off-center or at '
        'a different size.\n\n'
        'Be STRICT about the character\'s IDENTITY. It is NOT a match if the drawing is a DIFFERENT fidel: '
        'The drawing is another Amharic character that merely resembles the reference (e.g. differs in the '
        'number/position of dots, a missing or extra head/loop/tail, a wrong or missing diagonal/diacritic stroke, '
        'the wrong branch or branch direction, or the wrong orientation of a small element). '
        'The drawing is missing one of the reference fidel\'s key distinguishing features, or has an extra '
        'distinguishing feature that makes it read as a different character. '
        'The drawing is unreadable: a single dot, a single straight line, a simple squiggle, or any scribble. '
        'The drawing is incomplete or ambiguous such that a reader could not tell it is the reference fidel.\n\n'
        'Rule of thumb: If a reasonable Amharic reader would read the drawing as the expected character, '
        'it is a match, even if the penmanship is sloppy. If the drawing would more likely be read as a '
        'DIFFERENT fidel (or anything else), it is not a match.\n\n'
        'Return JSON with two fields:\n'
        '1. "match": true if the drawing is recognizably the expected character, false otherwise.\n'
        '2. "confidence": a number from 0 to 1 expressing how confident you are in your decision '
        '(1 = absolutely certain, 0 = no idea).\n\n'
        'Only return the JSON object, nothing else.'
    )


# ---- Startup ----

def _log_model_status():
    try:
        from ml.model import load_model
        model = load_model()
        if model:
            print(f'[model] Loaded. threshold={getattr(model, "threshold", None)} input_size={getattr(model, "input_size", None)} metadata={getattr(model, "metadata", None)}')
        else:
            print('[model] Not loaded. model/weights.json is missing. Draw page will fall back to local comparison + Gemini.')
    except Exception as exc:
        print(f'[model] Failed to load: {exc}')


def bootstrap():
    init_db()
    ensure_column('words', 'pronunciation_audio', 'pronunciation_audio BLOB')
    ensure_column('words', 'pronunciation_mime', 'pronunciation_mime TEXT')
    ensure_column('words', 'pronunciation_source', 'pronunciation_source TEXT')
    ensure_column('words', 'translation', 'translation TEXT')

    try:
        word_summary = refresh_word_bank()
        print(f'Seed words ready: {word_summary["total"]} total words in database.')
    except Exception as error:
        print('Word bank seed skipped:', str(error))

    try:
        char_summary = refresh_character_bank()
        print(f'Character bank ready: {char_summary["total"]} total characters in database.')
    except Exception as error:
        print('Character bank seed skipped:', str(error))

    _log_model_status()


def start_server():
    bootstrap()
    app.run(host='0.0.0.0', port=PORT, debug=False)


if __name__ == '__main__':
    start_server()
