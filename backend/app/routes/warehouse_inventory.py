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
# UC07: ĐIỀU CHỈNH KHO - ENHANCED
# =============================================

@warehouse_inventory_bp.route('/adjustment', methods=['GET'])
@jwt_required()
def get_adjustable_inventories():
    """
    Get list of inventories that have discrepancies and can be adjusted
    
    Response: List of PhieuKiemKho with discrepancy information
    """
    try:
        # Get all completed inventory checks
        phieu_list = PhieuKiemKho.query.order_by(PhieuKiemKho.NgayTao.desc()).all()
        
        result = []
        for phieu in phieu_list:
            # Get all reports for this inventory
            bao_caos = BaoCao.query.filter_by(MaPhieu=phieu.MaPhieu).all()
            
            if not bao_caos:
                continue
            
            # Count discrepancies
            total_discrepancies = 0
            items_with_discrepancy = []
            
            for bao_cao in bao_caos:
                batch = LoSP.query.filter_by(
                    MaPhieuKiem=phieu.MaPhieu,
                    MaBaoCao=bao_cao.MaBaoCao
                ).first()
                
                if batch:
                    chenh_lech = bao_cao.SLThucTe - batch.SLTon
                    if chenh_lech != 0:
                        total_discrepancies += 1
                        from app.models import SanPham
                        san_pham = SanPham.query.get(batch.MaSP)
                        
                        items_with_discrepancy.append({
                            'MaSP': batch.MaSP,
                            'TenSP': san_pham.TenSP if san_pham else batch.MaSP,
                            'MaLo': batch.MaLo,
                            'SLHeThong': batch.SLTon,
                            'SLThucTe': bao_cao.SLThucTe,
                            'ChenhLech': chenh_lech
                        })
            
            if total_discrepancies > 0:
                from app.models import KhoHang
                kho = KhoHang.query.get(phieu.MaKho)
                
                result.append({
                    **phieu.to_dict(),
                    'warehouse': kho.to_dict() if kho else None,
                    'total_discrepancies': total_discrepancies,
                    'items_with_discrepancy': items_with_discrepancy,
                    'can_adjust': True
                })
        
        return success_response({
            'inventories': result,
            'total': len(result)
        })
    except Exception as e:
        return error_response(f"Error getting adjustable inventories: {str(e)}", 500)


@warehouse_inventory_bp.route('/adjustment/preview', methods=['POST'])
@jwt_required()
def preview_adjustment():
    """
    Preview adjustment before creating receipts
    
    Request body:
        {
            "MaPhieuKiem": "string"
        }
    
    Response: Preview of receipts to be created
    """
    data = request.get_json()
    
    ma_phieu_kiem = data.get('MaPhieuKiem')
    if not ma_phieu_kiem:
        return error_response("MaPhieuKiem is required", 400)
    
    phieu_kiem = PhieuKiemKho.query.get(ma_phieu_kiem)
    if not phieu_kiem:
        return error_response("Phiếu kiểm kho not found", 404)
    
    # Get all reports
    bao_caos = BaoCao.query.filter_by(MaPhieu=ma_phieu_kiem).all()
    
    phieu_nhap_preview = []
    phieu_xuat_preview = []
    
    for bao_cao in bao_caos:
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
            continue
        
        from app.models import SanPham
        san_pham = SanPham.query.get(batch.MaSP)
        
        if chenh_lech > 0:
            # Surplus - will create import receipt
            phieu_nhap_preview.append({
                'MaSP': batch.MaSP,
                'TenSP': san_pham.TenSP if san_pham else batch.MaSP,
                'MaLo': batch.MaLo,
                'SoLuong': chenh_lech,
                'SLHeThong': sl_he_thong,
                'SLThucTe': sl_thuc_te,
                'Type': 'increase'
            })
        else:
            # Shortage - will create export receipt
            phieu_xuat_preview.append({
                'MaSP': batch.MaSP,
                'TenSP': san_pham.TenSP if san_pham else batch.MaSP,
                'MaLo': batch.MaLo,
                'SoLuong': abs(chenh_lech),
                'SLHeThong': sl_he_thong,
                'SLThucTe': sl_thuc_te,
                'Type': 'decrease'
            })
    
    return success_response({
        'phieu_kiem': phieu_kiem.to_dict(),
        'import_receipts': phieu_nhap_preview,
        'export_receipts': phieu_xuat_preview,
        'total_adjustments': len(phieu_nhap_preview) + len(phieu_xuat_preview),
        'summary': {
            'total_increase': sum(item['SoLuong'] for item in phieu_nhap_preview),
            'total_decrease': sum(item['SoLuong'] for item in phieu_xuat_preview)
        }
    })


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
    identity = get_jwt_identity()
    
    # Handle both string and dict identity formats
    if isinstance(identity, str):
        ma_nv = identity
    elif isinstance(identity, dict):
        ma_nv = identity.get('id') or identity.get('MaNV') or identity.get('username')
    else:
        ma_nv = str(identity)
    
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
        
        from app.models import SanPham
        san_pham = SanPham.query.get(batch.MaSP)
        
        if chenh_lech > 0:
            # Surplus -> Create import receipt
            ma_phieu_nhap = generate_id('PNK', 6)
            while PhieuNhapKho.query.get(ma_phieu_nhap):
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
            
            tao_phieu = TaoPhieu(MaNV=ma_nv, MaPhieuTao=ma_phieu_nhap)
            db.session.add(tao_phieu)
            
            phieu_nhap_list.append({
                'MaPhieu': ma_phieu_nhap,
                'MaSP': batch.MaSP,
                'TenSP': san_pham.TenSP if san_pham else batch.MaSP,
                'MaLo': batch.MaLo,
                'SoLuong': chenh_lech,
                'Type': 'increase'
            })
        else:  # chenh_lech < 0
            # Shortage -> Create export receipt
            ma_phieu_xuat = generate_id('PXK', 6)
            while PhieuXuatKho.query.get(ma_phieu_xuat):
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
            
            tao_phieu = TaoPhieu(MaNV=ma_nv, MaPhieuTao=ma_phieu_xuat)
            db.session.add(tao_phieu)
            
            phieu_xuat_list.append({
                'MaPhieu': ma_phieu_xuat,
                'MaSP': batch.MaSP,
                'TenSP': san_pham.TenSP if san_pham else batch.MaSP,
                'MaLo': batch.MaLo,
                'SoLuong': abs(chenh_lech),
                'Type': 'decrease'
            })
    
    db.session.commit()
    
    return success_response({
        'phieu_nhap': phieu_nhap_list,
        'phieu_xuat': phieu_xuat_list,
        'total_adjustments': len(phieu_nhap_list) + len(phieu_xuat_list),
        'summary': {
            'import_receipts': len(phieu_nhap_list),
            'export_receipts': len(phieu_xuat_list),
            'total_increase': sum(item['SoLuong'] for item in phieu_nhap_list),
            'total_decrease': sum(item['SoLuong'] for item in phieu_xuat_list)
        }
    }, message="Adjustment completed successfully")


@warehouse_inventory_bp.route('/adjustment/history', methods=['GET'])
@jwt_required()
def get_adjustment_history():
    """
    Get history of all adjustments made
    
    Response: List of adjustment receipts
    """
    try:
        # Get all import/export receipts that are adjustments
        phieu_nhap_list = PhieuNhapKho.query.filter(
            PhieuNhapKho.MucDich.like('%Điều chỉnh%')
        ).order_by(PhieuNhapKho.NgayTao.desc()).all()
        
        phieu_xuat_list = PhieuXuatKho.query.filter(
            PhieuXuatKho.MucDich.like('%Điều chỉnh%')
        ).order_by(PhieuXuatKho.NgayTao.desc()).all()
        
        # Group by MaThamChieu (MaPhieuKiem)
        adjustments_map = {}
        
        for phieu in phieu_nhap_list:
            if phieu.MaThamChieu:
                if phieu.MaThamChieu not in adjustments_map:
                    adjustments_map[phieu.MaThamChieu] = {
                        'MaPhieuKiem': phieu.MaThamChieu,
                        'NgayDieuChinh': phieu.NgayTao,
                        'phieu_nhap': [],
                        'phieu_xuat': []
                    }
                adjustments_map[phieu.MaThamChieu]['phieu_nhap'].append(phieu.to_dict())
        
        for phieu in phieu_xuat_list:
            if phieu.MaThamChieu:
                if phieu.MaThamChieu not in adjustments_map:
                    adjustments_map[phieu.MaThamChieu] = {
                        'MaPhieuKiem': phieu.MaThamChieu,
                        'NgayDieuChinh': phieu.NgayTao,
                        'phieu_nhap': [],
                        'phieu_xuat': []
                    }
                adjustments_map[phieu.MaThamChieu]['phieu_xuat'].append(phieu.to_dict())
        
        result = list(adjustments_map.values())
        
        return success_response({
            'adjustments': result,
            'total': len(result)
        })
    except Exception as e:
        return error_response(f"Error getting adjustment history: {str(e)}", 500)


# =============================================
# UC09: HỦY HÀNG - ENHANCED
# =============================================

@warehouse_inventory_bp.route('/discard/error-warehouse-inventory', methods=['GET'])
@jwt_required()
def get_error_warehouse_inventory():
    """
    Get inventory in error warehouse for discarding
    
    Response: List of batches in error warehouse with expiry info
    """
    try:
        from app.models import KhoHang, LoaiKho, SanPham
        
        # Find error warehouse
        kho_loi = KhoHang.query.filter_by(Loai=LoaiKho.KHO_LOI).first()
        
        if not kho_loi:
            return error_response("Error warehouse not found", 404)
        
        # Get all batches in error warehouse with stock > 0
        batches = LoSP.query.filter(
            LoSP.MaKho == kho_loi.MaKho,
            LoSP.SLTon > 0
        ).order_by(LoSP.HSD.asc()).all()
        
        result = []
        for batch in batches:
            san_pham = SanPham.query.get(batch.MaSP)
            if not san_pham:
                continue
            
            # Calculate expiry info
            is_expired = False
            days_to_expiry = None
            expiry_status = 'normal'
            
            if batch.HSD:
                days_to_expiry = (batch.HSD - datetime.utcnow().date()).days
                is_expired = days_to_expiry < 0
                
                if is_expired:
                    expiry_status = 'expired'
                elif days_to_expiry <= 7:
                    expiry_status = 'critical'
                elif days_to_expiry <= 30:
                    expiry_status = 'warning'
            
            result.append({
                'MaSP': batch.MaSP,
                'TenSP': san_pham.TenSP,
                'DVT': san_pham.DVT,
                'LoaiSP': san_pham.LoaiSP,
                'MaLo': batch.MaLo,
                'MaVach': batch.MaVach,
                'NSX': batch.NSX.isoformat() if batch.NSX else None,
                'HSD': batch.HSD.isoformat() if batch.HSD else None,
                'SLTon': batch.SLTon,
                'MaKho': batch.MaKho,
                'days_to_expiry': days_to_expiry,
                'is_expired': is_expired,
                'expiry_status': expiry_status
            })
        
        return success_response({
            'warehouse': kho_loi.to_dict(),
            'batches': result,
            'total_batches': len(result),
            'total_items': sum(b['SLTon'] for b in result)
        })
    except Exception as e:
        return error_response(f"Error getting error warehouse inventory: {str(e)}", 500)


@warehouse_inventory_bp.route('/discard/validate', methods=['POST'])
@jwt_required()
def validate_discard():
    """
    Validate discard request before execution
    
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
    
    Response: Validation result with warnings and errors
    """
    data = request.get_json()
    
    if not data.get('LyDo') or not data.get('items'):
        return error_response("LyDo and items are required", 400)
    
    from app.models import KhoHang, LoaiKho, SanPham
    
    warnings = []
    errors = []
    validated_items = []
    
    # Find error warehouse
    kho_loi = KhoHang.query.filter_by(Loai=LoaiKho.KHO_LOI).first()
    if not kho_loi:
        return error_response("Error warehouse not found", 404)
    
    for idx, item in enumerate(data['items']):
        ma_sp = item.get('MaSP')
        ma_lo = item.get('MaLo')
        so_luong = item.get('SoLuong', 0)
        
        # Find batch in error warehouse
        batch = LoSP.query.filter_by(
            MaSP=ma_sp,
            MaLo=ma_lo,
            MaKho=kho_loi.MaKho
        ).first()
        
        if not batch:
            errors.append(f"Dòng {idx + 1}: Lô {ma_lo} không tồn tại trong kho lỗi")
            continue
        
        if batch.SLTon < so_luong:
            errors.append(
                f"Dòng {idx + 1}: Không đủ tồn kho. "
                f"Có: {batch.SLTon}, Yêu cầu: {so_luong}"
            )
            continue
        
        # Check expiry status
        if batch.HSD:
            days_to_expiry = (batch.HSD - datetime.utcnow().date()).days
            if days_to_expiry > 0:
                warnings.append(
                    f"Dòng {idx + 1}: Lô {ma_lo} chưa hết hạn "
                    f"(còn {days_to_expiry} ngày). Vui lòng xác nhận lý do hủy."
                )
        
        san_pham = SanPham.query.get(ma_sp)
        validated_items.append({
            'MaSP': ma_sp,
            'TenSP': san_pham.TenSP if san_pham else ma_sp,
            'DVT': san_pham.DVT if san_pham else '',
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
            'total_items': len(data['items']),
            'total_quantity': sum(item.get('SoLuong', 0) for item in data['items']),
            'warehouse': kho_loi.MaKho,
            'reason': data['LyDo']
        }
    })


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
    identity = get_jwt_identity()
    
    # Handle both string and dict identity formats
    if isinstance(identity, str):
        ma_nv = identity
    elif isinstance(identity, dict):
        ma_nv = identity.get('id') or identity.get('MaNV') or identity.get('username')
    else:
        ma_nv = str(identity)
    
    if not data.get('items') or not data.get('LyDo'):
        return error_response("items and LyDo are required", 400)
    
    try:
        from app.models import KhoHang, LoaiKho, SanPham
        
        # Find error warehouse
        kho_loi = KhoHang.query.filter_by(Loai=LoaiKho.KHO_LOI).first()
        if not kho_loi:
            db.session.rollback()
            return error_response("Error warehouse not found", 404)
        
        # Generate phiếu xuất kho for discarding
        ma_phieu = generate_id('PXK', 6)
        while PhieuXuatKho.query.get(ma_phieu):
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
            
            # Find batch in error warehouse
            batch = LoSP.query.filter_by(
                MaSP=ma_sp,
                MaLo=ma_lo,
                MaKho=kho_loi.MaKho
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
                    f"Insufficient stock for {ma_sp}/{ma_lo}. Available: {batch.SLTon}, Requested: {so_luong}",
                    400
                )
            
            # Deduct stock
            batch.SLTon -= so_luong
            batch.MaPhieuXK = ma_phieu
            
            san_pham = SanPham.query.get(ma_sp)
            
            discarded_items.append({
                'MaSP': ma_sp,
                'TenSP': san_pham.TenSP if san_pham else ma_sp,
                'DVT': san_pham.DVT if san_pham else '',
                'MaLo': ma_lo,
                'MaVach': batch.MaVach,
                'NSX': batch.NSX.isoformat() if batch.NSX else None,
                'HSD': batch.HSD.isoformat() if batch.HSD else None,
                'SoLuong': so_luong,
                'SLTonConLai': batch.SLTon,
                'MaKho': batch.MaKho
            })
        
        # Record who created (for audit log)
        tao_phieu = TaoPhieu(MaNV=ma_nv, MaPhieuTao=ma_phieu)
        db.session.add(tao_phieu)
        
        db.session.commit()
        
        return success_response({
            'phieu': phieu.to_dict(),
            'discarded_items': discarded_items,
            'total_items': len(discarded_items),
            'total_quantity': sum(item['SoLuong'] for item in discarded_items),
            'reason': data['LyDo'],
            'created_by': ma_nv
        }, message="Goods discarded successfully", status=201)
        
    except Exception as e:
        db.session.rollback()
        print(f"Discard error: {str(e)}")
        import traceback
        traceback.print_exc()
        return error_response(f"Error discarding goods: {str(e)}", 500)


@warehouse_inventory_bp.route('/discard/history', methods=['GET'])
@jwt_required()
def get_discard_history():
    """
    Get history of all discard operations (for audit)
    
    Response: List of discard receipts with items
    """
    try:
        # Get all export receipts for discarding
        phieu_list = PhieuXuatKho.query.filter(
            PhieuXuatKho.MucDich == 'Xuất hủy hàng'
        ).order_by(PhieuXuatKho.NgayTao.desc()).all()
        
        result = []
        for phieu in phieu_list:
            phieu_data = phieu.to_dict()
            
            # Get items from this discard
            batches = LoSP.query.filter_by(MaPhieuXK=phieu.MaPhieu).all()
            phieu_data['items'] = []
            
            for batch in batches:
                from app.models import SanPham
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
                        'SLTon': batch.SLTon
                    })
            
            # Get who created (for audit)
            tao_phieu = TaoPhieu.query.filter_by(MaPhieuTao=phieu.MaPhieu).first()
            if tao_phieu:
                phieu_data['created_by'] = tao_phieu.MaNV
            
            result.append(phieu_data)
        
        return success_response({
            'discards': result,
            'total': len(result)
        })
    except Exception as e:
        return error_response(f"Error getting discard history: {str(e)}", 500)


@warehouse_inventory_bp.route('/discard/<string:ma_phieu>', methods=['GET'])
@jwt_required()
def get_discard_detail(ma_phieu):
    """Get detailed discard information"""
    phieu = PhieuXuatKho.query.get(ma_phieu)
    
    if not phieu or phieu.MucDich != 'Xuất hủy hàng':
        return error_response("Discard receipt not found", 404)
    
    phieu_data = phieu.to_dict()
    
    # Get items
    batches = LoSP.query.filter_by(MaPhieuXK=ma_phieu).all()
    phieu_data['items'] = []
    
    for batch in batches:
        from app.models import SanPham
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
                'SLTon': batch.SLTon
            })
    
    # Get who created
    tao_phieu = TaoPhieu.query.filter_by(MaPhieuTao=ma_phieu).first()
    if tao_phieu:
        phieu_data['created_by'] = tao_phieu.MaNV
    
    return success_response(phieu_data)
