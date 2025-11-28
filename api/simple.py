"""Ultra-minimal test - no Flask, just plain WSGI."""

def handler(event, context):
    """Minimal handler for Vercel."""
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': '{"status": "success", "message": "Python works!"}'
    }
