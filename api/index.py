"""Vercel serverless function entry point for Flask app."""
import sys
import os
import traceback

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Initialize app with error handling
app = None
init_error = None

try:
    from app import create_app

    # Create the Flask app
    app = create_app('production')
    print("Flask app created successfully")

except Exception as e:
    init_error = str(e)
    error_traceback = traceback.format_exc()
    print(f"ERROR initializing Flask app: {init_error}")
    print(f"Traceback: {error_traceback}")

    # Create a minimal Flask app that returns the error
    from flask import Flask, jsonify
    app = Flask(__name__)

    @app.route('/<path:path>', defaults={'path': ''})
    @app.route('/')
    def error_handler(path=''):
        return jsonify({
            'error': 'Application initialization failed',
            'message': init_error,
            'traceback': error_traceback
        }), 500

# Vercel expects the app to be exposed as a handler
handler = app

# For local testing, you can still run this directly
if __name__ == '__main__':
    if app:
        app.run()
