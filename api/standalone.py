"""Standalone endpoint with zero dependencies on app/ directory."""
from flask import Flask, jsonify
import os

app = Flask(__name__)

@app.route('/')
@app.route('/standalone')
def standalone():
    """Test endpoint that works completely independently."""
    return jsonify({
        'status': 'healthy',
        'message': 'Standalone Python + Flask works!',
        'env_vars_present': {
            'SUPABASE_URL': bool(os.getenv('SUPABASE_URL')),
            'SUPABASE_KEY': bool(os.getenv('SUPABASE_KEY')),
            'SECRET_KEY': bool(os.getenv('SECRET_KEY')),
        }
    })

@app.route('/health')
def health():
    """Health check."""
    return jsonify({'status': 'ok'})

# Vercel handler
app_handler = app
handler = app
