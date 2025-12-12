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
from sqlalchemy import and_

warehouse_bp = Blueprint('warehouse', __name__)


# =============================================
# COMMON ENDPOINTS - WAREHOUSE DATA
# =============================================

@warehouse_bp.route('/warehouses', methods=['GET'])
@jwt_required()
def get_warehouses():
    """Get all warehouses"""
    warehouses = KhoHang.query.all()
    return success_response({
        'warehouses': [w.to_dict() for w in warehouses]
    })


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
    claims = get_jwt_identity()
    
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
    from app.models import TaoPhieu
    tao_phieu = TaoPhieu(
        MaNV=claims['id'],
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

@warehouse_bp.route('/export', methods=['GET'])
@jwt_required()
def get_exports():
    """Get all export receipts"""
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
                batch_data['product'] = san_pham.to_dict()
            phieu_data['items'].append(batch_data)
        result.append(phieu_data)
    
    return success_response({
        'exports': result,
        'total': len(result)
    })


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
            batch_data['product'] = san_pham.to_dict()
        phieu_data['items'].append(batch_data)
    
    return success_response(phieu_data)


@warehouse_bp.route('/export/<string:ma_phieu>', methods=['DELETE'])
@jwt_required()
@role_required('Quản lý')
def delete_export(ma_phieu):
    """Delete export receipt (Manager only)"""
    phieu = PhieuXuatKho.query.get(ma_phieu)
    if not phieu:
        return error_response("Export receipt not found", 404)
    
    try:
        # Cannot delete if it affects inventory - need to reverse
        return error_response("Export receipts cannot be deleted. Use inventory adjustment instead.", 400)
    except Exception as e:
        db.session.rollback()
        return error_response(f"Error deleting export receipt: {str(e)}", 500)

@warehouse_bp.route('/export', methods=['POST'])
@jwt_required()
@role_required('Quản lý', 'Nhân viên')
def export_warehouse():
    """
    Xuất kho với FEFO (UC04) - Theo đúng logic nghiệp vụ
    
    Request body:
        {
            "MaKho": "string",
            "MucDich": "string", 
            "MaThamChieu": "string",
            "items": [
                {
                    "MaSP": "string",
                    "MaLo": "string",
                    "MaVach": "string",
                    "SoLuong": int
                }
            ]
        }
    """
    data = request.get_json()
    claims = get_jwt_identity()
    
    # Validate required fields
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
        MucDich=data.get('MucDich', 'Xuất bán hàng'),
        MaThamChieu=data.get('MaThamChieu')
    )
    
    db.session.add(phieu)
    
    # Process items với validation nghiêm ngặt theo UC04
    exported_batches = []
    for item in data['items']:
        ma_sp = item.get('MaSP')
        ma_lo = item.get('MaLo') 
        ma_vach = item.get('MaVach')
        so_luong_xuat = item.get('SoLuong', 0)
        
        # Validate required fields cho từng item
        if not all([ma_sp, ma_lo, ma_vach, so_luong_xuat > 0]):
            db.session.rollback()
            return error_response("MaSP, MaLo, MaVach and SoLuong are required for each item", 400)
        
        # Validate product exists
        san_pham = SanPham.query.get(ma_sp)
        if not san_pham:
            db.session.rollback()
            return error_response(f"Product {ma_sp} not found", 404)
        
        # Find batch với barcode validation (UC04: Quét barcode)
        batch = LoSP.query.filter_by(
            MaSP=ma_sp,
            MaLo=ma_lo,
            MaVach=ma_vach,
            MaKho=data['MaKho']
        ).first()
        
        if not batch:
            db.session.rollback()
            return error_response(
                f"Batch {ma_lo} with barcode {ma_vach} not found in warehouse {data['MaKho']}", 
                404
            )
        
        # Check stock availability
        if batch.SLTon < so_luong_xuat:
            db.session.rollback()
            return error_response(
                f"Insufficient stock for batch {ma_lo}. Available: {batch.SLTon}, Requested: {so_luong_xuat}",
                400
            )
        
        # Business rule: Không được xuất hàng hết hạn
        if batch.HSD and batch.HSD < datetime.utcnow().date():
            db.session.rollback()
            return error_response(
                f"Cannot export expired batch {ma_lo}. Expiry date: {batch.HSD}",
                400
            )
        
        # Update stock
        batch.SLTon -= so_luong_xuat
        batch.MaPhieuXK = ma_phieu
        
        exported_batches.append({
            **batch.to_dict(),
            'exported_quantity': so_luong_xuat,
            'product': san_pham.to_dict()
        })
    
    # Record who created this phiếu
    tao_phieu = TaoPhieu(
        MaNV=claims['id'],
        MaPhieuTao=ma_phieu
    )
    db.session.add(tao_phieu)
    
    try:
        db.session.commit()
        
        return success_response({
            'phieu': phieu.to_dict(),
            'exported_items': exported_batches,
            'total_items': len(exported_batches)
        }, message="Export successful", status=201)
        
    except Exception as e:
        db.session.rollback()
        return error_response(f"Error processing export: {str(e)}", 500)


@warehouse_bp.route('/export/suggest-fefo', methods=['POST'])
@jwt_required()
def suggest_fefo():
    """
    Suggest FEFO batches for export
    
    Request body:
        {
            "MaSP": "string",
            "MaKho": "string",
            "SoLuong": int
        }
    """
    data = request.get_json()
    
    ma_sp = data.get('MaSP')
    ma_kho = data.get('MaKho')
    so_luong = data.get('SoLuong', 0)
    
    # Get batches sorted by HSD
    batches = LoSP.query.filter(
        and_(
            LoSP.MaSP == ma_sp,
            LoSP.MaKho == ma_kho,
            LoSP.SLTon > 0
        )
    ).order_by(LoSP.HSD.asc()).all()
    
    suggested = []
    remaining = so_luong
    
    for batch in batches:
        if remaining <= 0:
            break
        
        if batch.SLTon >= remaining:
            suggested.append({
                **batch.to_dict(),
                'suggested_quantity': remaining
            })
            remaining = 0
        else:
            suggested.append({
                **batch.to_dict(),
                'suggested_quantity': batch.SLTon
            })
            remaining -= batch.SLTon
    
    return success_response({
        'suggested_batches': suggested,
        'can_fulfill': remaining == 0,
        'shortage': remaining if remaining > 0 else 0
    })


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
    claims = get_jwt_identity()
    
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
    tao_ck = TaoPhieu(MaNV=claims['id'], MaPhieuTao=ma_phieu_ck)
    tao_xuat = TaoPhieu(MaNV=claims['id'], MaPhieuTao=ma_phieu_xuat)
    tao_nhap = TaoPhieu(MaNV=claims['id'], MaPhieuTao=ma_phieu_nhap)
    
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


# Continue in next part...
