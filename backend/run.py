"""Entry point for running the Flask application"""

import os
from app import create_app, db

# Get config from environment
config_name = os.getenv('FLASK_ENV', 'development')

# Create app
app = create_app(config_name)

if __name__ == '__main__':
    with app.app_context():
        # Create tables if they don't exist
        # Note: Use Flask-Migrate for production
        db.create_all()
    
    # Run the app
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )
