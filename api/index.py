"""Vercel serverless function entry point for Flask app."""
import sys
import os
import traceback
from flask import Flask, jsonify

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Initialize app with progressive import testing
app = Flask(__name__)
init_error = None
error_traceback = None
import_progress = []

try:
    import_progress.append("Starting imports...")

    # Test each import step by step
    import_progress.append("Importing config...")
    from config import config

    import_progress.append("Importing flask extensions...")
    from flask_cors import CORS
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address

    import_progress.append("Importing database module...")
    from app.models.database import db

    import_progress.append("Importing routes...")
    from app.api.routes import api_bp

    import_progress.append("All imports successful, creating app...")
    from app import create_app

    # Create the Flask app
    app = create_app('production')
    import_progress.append("Flask app created successfully!")
    print("✓ Flask app initialized successfully")

except Exception as e:
    init_error = str(e)
    error_traceback = traceback.format_exc()
    print(f"✗ ERROR during initialization: {init_error}")
    print(f"Traceback: {error_traceback}")
    print(f"Progress: {import_progress}")

    # Create error handler routes
    @app.route('/health')
    @app.route('/api/v1/<path:path>')
    @app.route('/')
    def error_handler(path=''):
        return jsonify({
            'error': 'Application initialization failed',
            'message': init_error,
            'traceback': error_traceback,
            'import_progress': import_progress,
            'python_version': sys.version,
            'env_check': {
                'SUPABASE_URL': 'set' if os.getenv('SUPABASE_URL') else 'NOT SET',
                'SUPABASE_KEY': 'set' if os.getenv('SUPABASE_KEY') else 'NOT SET',
                'SECRET_KEY': 'set' if os.getenv('SECRET_KEY') else 'NOT SET',
            }
        }), 500

# Vercel expects the app to be exposed as a handler
handler = app

# For local testing, you can still run this directly
if __name__ == '__main__':
    if app:
        app.run()
