"""Routes package - exports all blueprints"""

from app.routes.auth import auth_bp
from app.routes.products import product_bp
from app.routes.warehouse import warehouse_bp


# Import các routes khác khi đã tạo
# from app.routes.orders import order_bp
# from app.routes.reports import report_bp
# from app.routes.sales import sales_bp
# from app.routes.suppliers import supplier_bp

# Temporary placeholder blueprints
from flask import Blueprint

order_bp = Blueprint('orders', __name__)
report_bp = Blueprint('reports', __name__)
sales_bp = Blueprint('sales', __name__)
supplier_bp = Blueprint('suppliers', __name__)

__all__ = [
    'auth_bp',
    'product_bp',
    'warehouse_bp',
    'order_bp',
    'report_bp',
    'sales_bp',
    'supplier_bp',
]
