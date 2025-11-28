"""Flask API for Vercel serverless deployment."""
from flask import Flask, jsonify
import os

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({
        'status': 'healthy',
        'service': 'IPF Data Extracter API',
        'message': 'Flask is running on Vercel!'
    })

@app.route('/health')
def health():
    return jsonify({'status': 'ok'})

@app.route('/api/<path:path>')
def api_catch_all(path):
    return jsonify({
        'message': f'API endpoint /{path} not implemented yet',
        'status': 'coming soon'
    })

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({'error': 'Internal server error'}), 500
