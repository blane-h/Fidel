"""
One-time setup script for deploying the Fidel Flask app on PythonAnywhere.

Run this from the PythonAnywhere Bash console from the project directory:
    python3 setup_pythonanywhere.py

What it does:
  - Calls app.bootstrap(), which:
      * creates the SQLite schema (fidel.db)
      * downloads and seeds ~1000 real Amharic words
      * seeds the fidel character bank

This must be run once BEFORE the web app is reloaded, so the database is ready
when the first request comes in. It is safe to re-run: it idempotently skips
work that is already done.
"""
import sys
import os

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

try:
    import app
except ImportError as exc:
    print(f'Failed to import app module: {exc}')
    print('Make sure you are running this from the Fidel project directory.')
    sys.exit(1)


def check_model():
    from ml.model import WEIGHTS_PATH
    if WEIGHTS_PATH.exists():
        print(f'Model file found: {WEIGHTS_PATH}')
        return True
    print('WARNING: model file missing.')
    print(f'  Expected: {WEIGHTS_PATH}')
    print('  The Draw page will fall back to local comparison + Gemini.')
    print('  To fix: upload model/weights.json to the server, or train via /train.')
    return False


def check_env():
    env_path = os.path.join(PROJECT_DIR, '.env')
    if os.path.exists(env_path):
        print(f'.env file found: {env_path}')
        try:
            from dotenv import load_dotenv
            load_dotenv(env_path, override=False)
            import os as _os
            if _os.getenv('GEMINI_API_KEY'):
                print('GEMINI_API_KEY is set.')
                return True
            print('WARNING: GEMINI_API_KEY is not set in .env.')
            print('  The /api/draw/recognize endpoint will return 503.')
            print('  To fix: add GEMINI_API_KEY=your-key to .env on the server.')
            return False
        except ImportError:
            print('WARNING: python-dotenv is not installed. .env will not be loaded.')
            return False
    print('WARNING: .env file not found.')
    print(f'  Expected: {env_path}')
    print('  The GEMINI_API_KEY and other settings may be missing.')
    print('  To fix: create .env on the server with GEMINI_API_KEY=your-key')
    return False


def main():
    if not hasattr(app, 'bootstrap'):
        print('ERROR: app.bootstrap() is missing. Update app.py to define bootstrap().')
        sys.exit(1)

    print('Fidel setup started...')
    try:
        app.bootstrap()
    except Exception as exc:
        print(f'ERROR: bootstrap failed: {exc}')
        sys.exit(1)
    print('Database is ready.')

    check_model()
    check_env()
    print('Fidel setup checks complete.')


if __name__ == '__main__':
    main()
