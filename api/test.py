"""Minimal test endpoint to verify Vercel Python runtime."""
from flask import Flask, jsonify
import sys
import os

app = Flask(__name__)

@app.route('/')
@app.route('/test')
def test():
    return jsonify({
        'status': 'success',
        'message': 'Basic Flask works',
        'python_version': sys.version,
        'environment_vars': {
            'SUPABASE_URL': 'set' if os.getenv('SUPABASE_URL') else 'not set',
            'SUPABASE_KEY': 'set' if os.getenv('SUPABASE_KEY') else 'not set',
            'SECRET_KEY': 'set' if os.getenv('SECRET_KEY') else 'not set',
        }
    })

handler = app
