"""Flask application factory."""
from flask import Flask
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from config import config


def create_app(config_name='default'):
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Initialize extensions
    CORS(app, origins=app.config['CORS_ORIGINS'])

    limiter = Limiter(
        get_remote_address,
        app=app,
        default_limits=[app.config['RATELIMIT_DEFAULT']],
        storage_uri=app.config['RATELIMIT_STORAGE_URL']
    )

    # Register blueprints
    from app.api.routes import api_bp
    app.register_blueprint(api_bp, url_prefix='/api/v1')

    # Health check endpoint
    @app.route('/health')
    def health_check():
        return {'status': 'healthy', 'service': 'IPF Data Extracter'}, 200

    return app
