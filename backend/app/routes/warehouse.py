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
    
    Chuyển TOÀN BỘ lô từ kho này sang kho khác (không chia lô)
    
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
        
        print(f"Transfer request data: {data}")
        
        # Validate
        if not data.get('KhoXuat') or not data.get('KhoNhap') or not data.get('items'):
            return error_response("KhoXuat, KhoNhap, and items are required", 400)
        
        if data['KhoXuat'] == data['KhoNhap']:
            return error_response("Source and destination warehouses must be different", 400)
        
        # Check warehouses exist
        kho_xuat = KhoHang.query.get(data['KhoXuat'])
        kho_nhap = KhoHang.query.get(data['KhoNhap'])
        
        if not kho_xuat or not kho_nhap:
            return error_response("Warehouse not found", 404)
        
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
        
        # Generate phiếu xuất and phiếu nhập (for tracking only)
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
            
            print(f"Processing transfer: MaSP={ma_sp}, MaLo={ma_lo}, SoLuong={so_luong}")
            
            # Find batch in source warehouse
            batch_xuat = LoSP.query.filter_by(
                MaSP=ma_sp,
                MaLo=ma_lo,
                MaKho=data['KhoXuat']
            ).first()
            
            if not batch_xuat:
                db.session.rollback()
                return error_response(
                    f"Batch {ma_lo} not found for product {ma_sp} in warehouse {data['KhoXuat']}",
                    404
                )
            
            if batch_xuat.SLTon < so_luong:
                db.session.rollback()
                return error_response(
                    f"Insufficient stock in source warehouse for {ma_sp}/{ma_lo}. Available: {batch_xuat.SLTon}, Requested: {so_luong}",
                    400
                )
            
            # Check if transferring entire batch or partial
            if so_luong == batch_xuat.SLTon:
                # Transfer entire batch - just update MaKho
                print(f"Transferring entire batch {ma_lo}: {so_luong} units")
                batch_xuat.MaKho = data['KhoNhap']
                batch_xuat.MaPhieuNK = ma_phieu_nhap
                # Keep existing MaPhieuXK reference
                
                transferred_items.append({
                    'MaSP': ma_sp,
                    'MaLo': ma_lo,
                    'SoLuong': so_luong,
                    'transfer_type': 'full',
                    'from': data['KhoXuat'],
                    'to': data['KhoNhap']
                })
            else:
                # Partial transfer - need to split batch
                print(f"Partial transfer batch {ma_lo}: {so_luong}/{batch_xuat.SLTon} units")
                
                # Deduct from source
                batch_xuat.SLTon -= so_luong
                batch_xuat.MaPhieuXK = ma_phieu_xuat
                
                # Check if batch already exists in destination
                batch_nhap = LoSP.query.filter_by(
                    MaSP=ma_sp,
                    MaLo=ma_lo,
                    MaKho=data['KhoNhap']
                ).first()
                
                if batch_nhap:
                    # Batch already exists in destination - just add quantity
                    batch_nhap.SLTon += so_luong
                    batch_nhap.MaPhieuNK = ma_phieu_nhap
                else:
                    # Create new batch in destination with DIFFERENT batch code to avoid PRIMARY KEY conflict
                    # Generate new batch code with suffix
                    import time
                    new_ma_lo = f"{ma_lo}_CK{int(time.time() % 10000)}"
                    
                    # Ensure new batch code is unique
                    while LoSP.query.filter_by(MaSP=ma_sp, MaLo=new_ma_lo).first():
                        new_ma_lo = f"{ma_lo}_CK{int(time.time() % 10000)}"
                    
                    # Generate new barcode
                    new_ma_vach = generate_barcode()
                    while LoSP.query.filter_by(MaVach=new_ma_vach).first():
                        new_ma_vach = generate_barcode()
                    
                    batch_nhap = LoSP(
                        MaSP=ma_sp,
                        MaLo=new_ma_lo,  # NEW batch code
                        MaVach=new_ma_vach,  # NEW barcode
                        NSX=batch_xuat.NSX,
                        HSD=batch_xuat.HSD,
                        SLTon=so_luong,
                        MaKho=data['KhoNhap'],
                        MaPhieuNK=ma_phieu_nhap
                    )
                    db.session.add(batch_nhap)
                    
                    print(f"Created new batch {new_ma_lo} in {data['KhoNhap']} with {so_luong} units")
                
                transferred_items.append({
                    'MaSP': ma_sp,
                    'MaLo': ma_lo,
                    'new_MaLo': batch_nhap.MaLo if not LoSP.query.filter_by(MaSP=ma_sp, MaLo=ma_lo, MaKho=data['KhoNhap']).first() else ma_lo,
                    'SoLuong': so_luong,
                    'transfer_type': 'partial',
                    'remaining_in_source': batch_xuat.SLTon,
                    'from': data['KhoXuat'],
                    'to': data['KhoNhap']
                })
        
        # Record who created
        tao_ck = TaoPhieu(MaNV=ma_nv, MaPhieuTao=ma_phieu_ck)
        tao_xuat = TaoPhieu(MaNV=ma_nv, MaPhieuTao=ma_phieu_xuat)
        tao_nhap = TaoPhieu(MaNV=ma_nv, MaPhieuTao=ma_phieu_nhap)
        
        db.session.add(tao_ck)
        db.session.add(tao_xuat)
        db.session.add(tao_nhap)
        
        db.session.commit()
        
        print(f"Transfer successful: {len(transferred_items)} items transferred")
        
        return success_response({
            'phieu_chuyen_kho': phieu_ck.to_dict(),
            'phieu_xuat': phieu_xuat.to_dict(),
            'phieu_nhap': phieu_nhap.to_dict(),
            'transferred_items': transferred_items
        }, message="Transfer successful", status=201)
        
    except Exception as e:
        db.session.rollback()
        print(f"Transfer error: {str(e)}")
        import traceback
        traceback.print_exc()
        return error_response(f"Error creating transfer: {str(e)}", 500)


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


# =============================================
# UC05: CHUYỂN KHO - ENHANCED
# =============================================

@warehouse_bp.route('/transfer', methods=['GET'])
@jwt_required()
def get_transfers():
    """Get all transfer receipts with proper item details"""
    try:
        phieu_list = PhieuChuyenKho.query.order_by(PhieuChuyenKho.NgayTao.desc()).all()
        
        result = []
        for phieu in phieu_list:
            phieu_data = phieu.to_dict()
            
            # Get related export and import receipts
            phieu_xuat = PhieuXuatKho.query.filter_by(MaPhieuCK=phieu.MaPhieu).first()
            phieu_nhap = PhieuNhapKho.query.filter_by(MaPhieuCK=phieu.MaPhieu).first()
            
            phieu_data['items'] = []
            
            # Strategy 1: Get items from export receipt (partial transfers)
            if phieu_xuat:
                batches_xuat = LoSP.query.filter_by(MaPhieuXK=phieu_xuat.MaPhieu).all()
                
                for batch in batches_xuat:
                    san_pham = SanPham.query.get(batch.MaSP)
                    if san_pham:
                        # This is a partial transfer - batch still in source warehouse
                        phieu_data['items'].append({
                            'MaSP': batch.MaSP,
                            'TenSP': san_pham.TenSP,
                            'DVT': san_pham.DVT,
                            'MaLo': batch.MaLo,
                            'MaVach': batch.MaVach,
                            'NSX': batch.NSX.isoformat() if batch.NSX else None,
                            'HSD': batch.HSD.isoformat() if batch.HSD else None,
                            'SoLuong': 0,  # Will be calculated from destination
                            'transfer_type': 'partial'
                        })
            
            # Strategy 2: Get items from import receipt (for both full and partial)
            if phieu_nhap:
                batches_nhap = LoSP.query.filter_by(MaPhieuNK=phieu_nhap.MaPhieu).all()
                
                for batch in batches_nhap:
                    san_pham = SanPham.query.get(batch.MaSP)
                    if san_pham:
                        # Check if this batch already in items (from partial transfer)
                        existing_item = next(
                            (item for item in phieu_data['items'] 
                             if item['MaSP'] == batch.MaSP and item['MaLo'].startswith(batch.MaLo.split('_CK')[0])),
                            None
                        )
                        
                        if existing_item:
                            # Update quantity for partial transfer
                            existing_item['SoLuong'] = batch.SLTon
                            existing_item['destination_MaLo'] = batch.MaLo
                            existing_item['destination_MaVach'] = batch.MaVach
                        else:
                            # This is a full transfer - add new item
                            phieu_data['items'].append({
                                'MaSP': batch.MaSP,
                                'TenSP': san_pham.TenSP,
                                'DVT': san_pham.DVT,
                                'MaLo': batch.MaLo,
                                'MaVach': batch.MaVach,
                                'NSX': batch.NSX.isoformat() if batch.NSX else None,
                                'HSD': batch.HSD.isoformat() if batch.HSD else None,
                                'SoLuong': batch.SLTon,
                                'transfer_type': 'full'
                            })
            
            # If no items found from receipts, try to find moved batches
            if not phieu_data['items']:
                # Look for batches that were moved to destination warehouse
                # and have this transfer as reference
                moved_batches = LoSP.query.filter(
                    LoSP.MaKho == phieu.KhoNhap,
                    LoSP.MaPhieuNK == phieu_nhap.MaPhieu if phieu_nhap else None
                ).all()
                
                for batch in moved_batches:
                    san_pham = SanPham.query.get(batch.MaSP)
                    if san_pham:
                        phieu_data['items'].append({
                            'MaSP': batch.MaSP,
                            'TenSP': san_pham.TenSP,
                            'DVT': san_pham.DVT,
                            'MaLo': batch.MaLo,
                            'MaVach': batch.MaVach,
                            'NSX': batch.NSX.isoformat() if batch.NSX else None,
                            'HSD': batch.HSD.isoformat() if batch.HSD else None,
                            'SoLuong': batch.SLTon,
                            'transfer_type': 'full'
                        })
            
            result.append(phieu_data)
        
        return success_response({
            'transfers': result,
            'total': len(result)
        })
    except Exception as e:
        print(f"Error getting transfers: {str(e)}")
        import traceback
        traceback.print_exc()
        return error_response(f"Error getting transfers: {str(e)}", 500)


@warehouse_bp.route('/transfer/<string:ma_phieu>', methods=['GET'])
@jwt_required()
def get_transfer(ma_phieu):
    """Get specific transfer receipt details with comprehensive item information"""
    phieu = PhieuChuyenKho.query.get(ma_phieu)
    if not phieu:
        return error_response("Transfer receipt not found", 404)
    
    phieu_data = phieu.to_dict()
    
    # Get related receipts
    phieu_xuat = PhieuXuatKho.query.filter_by(MaPhieuCK=ma_phieu).first()
    phieu_nhap = PhieuNhapKho.query.filter_by(MaPhieuCK=ma_phieu).first()
    
    if phieu_xuat:
        phieu_data['phieu_xuat'] = phieu_xuat.to_dict()
    
    if phieu_nhap:
        phieu_data['phieu_nhap'] = phieu_nhap.to_dict()
    
    # Build comprehensive items list
    phieu_data['items'] = []
    items_map = {}  # Use dict to avoid duplicates
    
    # Get items from destination warehouse (most reliable)
    if phieu_nhap:
        batches_nhap = LoSP.query.filter_by(MaPhieuNK=phieu_nhap.MaPhieu).all()
        
        for batch in batches_nhap:
            san_pham = SanPham.query.get(batch.MaSP)
            if san_pham:
                key = f"{batch.MaSP}_{batch.MaLo.split('_CK')[0]}"  # Remove _CK suffix for grouping
                
                items_map[key] = {
                    'MaSP': batch.MaSP,
                    'TenSP': san_pham.TenSP,
                    'DVT': san_pham.DVT,
                    'MaLo': batch.MaLo.split('_CK')[0],  # Original batch code
                    'MaVach': batch.MaVach,
                    'NSX': batch.NSX.isoformat() if batch.NSX else None,
                    'HSD': batch.HSD.isoformat() if batch.HSD else None,
                    'SoLuong': batch.SLTon,
                    'CurrentWarehouse': phieu.KhoNhap,
                    'DestinationMaLo': batch.MaLo,  # May have _CK suffix
                    'DestinationMaVach': batch.MaVach,
                    'transfer_type': 'full' if '_CK' not in batch.MaLo else 'partial'
                }
    
    # Also check source warehouse for partial transfers
    if phieu_xuat:
        batches_xuat = LoSP.query.filter_by(MaPhieuXK=phieu_xuat.MaPhieu).all()
        
        for batch in batches_xuat:
            san_pham = SanPham.query.get(batch.MaSP)
            if san_pham:
                key = f"{batch.MaSP}_{batch.MaLo}"
                
                if key not in items_map:
                    # Batch not found in destination, check if it was fully transferred
                    moved_batch = LoSP.query.filter_by(
                        MaSP=batch.MaSP,
                        MaLo=batch.MaLo,
                        MaKho=phieu.KhoNhap
                    ).first()
                    
                    if moved_batch:
                        items_map[key] = {
                            'MaSP': batch.MaSP,
                            'TenSP': san_pham.TenSP,
                            'DVT': san_pham.DVT,
                            'MaLo': batch.MaLo,
                            'MaVach': batch.MaVach,
                            'NSX': batch.NSX.isoformat() if batch.NSX else None,
                            'HSD': batch.HSD.isoformat() if batch.HSD else None,
                            'SoLuong': moved_batch.SLTon,
                            'CurrentWarehouse': phieu.KhoNhap,
                            'transfer_type': 'full'
                        }
                else:
                    # Update with source warehouse info for partial transfers
                    items_map[key]['SourceMaLo'] = batch.MaLo
                    items_map[key]['RemainingInSource'] = batch.SLTon
    
    phieu_data['items'] = list(items_map.values())
    
    # Add summary statistics
    phieu_data['summary'] = {
        'total_items': len(phieu_data['items']),
        'total_quantity': sum(item['SoLuong'] for item in phieu_data['items']),
        'full_transfers': len([i for i in phieu_data['items'] if i['transfer_type'] == 'full']),
        'partial_transfers': len([i for i in phieu_data['items'] if i['transfer_type'] == 'partial'])
    }
    
    return success_response(phieu_data)



@warehouse_bp.route('/transfer/<string:ma_phieu>', methods=['DELETE'])
@jwt_required()
@role_required('Quản lý')
def delete_transfer(ma_phieu):
    """Delete transfer receipt (Manager only) - Rollback both warehouses"""
    phieu = PhieuChuyenKho.query.get(ma_phieu)
    if not phieu:
        return error_response("Transfer receipt not found", 404)
    
    try:
        # Get related receipts
        phieu_xuat = PhieuXuatKho.query.filter_by(MaPhieuCK=ma_phieu).first()
        phieu_nhap = PhieuNhapKho.query.filter_by(MaPhieuCK=ma_phieu).first()
        
        # Rollback stock changes
        if phieu_xuat:
            LoSP.query.filter_by(MaPhieuXK=phieu_xuat.MaPhieu).update({'MaPhieuXK': None})
            TaoPhieu.query.filter_by(MaPhieuTao=phieu_xuat.MaPhieu).delete()
            db.session.delete(phieu_xuat)
        
        if phieu_nhap:
            LoSP.query.filter_by(MaPhieuNK=phieu_nhap.MaPhieu).delete()
            TaoPhieu.query.filter_by(MaPhieuTao=phieu_nhap.MaPhieu).delete()
            db.session.delete(phieu_nhap)
        
        # Delete tao phieu records
        TaoPhieu.query.filter_by(MaPhieuTao=ma_phieu).delete()
        
        # Delete the transfer receipt
        db.session.delete(phieu)
        db.session.commit()
        
        return success_response(None, message="Transfer receipt deleted successfully")
    except Exception as e:
        db.session.rollback()
        return error_response(f"Error deleting transfer receipt: {str(e)}", 500)


@warehouse_bp.route('/transfer/validate', methods=['POST'])
@jwt_required()
def validate_transfer():
    """
    Validate transfer before submission
    
    Request body:
        {
            "KhoXuat": "string",
            "KhoNhap": "string",
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
    
    kho_xuat = data.get('KhoXuat')
    kho_nhap = data.get('KhoNhap')
    items = data.get('items', [])
    
    if not kho_xuat or not kho_nhap:
        return error_response("KhoXuat and KhoNhap are required", 400)
    
    if kho_xuat == kho_nhap:
        return error_response("Source and destination warehouses must be different", 400)
    
    warnings = []
    errors = []
    validated_items = []
    
    for idx, item in enumerate(items):
        ma_sp = item.get('MaSP')
        ma_lo = item.get('MaLo')
        so_luong = item.get('SoLuong', 0)
        
        # Validate batch in source warehouse
        batch = LoSP.query.filter_by(
            MaSP=ma_sp,
            MaLo=ma_lo,
            MaKho=kho_xuat
        ).first()
        
        if not batch:
            errors.append(f"Dòng {idx + 1}: Lô {ma_lo} không tồn tại trong kho {kho_xuat}")
            continue
        
        if batch.SLTon < so_luong:
            errors.append(f"Dòng {idx + 1}: Không đủ tồn kho. Có: {batch.SLTon}, Yêu cầu: {so_luong}")
            continue
        
        # Check expiry
        if batch.HSD:
            days_to_expiry = (batch.HSD - datetime.utcnow().date()).days
            if days_to_expiry < 0:
                warnings.append(f"Dòng {idx + 1}: Lô đã hết hạn ({batch.HSD})")
            elif days_to_expiry <= 7:
                warnings.append(f"Dòng {idx + 1}: Lô sắp hết hạn trong {days_to_expiry} ngày")
        
        san_pham = SanPham.query.get(ma_sp)
        validated_items.append({
            'MaSP': ma_sp,
            'TenSP': san_pham.TenSP if san_pham else ma_sp,
            'MaLo': ma_lo,
            'SoLuong': so_luong,
            'SLTon': batch.SLTon,
            'NSX': batch.NSX.isoformat() if batch.NSX else None,
            'HSD': batch.HSD.isoformat() if batch.HSD else None,
            'status': 'ok'
        })
    
    return success_response({
        'valid': len(errors) == 0,
        'warnings': warnings,
        'errors': errors,
        'items': validated_items,
        'summary': {
            'total_items': len(items),
            'total_quantity': sum(item.get('SoLuong', 0) for item in items),
            'source_warehouse': kho_xuat,
            'destination_warehouse': kho_nhap
        }
    })


@warehouse_bp.route('/transfer/scan-barcode', methods=['POST'])
@jwt_required()
def scan_barcode_for_transfer():
    """
    Scan barcode for warehouse transfer (UC05)
    
    Khác với export: cho phép quét hàng hết hạn, hàng lỗi
    
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
    ma_sp = data.get('MaSP')
    
    if not ma_vach or not ma_kho:
        return error_response("MaVach and MaKho are required", 400)
    
    # Find batch by barcode
    query = LoSP.query.filter_by(MaVach=ma_vach, MaKho=ma_kho)
    
    # Add product filter if provided
    if ma_sp:
        query = query.filter_by(MaSP=ma_sp)
    
    batch = query.first()
    
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
    
    # Check expiry status (but don't block)
    is_expired = False
    days_to_expiry = None
    warnings = []
    
    if batch.HSD:
        days_to_expiry = (batch.HSD - datetime.utcnow().date()).days
        is_expired = days_to_expiry < 0
        
        if is_expired:
            warnings.append(f"Lô hàng đã hết hạn từ ngày {batch.HSD}")
        elif days_to_expiry <= 7:
            warnings.append(f"Lô hàng sắp hết hạn trong {days_to_expiry} ngày")
    
    # Get product info
    san_pham = SanPham.query.get(batch.MaSP)
    
    # Calculate status
    status = 'normal'
    if days_to_expiry is not None:
        if is_expired:
            status = 'expired'
        elif days_to_expiry <= 7:
            status = 'critical'
        elif days_to_expiry <= 30:
            status = 'warning'
    
    return success_response({
        'batch_info': {
            **batch.to_dict(),
            'days_to_expiry': days_to_expiry,
            'status': status,
            'is_expired': is_expired,
            'is_transferable': batch.SLTon > 0  # Có thể chuyển nếu còn tồn kho
        },
        'product_info': san_pham.to_dict() if san_pham else None,
        'scan_timestamp': datetime.utcnow().isoformat(),
        'warnings': warnings
    })
