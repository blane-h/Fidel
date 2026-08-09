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
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fidel.wsgi")

# Make sure the directory containing this WSGI file is on sys.path
# so that the app module can be found.
_wsgi_dir = os.path.dirname(os.path.abspath(__file__))
if _wsgi_dir not in sys.path:
    sys.path.insert(0, _wsgi_dir)

# Import the Flask app so we can discover its root directory.
from app import app as application  # noqa: E402

# The project directory is where app.py lives.
PROJECT_DIR = application.root_path
if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

# Load .env from the project directory (PythonAnywhere does not set
# arbitrary env vars by default). Values set in the web app's WSGI config
# will still take precedence because we load with override=False.
env_path = os.path.join(PROJECT_DIR, ".env")
try:
    from dotenv import load_dotenv
    found = load_dotenv(env_path, override=False)
    if not found:
        logger.warning(".env file not found at %s. Gemini API key and other settings may be missing.", env_path)
    else:
        logger.info(".env loaded from %s", env_path)
except ImportError:
    logger.warning("python-dotenv is not installed. Environment variables from .env will not be loaded.")
except Exception as exc:
    logger.warning("Failed to load .env from %s: %s", env_path, exc)

# Log deployment-relevant status after the app is loaded.
try:
    from ml.model import WEIGHTS_PATH as _WEIGHTS_PATH
    _model_ok = _WEIGHTS_PATH.exists()
    logger.info("model weights path: %s (exists=%s)", _WEIGHTS_PATH, _model_ok)
except Exception as _exc:
    logger.warning("Could not inspect model status: %s", _exc)

if __name__ == "__main__":
    print("Fidel WSGI app loaded.")
