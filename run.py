"""Main entry point for the Flask application."""
import os
from app import create_app

# Get environment from environment variable
env = os.getenv('FLASK_ENV', 'development')

# Create the Flask app
app = create_app(env)

if __name__ == '__main__':
    # Run the development server
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'

    print(f"""
    ╔══════════════════════════════════════════════════════════╗
    ║                                                          ║
    ║         IPF Data Extracter API Server                   ║
    ║                                                          ║
    ║  Environment: {env:<42}  ║
    ║  Port: {port:<49}  ║
    ║  Debug: {str(debug):<48}  ║
    ║                                                          ║
    ║  API Documentation: http://localhost:{port}/api/v1       ║
    ║  Health Check: http://localhost:{port}/health            ║
    ║                                                          ║
    ╚══════════════════════════════════════════════════════════╝
    """)

    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug
    )
