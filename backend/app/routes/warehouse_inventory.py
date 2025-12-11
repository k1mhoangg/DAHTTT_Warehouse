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
# UC06: KIỂM KHO
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
    claims = get_jwt_identity()
    
    if not data.get('MaKho'):
        return error_response("MaKho is required", 400)
    
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
    
    # Get all batches in this warehouse
    batches = LoSP.query.filter_by(MaKho=data['MaKho']).all()
    
    batch_list = []
    for batch in batches:
        batch_data = batch.to_dict()
        batch_data['SLHeThong'] = batch.SLTon  # Current system quantity
        batch_data['SLThucTe'] = None  # To be filled during counting
        batch_list.append(batch_data)
    
    # Record who created
    tao_phieu = TaoPhieu(MaNV=claims['id'], MaPhieuTao=ma_phieu)
    db.session.add(tao_phieu)
    
    db.session.commit()
    
    return success_response({
        'phieu': phieu.to_dict(),
        'batches': batch_list,
        'total_batches': len(batch_list)
    }, message="Inventory started", status=201)


@warehouse_inventory_bp.route('/inventory/record', methods=['POST'])
@jwt_required()
@role_required('Quản lý', 'Nhân viên')
def record_inventory():
    """
    Ghi nhận kết quả kiểm kê
    
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
    claims = get_jwt_identity()
    
    ma_phieu = data.get('MaPhieu')
    if not ma_phieu:
        return error_response("MaPhieu is required", 400)
    
    phieu = PhieuKiemKho.query.get(ma_phieu)
    if not phieu:
        return error_response("Phiếu kiểm kho not found", 404)
    
    # Process inventory items
    discrepancies = []
    
    for item in data.get('items', []):
        ma_sp = item.get('MaSP')
        ma_lo = item.get('MaLo')
        ma_vach = item.get('MaVach')
        sl_thuc_te = item.get('SLThucTe', 0)
        
        # Find batch by barcode or product/batch code
        if ma_vach:
            batch = LoSP.query.filter_by(MaVach=ma_vach).first()
        else:
            batch = LoSP.query.filter_by(MaSP=ma_sp, MaLo=ma_lo).first()
        
        if not batch:
            continue
        
        # Calculate discrepancy
        sl_he_thong = batch.SLTon
        chenh_lech = sl_thuc_te - sl_he_thong
        
        # Generate report ID
        ma_bao_cao = generate_id('BC', 6)
        
        # Create report entry
        bao_cao = BaoCao(
            MaPhieu=ma_phieu,
            MaBaoCao=ma_bao_cao,
            SLThucTe=sl_thuc_te,
            NgayTao=datetime.utcnow(),
            MaNV=claims['id']
        )
        
        db.session.add(bao_cao)
        
        # Update batch reference to report
        batch.MaPhieuKiem = ma_phieu
        batch.MaBaoCao = ma_bao_cao
        
        if chenh_lech != 0:
            discrepancies.append({
                'MaSP': batch.MaSP,
                'MaLo': batch.MaLo,
                'MaVach': batch.MaVach,
                'SLHeThong': sl_he_thong,
                'SLThucTe': sl_thuc_te,
                'ChenhLech': chenh_lech,
                'MaBaoCao': ma_bao_cao
            })
    
    db.session.commit()
    
    return success_response({
        'phieu': phieu.to_dict(),
        'discrepancies': discrepancies,
        'total_discrepancies': len(discrepancies),
        'has_discrepancies': len(discrepancies) > 0
    }, message="Inventory recorded")


@warehouse_inventory_bp.route('/inventory/<string:ma_phieu>', methods=['GET'])
@jwt_required()
def get_inventory_report(ma_phieu):
    """Get detailed inventory report"""
    
    phieu = PhieuKiemKho.query.get(ma_phieu)
    if not phieu:
        return error_response("Phiếu kiểm kho not found", 404)
    
    # Get all reports for this inventory
    bao_caos = BaoCao.query.filter_by(MaPhieu=ma_phieu).all()
    
    items = []
    total_discrepancy = 0
    
    for bao_cao in bao_caos:
        # Get batch info
        batch = LoSP.query.filter_by(
            MaPhieuKiem=ma_phieu,
            MaBaoCao=bao_cao.MaBaoCao
        ).first()
        
        if batch:
            sl_he_thong = batch.SLTon
            sl_thuc_te = bao_cao.SLThucTe
            chenh_lech = sl_thuc_te - sl_he_thong
            
            items.append({
                'MaSP': batch.MaSP,
                'MaLo': batch.MaLo,
                'MaVach': batch.MaVach,
                'SLHeThong': sl_he_thong,
                'SLThucTe': sl_thuc_te,
                'ChenhLech': chenh_lech,
                'MaBaoCao': bao_cao.MaBaoCao
            })
            
            total_discrepancy += abs(chenh_lech)
    
    return success_response({
        'phieu': phieu.to_dict(),
        'items': items,
        'summary': {
            'total_items': len(items),
            'items_with_discrepancy': len([i for i in items if i['ChenhLech'] != 0]),
            'total_discrepancy': total_discrepancy
        }
    })


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
