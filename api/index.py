"""Vercel serverless function entry point for Flask app."""
import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app

# Create the Flask app
app = create_app('production')

# Vercel expects the app to be exposed as a handler
# This allows Vercel to call the Flask app as a serverless function
handler = app

# For local testing, you can still run this directly
if __name__ == '__main__':
    app.run()
