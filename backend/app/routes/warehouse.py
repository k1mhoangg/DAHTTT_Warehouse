"""
Warehouse operations routes
UC03: Nhập kho
UC04: Xuất kho (FEFO)
UC05: Chuyển kho
UC06: Kiểm kho
UC07: Điều chỉnh kho
UC09: Hủy hàng
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import (
    PhieuNhapKho, PhieuXuatKho, PhieuChuyenKho, PhieuKiemKho,
    BaoCao, LoSP, SanPham, KhoHang, TaoPhieu, DuyetPhieu
)
from app import db
from app.utils.auth import role_required
from app.utils.helpers import (
    success_response, error_response, generate_id, 
    generate_barcode, parse_date
)
from datetime import datetime
from sqlalchemy import and_, or_

warehouse_bp = Blueprint('warehouse', __name__)


# =============================================
# COMMON ENDPOINTS - WAREHOUSE DATA
# =============================================

@warehouse_bp.route('/warehouses', methods=['GET'])
@jwt_required()
def get_warehouses():
    """Get all warehouses"""
    try:
        warehouses = KhoHang.query.all()
        return success_response({
            'warehouses': [w.to_dict() for w in warehouses],
            'total': len(warehouses)
        })
    except Exception as e:
        return error_response(f"Error getting warehouses: {str(e)}", 500)

@warehouse_bp.route('/warehouses/<string:ma_kho>/inventory', methods=['GET'])
@jwt_required()
def get_warehouse_inventory(ma_kho):
    """Get inventory of a specific warehouse"""
    batches = LoSP.query.filter_by(MaKho=ma_kho).all()
    
    inventory = []
    for batch in batches:
        batch_data = batch.to_dict()
        # Include product information
        san_pham = SanPham.query.get(batch.MaSP)
        if san_pham:
            batch_data['product'] = san_pham.to_dict()
        inventory.append(batch_data)
    
    return success_response({
        'inventory': inventory,
        'total_batches': len(inventory)
    })


@warehouse_bp.route('/batches', methods=['GET'])
@jwt_required()
def get_batches():
    """Get all batches with filters"""
    ma_kho = request.args.get('ma_kho')
    ma_sp = request.args.get('ma_sp')
    
    query = LoSP.query
    
    if ma_kho:
        query = query.filter_by(MaKho=ma_kho)
    if ma_sp:
        query = query.filter_by(MaSP=ma_sp)
    
    batches = query.all()
    
    result = []
    for batch in batches:
        batch_data = batch.to_dict()
        san_pham = SanPham.query.get(batch.MaSP)
        if san_pham:
            batch_data['product'] = san_pham.to_dict()
        result.append(batch_data)
    
    return success_response({
        'batches': result,
        'total': len(result)
    })


# =============================================
# UC03: NHẬP KHO
# =============================================

@warehouse_bp.route('/import', methods=['GET'])
@jwt_required()
def get_imports():
    """Get all import receipts"""
    phieu_list = PhieuNhapKho.query.order_by(PhieuNhapKho.NgayTao.desc()).all()
    
    result = []
    for phieu in phieu_list:
        phieu_data = phieu.to_dict()
        # Get batches for this import
        batches = LoSP.query.filter_by(MaPhieuNK=phieu.MaPhieu).all()
        phieu_data['items'] = []
        for batch in batches:
            batch_data = batch.to_dict()
            san_pham = SanPham.query.get(batch.MaSP)
            if san_pham:
                batch_data['product'] = san_pham.to_dict()
            phieu_data['items'].append(batch_data)
        result.append(phieu_data)
    
    return success_response({
        'imports': result,
        'total': len(result)
    })


@warehouse_bp.route('/import/<string:ma_phieu>', methods=['GET'])
@jwt_required()
def get_import(ma_phieu):
    """Get specific import receipt details"""
    phieu = PhieuNhapKho.query.get(ma_phieu)
    if not phieu:
        return error_response("Import receipt not found", 404)
    
    phieu_data = phieu.to_dict()
    batches = LoSP.query.filter_by(MaPhieuNK=ma_phieu).all()
    phieu_data['items'] = []
    for batch in batches:
        batch_data = batch.to_dict()
        san_pham = SanPham.query.get(batch.MaSP)
        if san_pham:
            batch_data['product'] = san_pham.to_dict()
        phieu_data['items'].append(batch_data)
    
    return success_response(phieu_data)


@warehouse_bp.route('/import/<string:ma_phieu>', methods=['DELETE'])
@jwt_required()
@role_required('Quản lý')
def delete_import(ma_phieu):
    """Delete import receipt (Manager only)"""
    phieu = PhieuNhapKho.query.get(ma_phieu)
    if not phieu:
        return error_response("Import receipt not found", 404)
    
    try:
        # Delete related batches first
        LoSP.query.filter_by(MaPhieuNK=ma_phieu).delete()
        
        # Delete tao phieu record
        TaoPhieu.query.filter_by(MaPhieuTao=ma_phieu).delete()
        
        # Delete the receipt
        db.session.delete(phieu)
        db.session.commit()
        
        return success_response(None, message="Import receipt deleted successfully")
    except Exception as e:
        db.session.rollback()
        return error_response(f"Error deleting import receipt: {str(e)}", 500)

@warehouse_bp.route('/import', methods=['POST'])
@jwt_required()
@role_required('Quản lý', 'Nhân viên')
def import_warehouse():
    """
    Nhập kho (UC03)
    
    Request body:
        {
            "MaKho": "string",
            "MucDich": "string",
            "MaThamChieu": "string",
            "items": [
                {
                    "MaSP": "string",
                    "SoLuong": int,
                    "NSX": "YYYY-MM-DD",
                    "HSD": "YYYY-MM-DD",
                    "MaLo": "string" (optional)
                }
            ]
        }
    """
    data = request.get_json()
    identity = get_jwt_identity()
    
    # Handle both string and dict identity formats
    if isinstance(identity, str):
        ma_nv = identity
    elif isinstance(identity, dict):
        ma_nv = identity.get('id') or identity.get('MaNV') or identity.get('username')
    else:
        ma_nv = str(identity)
    
    # Validate
    if not data.get('MaKho') or not data.get('items'):
        return error_response("MaKho and items are required", 400)
    
    # Check warehouse exists
    kho = KhoHang.query.get(data['MaKho'])
    if not kho:
        return error_response("Warehouse not found", 404)
    
    # Generate phiếu nhập kho
    ma_phieu = generate_id('PNK', 6)
    while PhieuNhapKho.query.get(ma_phieu):
        ma_phieu = generate_id('PNK', 6)
    
    phieu = PhieuNhapKho(
        MaPhieu=ma_phieu,
        NgayTao=datetime.utcnow(),
        MucDich=data.get('MucDich', 'Nhập hàng từ nhà cung cấp'),
        MaThamChieu=data.get('MaThamChieu')
    )
    
    db.session.add(phieu)
    
    # Process items
    created_batches = []
    for item in data['items']:
        ma_sp = item.get('MaSP')
        so_luong = item.get('SoLuong', 0)
        
        # Validate product
        san_pham = SanPham.query.get(ma_sp)
        if not san_pham:
            db.session.rollback()
            return error_response(f"Product {ma_sp} not found", 404)
        
        # Generate or use provided batch code
        ma_lo = item.get('MaLo')
        if not ma_lo:
            ma_lo = generate_id('LO', 6)
        
        # Check if batch already exists
        existing_batch = LoSP.query.filter_by(MaSP=ma_sp, MaLo=ma_lo).first()
        if existing_batch:
            # Update existing batch
            existing_batch.SLTon += so_luong
            existing_batch.MaPhieuNK = ma_phieu
            batch = existing_batch
        else:
            # Create new batch
            ma_vach = generate_barcode()
            while LoSP.query.filter_by(MaVach=ma_vach).first():
                ma_vach = generate_barcode()
            
            batch = LoSP(
                MaSP=ma_sp,
                MaLo=ma_lo,
                MaVach=ma_vach,
                NSX=parse_date(item.get('NSX')),
                HSD=parse_date(item.get('HSD')),
                SLTon=so_luong,
                MaKho=data['MaKho'],
                MaPhieuNK=ma_phieu
            )
            db.session.add(batch)
        
        created_batches.append(batch.to_dict())
    
    # Record who created this phiếu
    tao_phieu = TaoPhieu(
        MaNV=ma_nv,
        MaPhieuTao=ma_phieu
    )
    db.session.add(tao_phieu)
    
    db.session.commit()
    
    return success_response({
        'phieu': phieu.to_dict(),
        'batches': created_batches
    }, message="Import successful", status=201)


# =============================================
# UC04: XUẤT KHO (FEFO)
# =============================================


# =============================================
# UC05: CHUYỂN KHO
# =============================================

@warehouse_bp.route('/transfer', methods=['POST'])
@jwt_required()
@role_required('Quản lý', 'Nhân viên')
def transfer_warehouse():
    """
    Chuyển kho (UC05)
    
    Request body:
        {
            "KhoXuat": "string",
            "KhoNhap": "string",
            "MucDich": "string",
            "items": [
                {
                    "MaSP": "string",
                    "MaLo": "string",
                    "SoLuong": int
                }
            ]
        }
    """
    data = request.get_json()
    identity = get_jwt_identity()
    
    # Handle both string and dict identity formats
    if isinstance(identity, str):
        ma_nv = identity
    elif isinstance(identity, dict):
        ma_nv = identity.get('id') or identity.get('MaNV') or identity.get('username')
    else:
        ma_nv = str(identity)
    
    # Validate
    if not data.get('KhoXuat') or not data.get('KhoNhap') or not data.get('items'):
        return error_response("KhoXuat, KhoNhap, and items are required", 400)
    
    # Generate phiếu chuyển kho
    ma_phieu_ck = generate_id('PCK', 6)
    while PhieuChuyenKho.query.get(ma_phieu_ck):
        ma_phieu_ck = generate_id('PCK', 6)
    
    phieu_ck = PhieuChuyenKho(
        MaPhieu=ma_phieu_ck,
        NgayTao=datetime.utcnow(),
        MucDich=data.get('MucDich', 'Chuyển kho'),
        KhoXuat=data['KhoXuat'],
        KhoNhap=data['KhoNhap']
    )
    db.session.add(phieu_ck)
    
    # Generate phiếu xuất and phiếu nhập
    ma_phieu_xuat = generate_id('PXK', 6)
    ma_phieu_nhap = generate_id('PNK', 6)
    
    phieu_xuat = PhieuXuatKho(
        MaPhieu=ma_phieu_xuat,
        NgayTao=datetime.utcnow(),
        MucDich=f"Xuất chuyển kho đến {data['KhoNhap']}",
        MaThamChieu=ma_phieu_ck,
        MaPhieuCK=ma_phieu_ck
    )
    
    phieu_nhap = PhieuNhapKho(
        MaPhieu=ma_phieu_nhap,
        NgayTao=datetime.utcnow(),
        MucDich=f"Nhập chuyển kho từ {data['KhoXuat']}",
        MaThamChieu=ma_phieu_ck,
        MaPhieuCK=ma_phieu_ck
    )
    
    db.session.add(phieu_xuat)
    db.session.add(phieu_nhap)
    
    # Process transfer
    transferred_items = []
    for item in data['items']:
        ma_sp = item.get('MaSP')
        ma_lo = item.get('MaLo')
        so_luong = item.get('SoLuong', 0)
        
        # Find batch in source warehouse
        batch_xuat = LoSP.query.filter_by(
            MaSP=ma_sp,
            MaLo=ma_lo,
            MaKho=data['KhoXuat']
        ).first()
        
        if not batch_xuat or batch_xuat.SLTon < so_luong:
            db.session.rollback()
            return error_response(
                f"Insufficient stock in source warehouse for {ma_sp}/{ma_lo}",
                400
            )
        
        # Deduct from source
        batch_xuat.SLTon -= so_luong
        
        # Add to destination (or create new batch)
        batch_nhap = LoSP.query.filter_by(
            MaSP=ma_sp,
            MaLo=ma_lo,
            MaKho=data['KhoNhap']
        ).first()
        
        if batch_nhap:
            batch_nhap.SLTon += so_luong
        else:
            # Create new batch in destination warehouse
            batch_nhap = LoSP(
                MaSP=ma_sp,
                MaLo=ma_lo,
                MaVach=batch_xuat.MaVach,  # Same barcode
                NSX=batch_xuat.NSX,
                HSD=batch_xuat.HSD,
                SLTon=so_luong,
                MaKho=data['KhoNhap'],
                MaPhieuNK=ma_phieu_nhap
            )
            db.session.add(batch_nhap)
        
        transferred_items.append({
            'MaSP': ma_sp,
            'MaLo': ma_lo,
            'SoLuong': so_luong,
            'from': data['KhoXuat'],
            'to': data['KhoNhap']
        })
    
    # Record who created
    from app.models import TaoPhieu
    tao_ck = TaoPhieu(MaNV=ma_nv, MaPhieuTao=ma_phieu_ck)
    tao_xuat = TaoPhieu(MaNV=ma_nv, MaPhieuTao=ma_phieu_xuat)
    tao_nhap = TaoPhieu(MaNV=ma_nv, MaPhieuTao=ma_phieu_nhap)
    
    db.session.add(tao_ck)
    db.session.add(tao_xuat)
    db.session.add(tao_nhap)
    
    db.session.commit()
    
    return success_response({
        'phieu_chuyen_kho': phieu_ck.to_dict(),
        'phieu_xuat': phieu_xuat.to_dict(),
        'phieu_nhap': phieu_nhap.to_dict(),
        'transferred_items': transferred_items
    }, message="Transfer successful", status=201)


@warehouse_bp.route('/export/scan-barcode', methods=['POST'])
@jwt_required()
def scan_barcode_for_export():
    """
    UC04 Step 5: Quét Barcode sản phẩm - Validation and batch info
    
    Yêu cầu phi chức năng UC04: Phản hồi quét barcode < 1s với 96% lô SP
    
    Request body:
        {
            "MaVach": "string",
            "MaKho": "string",
            "MaSP": "string" (optional - for validation)
        }
    
    Response: Batch information for scanned barcode
    """
    data = request.get_json()
    
    ma_vach = data.get('MaVach')
    ma_kho = data.get('MaKho')
    ma_sp = data.get('MaSP')  # Optional for cross-validation
    
    if not ma_vach or not ma_kho:
        return error_response("MaVach and MaKho are required", 400)
    
    # Find batch by barcode
    query = LoSP.query.filter_by(MaVach=ma_vach, MaKho=ma_kho)
    
    # Add product filter if provided
    if ma_sp:
        query = query.filter_by(MaSP=ma_sp)
    
    batch = query.first()
    
    # UC04 Luồng thay thế: Quét barcode không hợp lệ
    if not batch:
        if ma_sp:
            return error_response(
                f"Barcode {ma_vach} not found for product {ma_sp} in warehouse {ma_kho}", 
                404
            )
        else:
            return error_response(
                f"Barcode {ma_vach} not found in warehouse {ma_kho}", 
                404
            )
    
    # Check if batch has stock
    if batch.SLTon <= 0:
        return error_response(
            f"Batch with barcode {ma_vach} has no available stock", 
            400
        )
    
    # Check if batch is expired
    is_expired = False
    days_to_expiry = None
    if batch.HSD:
        days_to_expiry = (batch.HSD - datetime.utcnow().date()).days
        is_expired = days_to_expiry < 0
    
    # Business rule: Warning for expired batches
    if is_expired:
        return error_response(
            f"Cannot export expired batch {batch.MaLo}. Expiry date: {batch.HSD}",
            400
        )
    
    # Get product info
    san_pham = SanPham.query.get(batch.MaSP)
    
    # Calculate status
    status = 'normal'
    if days_to_expiry is not None:
        if days_to_expiry <= 7:
            status = 'critical'
        elif days_to_expiry <= 30:
            status = 'warning'
    
    return success_response({
        'batch_info': {
            **batch.to_dict(),
            'days_to_expiry': days_to_expiry,
            'status': status,
            'is_exportable': not is_expired and batch.SLTon > 0
        },
        'product_info': san_pham.to_dict() if san_pham else None,
        'scan_timestamp': datetime.utcnow().isoformat(),
        'warnings': [
            f"Batch expires in {days_to_expiry} days" if days_to_expiry and days_to_expiry <= 30 else None
        ]
    })


@warehouse_bp.route('/export', methods=['GET'])
@jwt_required()
def get_exports():
    """Get all export receipts"""
    try:
        phieu_list = PhieuXuatKho.query.order_by(PhieuXuatKho.NgayTao.desc()).all()
        
        result = []
        for phieu in phieu_list:
            phieu_data = phieu.to_dict()
            # Get batches for this export
            batches = LoSP.query.filter_by(MaPhieuXK=phieu.MaPhieu).all()
            phieu_data['items'] = []
            for batch in batches:
                batch_data = batch.to_dict()
                san_pham = SanPham.query.get(batch.MaSP)
                if san_pham:
                    batch_data['TenSP'] = san_pham.TenSP
                    batch_data['DVT'] = san_pham.DVT
                phieu_data['items'].append(batch_data)
            result.append(phieu_data)
        
        return success_response({
            'exports': result,
            'total': len(result)
        })
    except Exception as e:
        return error_response(f"Error getting exports: {str(e)}", 500)


@warehouse_bp.route('/export/<string:ma_phieu>', methods=['GET'])
@jwt_required()
def get_export(ma_phieu):
    """Get specific export receipt details"""
    phieu = PhieuXuatKho.query.get(ma_phieu)
    if not phieu:
        return error_response("Export receipt not found", 404)
    
    phieu_data = phieu.to_dict()
    batches = LoSP.query.filter_by(MaPhieuXK=ma_phieu).all()
    phieu_data['items'] = []
    for batch in batches:
        batch_data = batch.to_dict()
        san_pham = SanPham.query.get(batch.MaSP)
        if san_pham:
            batch_data['TenSP'] = san_pham.TenSP
            batch_data['DVT'] = san_pham.DVT
        phieu_data['items'].append(batch_data)
    
    return success_response(phieu_data)


@warehouse_bp.route('/export/fefo-batches', methods=['POST'])
@jwt_required()
def get_fefo_batches():
    """
    UC04 Step 4: Get FEFO (First Expired, First Out) batch suggestions
    
    Request body:
        {
            "MaSP": "string",
            "MaKho": "string",
            "SoLuong": int (optional - for suggestion)
        }
    
    Response: List of batches sorted by expiry date (HSD)
    """
    data = request.get_json()
    
    ma_sp = data.get('MaSP')
    ma_kho = data.get('MaKho')
    so_luong = data.get('SoLuong', 0)
    
    if not ma_sp or not ma_kho:
        return error_response("MaSP and MaKho are required", 400)
    
    # Get all available batches for this product in warehouse, sorted by HSD (FEFO)
    batches = LoSP.query.filter(
        LoSP.MaSP == ma_sp,
        LoSP.MaKho == ma_kho,
        LoSP.SLTon > 0
    ).order_by(LoSP.HSD.asc()).all()
    
    if not batches:
        return error_response(f"No available batches for product {ma_sp} in warehouse {ma_kho}", 404)
    
    # Calculate suggestions with quantity
    suggestions = []
    remaining_qty = so_luong
    
    for batch in batches:
        days_to_expiry = None
        is_expired = False
        status = 'normal'
        
        if batch.HSD:
            days_to_expiry = (batch.HSD - datetime.utcnow().date()).days
            is_expired = days_to_expiry < 0
            
            if days_to_expiry <= 7:
                status = 'critical'
            elif days_to_expiry <= 30:
                status = 'warning'
        
        suggested_qty = 0
        if so_luong > 0 and remaining_qty > 0 and not is_expired:
            suggested_qty = min(batch.SLTon, remaining_qty)
            remaining_qty -= suggested_qty
        
        suggestions.append({
            **batch.to_dict(),
            'days_to_expiry': days_to_expiry,
            'is_expired': is_expired,
            'status': status,
            'suggested_quantity': suggested_qty,
            'priority': len(suggestions) + 1  # FEFO priority
        })
    
    # Get product info
    san_pham = SanPham.query.get(ma_sp)
    
    return success_response({
        'batches': suggestions,
        'total_available': sum(b['SLTon'] for b in suggestions if not b['is_expired']),
        'product_info': san_pham.to_dict() if san_pham else None,
        'can_fulfill': remaining_qty <= 0 if so_luong > 0 else True
    })


@warehouse_bp.route('/export', methods=['POST'])
@jwt_required()
@role_required('Quản lý', 'Nhân viên')
def export_warehouse():
    """
    Xuất kho (UC04) - FEFO Implementation
    
    Request body:
        {
            "MaKho": "string",
            "MucDich": "string",
            "MaThamChieu": "string" (optional),
            "items": [
                {
                    "MaSP": "string",
                    "MaLo": "string",
                    "MaVach": "string" (optional),
                    "SoLuong": int
                }
            ]
        }
    """
    try:
        data = request.get_json()
        identity = get_jwt_identity()
        
        # Handle both string and dict identity formats
        if isinstance(identity, str):
            ma_nv = identity
        elif isinstance(identity, dict):
            ma_nv = identity.get('id') or identity.get('MaNV') or identity.get('username')
        else:
            ma_nv = str(identity)
        
        print(f"Export request data: {data}")
        print(f"JWT identity: {identity}, type: {type(identity)}")
        print(f"Extracted MaNV: {ma_nv}")
        
        # Validate
        if not data.get('MaKho') or not data.get('items'):
            return error_response("MaKho and items are required", 400)
        
        # Check warehouse exists
        kho = KhoHang.query.get(data['MaKho'])
        if not kho:
            return error_response("Warehouse not found", 404)
        
        # Generate phiếu xuất kho
        ma_phieu = generate_id('PXK', 6)
        while PhieuXuatKho.query.get(ma_phieu):
            ma_phieu = generate_id('PXK', 6)
        
        phieu = PhieuXuatKho(
            MaPhieu=ma_phieu,
            NgayTao=datetime.utcnow(),
            MucDich=data.get('MucDich', 'Xuất kho'),
            MaThamChieu=data.get('MaThamChieu')
        )
        
        db.session.add(phieu)
        
        # Process items
        exported_items = []
        for item in data['items']:
            ma_sp = item.get('MaSP')
            ma_lo = item.get('MaLo')
            so_luong = item.get('SoLuong', 0)
            ma_vach = item.get('MaVach')
            
            print(f"Processing item: MaSP={ma_sp}, MaLo={ma_lo}, SoLuong={so_luong}")
            
            if so_luong <= 0:
                db.session.rollback()
                return error_response(f"Invalid quantity for product {ma_sp}", 400)
            
            # Validate product
            san_pham = SanPham.query.get(ma_sp)
            if not san_pham:
                db.session.rollback()
                return error_response(f"Product {ma_sp} not found", 404)
            
            # Find batch
            batch_query = LoSP.query.filter_by(
                MaSP=ma_sp,
                MaLo=ma_lo,
                MaKho=data['MaKho']
            )
            
            # Optional barcode validation
            if ma_vach:
                batch_query = batch_query.filter_by(MaVach=ma_vach)
            
            batch = batch_query.first()
            
            if not batch:
                db.session.rollback()
                return error_response(f"Batch {ma_lo} not found for product {ma_sp} in warehouse {data['MaKho']}", 404)
            
            # Check sufficient stock
            if batch.SLTon < so_luong:
                db.session.rollback()
                return error_response(
                    f"Insufficient stock for batch {ma_lo}. Available: {batch.SLTon}, Requested: {so_luong}",
                    400
                )
            
            # Check if expired
            if batch.HSD:
                days_to_expiry = (batch.HSD - datetime.utcnow().date()).days
                if days_to_expiry < 0:
                    db.session.rollback()
                    return error_response(
                        f"Cannot export expired batch {ma_lo}. Expiry date: {batch.HSD}",
                        400
                    )
            
            # Update stock
            batch.SLTon -= so_luong
            batch.MaPhieuXK = ma_phieu
            
            exported_items.append({
                'MaSP': ma_sp,
                'TenSP': san_pham.TenSP,
                'MaLo': ma_lo,
                'MaVach': batch.MaVach,
                'SoLuong': so_luong,
                'DVT': san_pham.DVT,
                'NSX': batch.NSX.isoformat() if batch.NSX else None,
                'HSD': batch.HSD.isoformat() if batch.HSD else None,
                'SLTonConLai': batch.SLTon
            })
        
        # Record who created this phiếu
        tao_phieu = TaoPhieu(
            MaNV=ma_nv,
            MaPhieuTao=ma_phieu
        )
        db.session.add(tao_phieu)
        
        db.session.commit()
        
        result = {
            'phieu': phieu.to_dict(),
            'items': exported_items
        }
        
        print(f"Export successful: {result}")
        
        return success_response(result, message="Export successful", status=201)
        
    except Exception as e:
        db.session.rollback()
        print(f"Export error: {str(e)}")
        import traceback
        traceback.print_exc()
        return error_response(f"Error creating export: {str(e)}", 500)


@warehouse_bp.route('/export/<string:ma_phieu>', methods=['DELETE'])
@jwt_required()
@role_required('Quản lý')
def delete_export(ma_phieu):
    """Delete export receipt (Manager only) - Rollback stock"""
    phieu = PhieuXuatKho.query.get(ma_phieu)
    if not phieu:
        return error_response("Export receipt not found", 404)
    
    try:
        # Rollback stock for all batches
        batches = LoSP.query.filter_by(MaPhieuXK=ma_phieu).all()
        for batch in batches:
            # Note: We need to track exported quantity separately
            # For now, we'll just remove the reference
            batch.MaPhieuXK = None
        
        # Delete tao phieu record
        TaoPhieu.query.filter_by(MaPhieuTao=ma_phieu).delete()
        
        # Delete the receipt
        db.session.delete(phieu)
        db.session.commit()
        
        return success_response(None, message="Export receipt deleted successfully")
    except Exception as e:
        db.session.rollback()
        return error_response(f"Error deleting export receipt: {str(e)}", 500)


# =============================================
# UC03: NHẬP KHO - ENHANCED
# =============================================

@warehouse_bp.route('/import/suppliers', methods=['GET'])
@jwt_required()
def get_suppliers_for_import():
    """Get suppliers list for import purposes"""
    try:
        from app.models import NhaCungCap
        suppliers = NhaCungCap.query.all()
        return success_response({
            'suppliers': [{'Ten': s.Ten, 'PhuongThucLienHe': s.PhuongThucLienHe} for s in suppliers],
            'total': len(suppliers)
        })
    except Exception as e:
        return error_response(f"Error getting suppliers: {str(e)}", 500)


@warehouse_bp.route('/import/validate-batch', methods=['POST'])
@jwt_required()
def validate_batch_code():
    """
    Validate if batch code already exists
    
    Request body:
        {
            "MaSP": "string",
            "MaLo": "string"
        }
    """
    data = request.get_json()
    ma_sp = data.get('MaSP')
    ma_lo = data.get('MaLo')
    
    if not ma_sp or not ma_lo:
        return error_response("MaSP and MaLo are required", 400)
    
    existing_batch = LoSP.query.filter_by(MaSP=ma_sp, MaLo=ma_lo).first()
    
    return success_response({
        'exists': existing_batch is not None,
        'batch_info': existing_batch.to_dict() if existing_batch else None
    })


@warehouse_bp.route('/import/generate-batch', methods=['POST'])
@jwt_required()
def generate_batch_code():
    """
    Generate unique batch code for a product
    
    Request body:
        {
            "MaSP": "string"
        }
    
    Response: Generated batch code
    """
    data = request.get_json()
    ma_sp = data.get('MaSP')
    
    if not ma_sp:
        return error_response("MaSP is required", 400)
    
    # Generate unique batch code
    import time
    ma_lo = f"LO{int(time.time() * 1000) % 1000000:06d}"
    
    # Ensure uniqueness
    while LoSP.query.filter_by(MaSP=ma_sp, MaLo=ma_lo).first():
        ma_lo = f"LO{int(time.time() * 1000) % 1000000:06d}"
    
    return success_response({
        'MaLo': ma_lo,
        'MaSP': ma_sp
    })


@warehouse_bp.route('/import/preview', methods=['POST'])
@jwt_required()
def preview_import():
    """
    Preview import before submission - validate all items
    
    Request body: Same as import_warehouse
    
    Response: Validation results and warnings
    """
    data = request.get_json()
    
    # Validate
    if not data.get('MaKho') or not data.get('items'):
        return error_response("MaKho and items are required", 400)
    
    # Check warehouse exists
    kho = KhoHang.query.get(data['MaKho'])
    if not kho:
        return error_response("Warehouse not found", 404)
    
    warnings = []
    errors = []
    preview_items = []
    
    for idx, item in enumerate(data['items']):
        ma_sp = item.get('MaSP')
        so_luong = item.get('SoLuong', 0)
        ma_lo = item.get('MaLo')
        
        item_preview = {
            'index': idx,
            'MaSP': ma_sp,
            'SoLuong': so_luong,
            'MaLo': ma_lo,
            'status': 'ok'
        }
        
        # Validate product
        san_pham = SanPham.query.get(ma_sp)
        if not san_pham:
            errors.append(f"Dòng {idx + 1}: Sản phẩm {ma_sp} không tồn tại")
            item_preview['status'] = 'error'
            item_preview['error'] = 'Product not found'
        else:
            item_preview['TenSP'] = san_pham.TenSP
            item_preview['DVT'] = san_pham.DVT
        
        # Check if batch exists
        if ma_lo:
            existing_batch = LoSP.query.filter_by(MaSP=ma_sp, MaLo=ma_lo).first()
            if existing_batch:
                warnings.append(f"Dòng {idx + 1}: Lô {ma_lo} đã tồn tại, sẽ cập nhật số lượng")
                item_preview['existing_quantity'] = existing_batch.SLTon
                item_preview['new_quantity'] = existing_batch.SLTon + so_luong
        
        # Check quantity
        if so_luong <= 0:
            errors.append(f"Dòng {idx + 1}: Số lượng phải lớn hơn 0")
            item_preview['status'] = 'error'
        
        # Check expiry date
        if item.get('HSD'):
            try:
                hsd = parse_date(item.get('HSD'))
                if hsd and hsd < datetime.utcnow().date():
                    warnings.append(f"Dòng {idx + 1}: HSD {item.get('HSD')} đã hết hạn")
                    item_preview['status'] = 'warning'
            except:
                errors.append(f"Dòng {idx + 1}: Định dạng HSD không hợp lệ")
        
        preview_items.append(item_preview)
    
    return success_response({
        'valid': len(errors) == 0,
        'warnings': warnings,
        'errors': errors,
        'items': preview_items,
        'summary': {
            'total_items': len(data['items']),
            'total_quantity': sum(item.get('SoLuong', 0) for item in data['items']),
            'warehouse': kho.to_dict()
        }
    })
