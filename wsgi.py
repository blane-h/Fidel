"""PythonAnywhere WSGI entry point.

PythonAnywhere runs the app through a WSGI file instead of ``app.run()``.
This module imports the Flask app and exposes it as ``application``.

IMPORTANT:
- Do NOT run bootstrap() here. The one-time DB init/seeding must be done
  from a PythonAnywhere Bash console via:

      python3 setup_pythonanywhere.py

  This keeps the WSGI import side-effect free and avoids re-downloading the
  word bank on every reload.
"""
import os
import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('fidel.wsgi')

# Make sure the project directory is on sys.path so `app` and `ml` are importable.
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

# Manually load the .env file on the server (PythonAnywhere does not set
# arbitrary env vars by default). Values set in the web app's WSGI config
# will still take precedence because we load with override=False.
env_path = os.path.join(PROJECT_DIR, '.env')
try:
    from dotenv import load_dotenv
    found = load_dotenv(env_path, override=False)
    if not found:
        logger.warning('.env file not found at %s. Gemini API key and other settings may be missing.', env_path)
    else:
        logger.info('.env loaded from %s', env_path)
except ImportError:
    logger.warning('python-dotenv is not installed. Environment variables from .env will not be loaded.')
except Exception as exc:
    logger.warning('Failed to load .env from %s: %s', env_path, exc)

# Import the Flask app. PythonAnywhere expects an `application` object.
from app import app as application  # noqa: E402

if __name__ == '__main__':
    print('Fidel WSGI app loaded.')
