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
    print('Fidel setup complete. Database is ready.')


if __name__ == '__main__':
    main()
