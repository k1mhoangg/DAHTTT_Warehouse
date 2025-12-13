"""
Warehouse operations routes - Part 2
UC06: Kiểm kho
UC07: Điều chỉnh kho
UC09: Hủy hàng
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import PhieuKiemKho, BaoCao, LoSP, PhieuNhapKho, PhieuXuatKho, TaoPhieu, DuyetPhieu
from app import db
from app.utils.auth import role_required
from app.utils.helpers import success_response, error_response, generate_id
from datetime import datetime

warehouse_inventory_bp = Blueprint('warehouse_inventory', __name__)


# =============================================
# UC06: KIỂM KHO - ENHANCED
# =============================================

@warehouse_inventory_bp.route('/inventory/start', methods=['POST'])
@jwt_required()
@role_required('Quản lý', 'Nhân viên')
def start_inventory():
    """
    Bắt đầu kiểm kho (UC06)
    
    Request body:
        {
            "MaKho": "string",
            "MucDich": "string"
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
    
    if not data.get('MaKho'):
        return error_response("MaKho is required", 400)
    
    # Check warehouse exists
    from app.models import KhoHang
    kho = KhoHang.query.get(data['MaKho'])
    if not kho:
        return error_response("Warehouse not found", 404)
    
    # Generate phiếu kiểm kho
    ma_phieu = generate_id('PKK', 6)
    while PhieuKiemKho.query.get(ma_phieu):
        ma_phieu = generate_id('PKK', 6)
    
    phieu = PhieuKiemKho(
        MaPhieu=ma_phieu,
        NgayTao=datetime.utcnow(),
        MucDich=data.get('MucDich', 'Kiểm kê định kỳ'),
        MaKho=data['MaKho']
    )
    
    db.session.add(phieu)
    
    # Get all batches in this warehouse (snapshot at start time)
    batches = LoSP.query.filter_by(MaKho=data['MaKho']).all()
    
    batch_list = []
    for batch in batches:
        from app.models import SanPham
        san_pham = SanPham.query.get(batch.MaSP)
        
        batch_data = {
            'MaSP': batch.MaSP,
            'TenSP': san_pham.TenSP if san_pham else batch.MaSP,
            'DVT': san_pham.DVT if san_pham else '',
            'MaLo': batch.MaLo,
            'MaVach': batch.MaVach,
            'NSX': batch.NSX.isoformat() if batch.NSX else None,
            'HSD': batch.HSD.isoformat() if batch.HSD else None,
            'SLHeThong': batch.SLTon,  # Current system quantity at start time
            'SLThucTe': None,  # To be filled during counting
            'ChenhLech': None,
        }
        batch_list.append(batch_data)
    
    # Record who created
    tao_phieu = TaoPhieu(MaNV=ma_nv, MaPhieuTao=ma_phieu)
    db.session.add(tao_phieu)
    
    db.session.commit()
    
    return success_response({
        'phieu': phieu.to_dict(),
        'batches': batch_list,
        'total_batches': len(batch_list),
        'warehouse': kho.to_dict()
    }, message="Inventory check started", status=201)


@warehouse_inventory_bp.route('/inventory/scan-batch', methods=['POST'])
@jwt_required()
def scan_batch_for_inventory():
    """
    Scan barcode for inventory check (UC06 Step 3)
    
    Request body:
        {
            "MaVach": "string",
            "MaKho": "string"
        }
    
    Response: Batch information for inventory counting
    """
    data = request.get_json()
    
    ma_vach = data.get('MaVach')
    ma_kho = data.get('MaKho')
    
    if not ma_vach or not ma_kho:
        return error_response("MaVach and MaKho are required", 400)
    
    # Find batch by barcode
    batch = LoSP.query.filter_by(MaVach=ma_vach, MaKho=ma_kho).first()
    
    if not batch:
        return error_response(
            f"Barcode {ma_vach} not found in warehouse {ma_kho}", 
            404
        )
    
    # Get product info
    from app.models import SanPham
    san_pham = SanPham.query.get(batch.MaSP)
    
    # Check expiry status
    is_expired = False
    days_to_expiry = None
    if batch.HSD:
        days_to_expiry = (batch.HSD - datetime.utcnow().date()).days
        is_expired = days_to_expiry < 0
    
    return success_response({
        'batch_info': {
            **batch.to_dict(),
            'days_to_expiry': days_to_expiry,
            'is_expired': is_expired
        },
        'product_info': san_pham.to_dict() if san_pham else None,
        'scan_timestamp': datetime.utcnow().isoformat()
    })


@warehouse_inventory_bp.route('/inventory/record', methods=['POST'])
@jwt_required()
@role_required('Quản lý', 'Nhân viên')
def record_inventory():
    """
    Ghi nhận kết quả kiểm kê (UC06 Step 4)
    
    Request body:
        {
            "MaPhieu": "string",
            "items": [
                {
                    "MaSP": "string",
                    "MaLo": "string",
                    "MaVach": "string" (for barcode scanning),
                    "SLThucTe": int
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
    
    ma_phieu = data.get('MaPhieu')
    if not ma_phieu:
        return error_response("MaPhieu is required", 400)
    
    phieu = PhieuKiemKho.query.get(ma_phieu)
    if not phieu:
        return error_response("Phiếu kiểm kho not found", 404)
    
    # Process inventory items
    discrepancies = []
    total_items = 0
    
    for item in data.get('items', []):
        ma_sp = item.get('MaSP')
        ma_lo = item.get('MaLo')
        ma_vach = item.get('MaVach')
        sl_thuc_te = item.get('SLThucTe')
        
        if sl_thuc_te is None:
            continue
        
        sl_thuc_te = int(sl_thuc_te)
        
        # Find batch by barcode or product/batch code
        if ma_vach:
            batch = LoSP.query.filter_by(MaVach=ma_vach, MaKho=phieu.MaKho).first()
        else:
            batch = LoSP.query.filter_by(MaSP=ma_sp, MaLo=ma_lo, MaKho=phieu.MaKho).first()
        
        if not batch:
            continue
        
        # Calculate discrepancy
        sl_he_thong = batch.SLTon
        chenh_lech = sl_thuc_te - sl_he_thong
        
        # Generate report ID
        ma_bao_cao = generate_id('BC', 6)
        while BaoCao.query.filter_by(MaPhieu=ma_phieu, MaBaoCao=ma_bao_cao).first():
            ma_bao_cao = generate_id('BC', 6)
        
        # Create report entry
        bao_cao = BaoCao(
            MaPhieu=ma_phieu,
            MaBaoCao=ma_bao_cao,
            SLThucTe=sl_thuc_te,
            NgayTao=datetime.utcnow(),
            MaNV=ma_nv
        )
        
        db.session.add(bao_cao)
        
        # Update batch reference to report
        batch.MaPhieuKiem = ma_phieu
        batch.MaBaoCao = ma_bao_cao
        
        total_items += 1
        
        # Get product info
        from app.models import SanPham
        san_pham = SanPham.query.get(batch.MaSP)
        
        item_result = {
            'MaSP': batch.MaSP,
            'TenSP': san_pham.TenSP if san_pham else batch.MaSP,
            'MaLo': batch.MaLo,
            'MaVach': batch.MaVach,
            'SLHeThong': sl_he_thong,
            'SLThucTe': sl_thuc_te,
            'ChenhLech': chenh_lech,
            'MaBaoCao': ma_bao_cao
        }
        
        if chenh_lech != 0:
            discrepancies.append(item_result)
    
    db.session.commit()
    
    return success_response({
        'phieu': phieu.to_dict(),
        'total_items': total_items,
        'discrepancies': discrepancies,
        'total_discrepancies': len(discrepancies),
        'has_discrepancies': len(discrepancies) > 0,
        'summary': {
            'items_checked': total_items,
            'items_with_discrepancy': len(discrepancies),
            'total_surplus': sum(d['ChenhLech'] for d in discrepancies if d['ChenhLech'] > 0),
            'total_shortage': abs(sum(d['ChenhLech'] for d in discrepancies if d['ChenhLech'] < 0))
        }
    }, message="Inventory recorded successfully")


@warehouse_inventory_bp.route('/inventory', methods=['GET'])
@jwt_required()
def get_inventories():
    """Get all inventory checks"""
    try:
        phieu_list = PhieuKiemKho.query.order_by(PhieuKiemKho.NgayTao.desc()).all()
        
        result = []
        for phieu in phieu_list:
            phieu_data = phieu.to_dict()
            
            # Get warehouse info
            from app.models import KhoHang
            kho = KhoHang.query.get(phieu.MaKho)
            if kho:
                phieu_data['warehouse'] = kho.to_dict()
            
            # Count items and discrepancies
            bao_caos = BaoCao.query.filter_by(MaPhieu=phieu.MaPhieu).all()
            phieu_data['total_items'] = len(bao_caos)
            
            discrepancies = 0
            for bc in bao_caos:
                batch = LoSP.query.filter_by(MaPhieuKiem=phieu.MaPhieu, MaBaoCao=bc.MaBaoCao).first()
                if batch and bc.SLThucTe != batch.SLTon:
                    discrepancies += 1
            
            phieu_data['total_discrepancies'] = discrepancies
            
            result.append(phieu_data)
        
        return success_response({
            'inventories': result,
            'total': len(result)
        })
    except Exception as e:
        return error_response(f"Error getting inventories: {str(e)}", 500)


@warehouse_inventory_bp.route('/inventory/<string:ma_phieu>', methods=['GET'])
@jwt_required()
def get_inventory_report(ma_phieu):
    """Get detailed inventory report"""
    
    phieu = PhieuKiemKho.query.get(ma_phieu)
    if not phieu:
        return error_response("Phiếu kiểm kho not found", 404)
    
    # Get warehouse info
    from app.models import KhoHang, SanPham
    kho = KhoHang.query.get(phieu.MaKho)
    
    # Get all reports for this inventory
    bao_caos = BaoCao.query.filter_by(MaPhieu=ma_phieu).all()
    
    items = []
    total_discrepancy = 0
    total_surplus = 0
    total_shortage = 0
    
    for bao_cao in bao_caos:
        # Get batch info
        batch = LoSP.query.filter_by(
            MaPhieuKiem=ma_phieu,
            MaBaoCao=bao_cao.MaBaoCao
        ).first()
        
        if batch:
            san_pham = SanPham.query.get(batch.MaSP)
            
            sl_he_thong = batch.SLTon
            sl_thuc_te = bao_cao.SLThucTe
            chenh_lech = sl_thuc_te - sl_he_thong
            
            items.append({
                'MaSP': batch.MaSP,
                'TenSP': san_pham.TenSP if san_pham else batch.MaSP,
                'DVT': san_pham.DVT if san_pham else '',
                'MaLo': batch.MaLo,
                'MaVach': batch.MaVach,
                'NSX': batch.NSX.isoformat() if batch.NSX else None,
                'HSD': batch.HSD.isoformat() if batch.HSD else None,
                'SLHeThong': sl_he_thong,
                'SLThucTe': sl_thuc_te,
                'ChenhLech': chenh_lech,
                'MaBaoCao': bao_cao.MaBaoCao
            })
            
            total_discrepancy += abs(chenh_lech)
            if chenh_lech > 0:
                total_surplus += chenh_lech
            elif chenh_lech < 0:
                total_shortage += abs(chenh_lech)
    
    return success_response({
        'phieu': phieu.to_dict(),
        'warehouse': kho.to_dict() if kho else None,
        'items': items,
        'summary': {
            'total_items': len(items),
            'items_with_discrepancy': len([i for i in items if i['ChenhLech'] != 0]),
            'total_discrepancy': total_discrepancy,
            'total_surplus': total_surplus,
            'total_shortage': total_shortage
        }
    })


@warehouse_inventory_bp.route('/inventory/<string:ma_phieu>', methods=['DELETE'])
@jwt_required()
@role_required('Quản lý')
def delete_inventory(ma_phieu):
    """Delete inventory check (Manager only)"""
    phieu = PhieuKiemKho.query.get(ma_phieu)
    if not phieu:
        return error_response("Phiếu kiểm kho not found", 404)
    
    try:
        # Remove batch references
        LoSP.query.filter_by(MaPhieuKiem=ma_phieu).update({
            'MaPhieuKiem': None,
            'MaBaoCao': None
        })
        
        # Delete reports
        BaoCao.query.filter_by(MaPhieu=ma_phieu).delete()
        
        # Delete tao phieu record
        TaoPhieu.query.filter_by(MaPhieuTao=ma_phieu).delete()
        
        # Delete the phieu
        db.session.delete(phieu)
        db.session.commit()
        
        return success_response(None, message="Inventory check deleted successfully")
    except Exception as e:
        db.session.rollback()
        return error_response(f"Error deleting inventory: {str(e)}", 500)


# =============================================
# UC07: ĐIỀU CHỈNH KHO
# =============================================

@warehouse_inventory_bp.route('/adjustment', methods=['POST'])
@jwt_required()
@role_required('Quản lý', 'Nhân viên')
def adjust_inventory():
    """
    Điều chỉnh kho dựa trên kết quả kiểm kê (UC07)
    
    Request body:
        {
            "MaPhieuKiem": "string"
        }
    """
    data = request.get_json()
    claims = get_jwt_identity()
    
    ma_phieu_kiem = data.get('MaPhieuKiem')
    if not ma_phieu_kiem:
        return error_response("MaPhieuKiem is required", 400)
    
    phieu_kiem = PhieuKiemKho.query.get(ma_phieu_kiem)
    if not phieu_kiem:
        return error_response("Phiếu kiểm kho not found", 404)
    
    # Get all reports
    bao_caos = BaoCao.query.filter_by(MaPhieu=ma_phieu_kiem).all()
    
    phieu_nhap_list = []
    phieu_xuat_list = []
    
    for bao_cao in bao_caos:
        # Get batch
        batch = LoSP.query.filter_by(
            MaPhieuKiem=ma_phieu_kiem,
            MaBaoCao=bao_cao.MaBaoCao
        ).first()
        
        if not batch:
            continue
        
        sl_he_thong = batch.SLTon
        sl_thuc_te = bao_cao.SLThucTe
        chenh_lech = sl_thuc_te - sl_he_thong
        
        if chenh_lech == 0:
            continue  # No adjustment needed
        
        if chenh_lech > 0:
            # Thừa -> Tạo phiếu nhập
            ma_phieu_nhap = generate_id('PNK', 6)
            
            phieu_nhap = PhieuNhapKho(
                MaPhieu=ma_phieu_nhap,
                NgayTao=datetime.utcnow(),
                MucDich='Điều chỉnh tăng tồn kho',
                MaThamChieu=ma_phieu_kiem
            )
            
            db.session.add(phieu_nhap)
            
            # Update batch
            batch.SLTon = sl_thuc_te
            batch.MaPhieuNK = ma_phieu_nhap
            
            tao_phieu = TaoPhieu(MaNV=claims['id'], MaPhieuTao=ma_phieu_nhap)
            db.session.add(tao_phieu)
            
            phieu_nhap_list.append({
                'MaPhieu': ma_phieu_nhap,
                'MaSP': batch.MaSP,
                'MaLo': batch.MaLo,
                'SoLuong': chenh_lech
            })
            
        else:  # chenh_lech < 0
            # Thiếu -> Tạo phiếu xuất
            ma_phieu_xuat = generate_id('PXK', 6)
            
            phieu_xuat = PhieuXuatKho(
                MaPhieu=ma_phieu_xuat,
                NgayTao=datetime.utcnow(),
                MucDich='Điều chỉnh giảm tồn kho',
                MaThamChieu=ma_phieu_kiem
            )
            
            db.session.add(phieu_xuat)
            
            # Update batch
            batch.SLTon = sl_thuc_te
            batch.MaPhieuXK = ma_phieu_xuat
            
            tao_phieu = TaoPhieu(MaNV=claims['id'], MaPhieuTao=ma_phieu_xuat)
            db.session.add(tao_phieu)
            
            phieu_xuat_list.append({
                'MaPhieu': ma_phieu_xuat,
                'MaSP': batch.MaSP,
                'MaLo': batch.MaLo,
                'SoLuong': abs(chenh_lech)
            })
    
    db.session.commit()
    
    return success_response({
        'phieu_nhap': phieu_nhap_list,
        'phieu_xuat': phieu_xuat_list,
        'total_adjustments': len(phieu_nhap_list) + len(phieu_xuat_list)
    }, message="Adjustment completed")


# =============================================
# UC09: HỦY HÀNG
# =============================================

@warehouse_inventory_bp.route('/discard', methods=['POST'])
@jwt_required()
@role_required('Quản lý', 'Nhân viên')
def discard_goods():
    """
    Hủy hàng từ kho lỗi (UC09)
    
    Request body:
        {
            "LyDo": "string",
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
    
    if not data.get('items') or not data.get('LyDo'):
        return error_response("items and LyDo are required", 400)
    
    # Generate phiếu xuất kho for discarding
    ma_phieu = generate_id('PXK', 6)
    
    phieu = PhieuXuatKho(
        MaPhieu=ma_phieu,
        NgayTao=datetime.utcnow(),
        MucDich='Xuất hủy hàng',
        MaThamChieu=f"Lý do: {data['LyDo']}"
    )
    
    db.session.add(phieu)
    
    discarded_items = []
    
    for item in data['items']:
        ma_sp = item.get('MaSP')
        ma_lo = item.get('MaLo')
        so_luong = item.get('SoLuong', 0)
        
        # Find batch in error warehouse (KHO002 or any "Kho lỗi")
        from app.models import KhoHang, LoaiKho
        
        batch = db.session.query(LoSP).join(KhoHang).filter(
            LoSP.MaSP == ma_sp,
            LoSP.MaLo == ma_lo,
            KhoHang.Loai == LoaiKho.KHO_LOI
        ).first()
        
        if not batch:
            db.session.rollback()
            return error_response(
                f"Batch {ma_sp}/{ma_lo} not found in error warehouse",
                404
            )
        
        if batch.SLTon < so_luong:
            db.session.rollback()
            return error_response(
                f"Insufficient stock for {ma_sp}/{ma_lo}",
                400
            )
        
        # Deduct stock
        batch.SLTon -= so_luong
        batch.MaPhieuXK = ma_phieu
        
        discarded_items.append({
            'MaSP': ma_sp,
            'MaLo': ma_lo,
            'SoLuong': so_luong,
            'MaKho': batch.MaKho
        })
    
    # Record who created
    tao_phieu = TaoPhieu(MaNV=claims['id'], MaPhieuTao=ma_phieu)
    db.session.add(tao_phieu)
    
    db.session.commit()
    
    return success_response({
        'phieu': phieu.to_dict(),
        'discarded_items': discarded_items
    }, message="Goods discarded successfully", status=201)
