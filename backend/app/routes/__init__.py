"""Routes package - exports all blueprints"""

from app.routes.auth import auth_bp
from app.routes.products import product_bp
from app.routes.warehouse import warehouse_bp
from app.routes.warehouse_inventory import warehouse_inventory_bp
from app.routes.orders import orders_bp
from app.routes.reports import reports_bp
from app.routes.sales import sales_bp

# Import các routes khác khi đã tạo
# from app.routes.orders import order_bp
# from app.routes.reports import report_bp
# from app.routes.suppliers import supplier_bp

# Temporary placeholder blueprints
from flask import Blueprint

supplier_bp = Blueprint('suppliers', __name__)

__all__ = [
    'auth_bp',
    'product_bp',
    'warehouse_bp',
    'warehouse_inventory_bp',
    'orders_bp',
    'reports_bp',
    'sales_bp',
    'supplier_bp',
]
