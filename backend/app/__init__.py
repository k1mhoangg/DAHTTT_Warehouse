from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from app.config import config
import traceback

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()


def create_app(config_name="default"):
    """Application factory pattern"""
    
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app, origins=app.config["CORS_ORIGINS"])
    jwt.init_app(app)
    
    # Register blueprints
    from app.routes import (
        auth_bp,
        product_bp,
        warehouse_bp,
        order_bp,
        report_bp,
        sales_bp,
        supplier_bp,
    )
    
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(product_bp, url_prefix="/api/products")
    app.register_blueprint(warehouse_bp, url_prefix="/api/warehouse")
    app.register_blueprint(order_bp, url_prefix="/api/orders")
    app.register_blueprint(report_bp, url_prefix="/api/reports")
    app.register_blueprint(sales_bp, url_prefix="/api/sales")
    app.register_blueprint(supplier_bp, url_prefix="/api/suppliers")
    
    # Register error handlers
    from app.utils.error_handlers import register_error_handlers
    register_error_handlers(app)
    
    @app.errorhandler(Exception)
    def handle_exception(e):
        """Global exception handler"""
        # Log the error
        app.logger.error(f"Unhandled exception: {str(e)}")
        app.logger.error(traceback.format_exc())
        
        # Return JSON response
        return jsonify({
            'success': False,
            'message': f"Internal server error: {str(e)}",
            'error': str(e)
        }), 500
    
    return app
