"""Flask API for Vercel serverless deployment."""
import sys
import os

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app

# Create the Flask app with production config
app = create_app('production')

# Health check endpoint (also available via blueprint)
@app.route('/health')
def health_check():
    return {'status': 'healthy', 'service': 'IPF Data Extracter'}, 200
