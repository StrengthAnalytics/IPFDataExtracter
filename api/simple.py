"""Ultra-minimal test endpoint for Vercel."""
from flask import Flask

app = Flask(__name__)

@app.route('/')
@app.route('/simple')
def index():
    return {'status': 'success', 'message': 'Python and Flask work!'}

# Vercel handler
handler = app
