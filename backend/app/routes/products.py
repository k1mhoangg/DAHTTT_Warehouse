"""Product management routes (UC01: Quản lý danh mục sản phẩm)"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.models import SanPham, LoSP
from app import db
from app.utils.auth import role_required
from app.utils.helpers import success_response, error_response, paginate, generate_id
from sqlalchemy import or_

product_bp = Blueprint('products', __name__)


@product_bp.route('', methods=['GET'])
@jwt_required()
def get_products():
    """
    Get list of products with pagination and filtering
    
    Query params:
        - page: Page number (default: 1)
        - per_page: Items per page (default: 20)
        - search: Search by name or code
        - loai: Filter by category
        - trang_thai: Filter by status
    """
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '')
    loai = request.args.get('loai', '')
    trang_thai = request.args.get('trang_thai', '')
    
    query = SanPham.query
    
    # Apply filters
    if search:
        query = query.filter(
            or_(
                SanPham.TenSP.contains(search),
                SanPham.MaSP.contains(search)
            )
        )
    
    if loai:
        query = query.filter(SanPham.LoaiSP == loai)
    
    if trang_thai:
        query = query.filter(SanPham.TrangThai == trang_thai)
    
    # Paginate
    result = paginate(query, page=page, per_page=per_page)
    
    return success_response(result)


@product_bp.route('/<string:ma_sp>', methods=['GET'])
@jwt_required()
def get_product(ma_sp):
    """Get product by ID with batch information"""
    
    product = SanPham.query.get(ma_sp)
    
    if not product:
        return error_response("Product not found", 404)
    
    # Get batches for this product
    batches = LoSP.query.filter_by(MaSP=ma_sp).all()
    
    product_data = product.to_dict()
    product_data['batches'] = [batch.to_dict() for batch in batches]
    product_data['total_stock'] = sum(batch.SLTon for batch in batches)
    
    return success_response(product_data)


@product_bp.route('', methods=['POST'])
@jwt_required()
@role_required('Quản lý')
def create_product():
    """
    Create new product (Quản lý only)
    
    Request body:
        {
            "MaSP": "string" (optional, auto-generated),
            "TenSP": "string",
            "LoaiSP": "string",
            "DVT": "string",
            "GiaBan": float,
            "MucCanhBaoDatHang": int
        }
    """
    data = request.get_json()
    
    # Validate required fields
    if not data.get('TenSP') or not data.get('GiaBan'):
        return error_response("TenSP and GiaBan are required", 400)
    
    # Generate product code if not provided
    ma_sp = data.get('MaSP')
    if not ma_sp:
        ma_sp = generate_id('SP', 4)
        # Ensure uniqueness
        while SanPham.query.get(ma_sp):
            ma_sp = generate_id('SP', 4)
    else:
        # Check if product code already exists
        if SanPham.query.get(ma_sp):
            return error_response("Product code already exists", 400)
    
    # Create new product
    product = SanPham(
        MaSP=ma_sp,
        TenSP=data.get('TenSP'),
        LoaiSP=data.get('LoaiSP'),
        DVT=data.get('DVT'),
        GiaBan=data.get('GiaBan'),
        MucCanhBaoDatHang=data.get('MucCanhBaoDatHang', 10)
    )
    
    db.session.add(product)
    db.session.commit()
    
    return success_response(
        product.to_dict(),
        message="Product created successfully",
        status=201
    )


@product_bp.route('/<string:ma_sp>', methods=['PUT'])
@jwt_required()
@role_required('Quản lý')
def update_product(ma_sp):
    """
    Update product information (Quản lý only)
    
    Request body:
        {
            "TenSP": "string",
            "LoaiSP": "string",
            "TrangThai": "string",
            "DVT": "string",
            "GiaBan": float,
            "MucCanhBaoDatHang": int
        }
    """
    product = SanPham.query.get(ma_sp)
    
    if not product:
        return error_response("Product not found", 404)
    
    data = request.get_json()
    
    # Update fields
    if 'TenSP' in data:
        product.TenSP = data['TenSP']
    if 'LoaiSP' in data:
        product.LoaiSP = data['LoaiSP']
    if 'TrangThai' in data:
        product.TrangThai = data['TrangThai']
    if 'DVT' in data:
        product.DVT = data['DVT']
    if 'GiaBan' in data:
        product.GiaBan = data['GiaBan']
    if 'MucCanhBaoDatHang' in data:
        product.MucCanhBaoDatHang = data['MucCanhBaoDatHang']
    
    db.session.commit()
    
    return success_response(
        product.to_dict(),
        message="Product updated successfully"
    )


@product_bp.route('/<string:ma_sp>', methods=['DELETE'])
@jwt_required()
@role_required('Quản lý')
def delete_product(ma_sp):
    """
    Delete product (Quản lý only)
    Note: This will also delete all associated batches
    """
    product = SanPham.query.get(ma_sp)
    
    if not product:
        return error_response("Product not found", 404)
    
    # Check if product has stock
    batches = LoSP.query.filter_by(MaSP=ma_sp).all()
    total_stock = sum(batch.SLTon for batch in batches)
    
    if total_stock > 0:
        return error_response(
            "Cannot delete product with existing stock. Please remove all stock first.",
            400
        )
    
    db.session.delete(product)
    db.session.commit()
    
    return success_response(
        message="Product deleted successfully"
    )


@product_bp.route('/categories', methods=['GET'])
@jwt_required()
def get_categories():
    """Get list of all product categories"""
    
    categories = db.session.query(SanPham.LoaiSP)\
        .filter(SanPham.LoaiSP.isnot(None))\
        .distinct()\
        .all()
    
    category_list = [cat[0] for cat in categories if cat[0]]
    
    return success_response({
        'categories': category_list
    })


@product_bp.route('/low-stock', methods=['GET'])
@jwt_required()
def get_low_stock_products():
    """
    Get products with stock below warning level
    Used for ordering suggestions
    """
    # Query products and their total stock
    products = SanPham.query.all()
    low_stock_products = []
    
    for product in products:
        batches = LoSP.query.filter_by(MaSP=product.MaSP).all()
        total_stock = sum(batch.SLTon for batch in batches)
        
        if total_stock < product.MucCanhBaoDatHang:
            product_data = product.to_dict()
            product_data['current_stock'] = total_stock
            product_data['needed'] = product.MucCanhBaoDatHang - total_stock
            low_stock_products.append(product_data)
    
    return success_response({
        'products': low_stock_products,
        'count': len(low_stock_products)
    })
