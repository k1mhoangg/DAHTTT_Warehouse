"""Sales routes (UC11: Mua hàng - Point of Sale)"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.models import (
    HoaDon, HoaDonSP, SanPham, LoSP, KhoHang, 
    PhieuXuatKho, ThuNgan
)
from app import db
from app.utils.helpers import success_response, error_response, paginate, generate_id
from sqlalchemy import and_, or_, func
from datetime import datetime, date

sales_bp = Blueprint('sales', __name__)


@sales_bp.route('/products/search', methods=['GET'])
@jwt_required()
def search_products():
    """
    Search products available for sale (có tồn kho tại Kho thường)
    
    Query params:
        - search: Tìm theo tên hoặc mã sản phẩm
        - barcode: Tìm theo mã vạch
        - page: Trang (default: 1)
        - per_page: Số items/trang (default: 20)
    """
    search = request.args.get('search', '')
    barcode = request.args.get('barcode', '')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    try:
        # Get "Kho thường" warehouse
        kho_thuong = KhoHang.query.filter_by(Loai='Kho thường').first()
        if not kho_thuong:
            return error_response("Không tìm thấy Kho thường", 404)
        
        # Base query - products with stock in Kho thường
        query = db.session.query(
            SanPham,
            func.sum(LoSP.SLTon).label('total_stock')
        ).join(
            LoSP, SanPham.MaSP == LoSP.MaSP
        ).filter(
            LoSP.MaKho == kho_thuong.MaKho,
            LoSP.SLTon > 0,
            SanPham.TrangThai == 'Còn hàng'
        )
        
        # Search by barcode
        if barcode:
            lo = LoSP.query.filter_by(MaVach=barcode).first()
            if lo:
                query = query.filter(SanPham.MaSP == lo.MaSP)
            else:
                return success_response({
                    'items': [],
                    'total': 0,
                    'page': page,
                    'per_page': per_page,
                    'pages': 0
                })
        
        # Search by name or code
        if search:
            query = query.filter(
                or_(
                    SanPham.TenSP.contains(search),
                    SanPham.MaSP.contains(search)
                )
            )
        
        query = query.group_by(SanPham.MaSP)
        
        # Paginate
        total = query.count()
        items = query.offset((page - 1) * per_page).limit(per_page).all()
        
        result_items = []
        for product, total_stock in items:
            product_dict = product.to_dict()
            product_dict['total_stock'] = int(total_stock) if total_stock else 0
            result_items.append(product_dict)
        
        return success_response({
            'items': result_items,
            'total': total,
            'page': page,
            'per_page': per_page,
            'pages': (total + per_page - 1) // per_page
        })
        
    except Exception as e:
        return error_response(f"Lỗi tìm kiếm sản phẩm: {str(e)}", 500)


@sales_bp.route('/products/<string:ma_sp>/batches', methods=['GET'])
@jwt_required()
def get_product_batches_fefo(ma_sp):
    """
    Get available batches for a product using FEFO (First Expire, First Out)
    Chỉ lấy lô từ Kho thường, sắp xếp theo HSD gần nhất
    """
    try:
        product = SanPham.query.get(ma_sp)
        if not product:
            return error_response("Không tìm thấy sản phẩm", 404)
        
        # Get Kho thường
        kho_thuong = KhoHang.query.filter_by(Loai='Kho thường').first()
        if not kho_thuong:
            return error_response("Không tìm thấy Kho thường", 404)
        
        # Get batches with stock, sorted by HSD (FEFO)
        batches = LoSP.query.filter(
            LoSP.MaSP == ma_sp,
            LoSP.MaKho == kho_thuong.MaKho,
            LoSP.SLTon > 0
        ).order_by(LoSP.HSD.asc()).all()
        
        batches_data = []
        for batch in batches:
            batch_dict = batch.to_dict()
            
            # Calculate expiry status
            if batch.HSD:
                days_to_expire = (batch.HSD - date.today()).days
                if days_to_expire < 0:
                    batch_dict['expiry_status'] = 'expired'
                elif days_to_expire <= 30:
                    batch_dict['expiry_status'] = 'expiring_soon'
                else:
                    batch_dict['expiry_status'] = 'good'
                batch_dict['days_to_expire'] = days_to_expire
            else:
                batch_dict['expiry_status'] = 'unknown'
                batch_dict['days_to_expire'] = None
            
            batches_data.append(batch_dict)
        
        return success_response({
            'product': product.to_dict(),
            'batches': batches_data,
            'total_stock': sum(b.SLTon for b in batches)
        })
        
    except Exception as e:
        return error_response(f"Lỗi lấy thông tin lô: {str(e)}", 500)


@sales_bp.route('/scan-barcode', methods=['POST'])
@jwt_required()
def scan_barcode():
    """
    Scan barcode to get batch and product information
    
    Request body:
        {
            "barcode": "string"
        }
    """
    data = request.get_json()
    barcode = data.get('barcode')
    
    if not barcode:
        return error_response("Barcode là bắt buộc", 400)
    
    try:
        # Find batch by barcode
        batch = LoSP.query.filter_by(MaVach=barcode).first()
        
        if not batch:
            return error_response("Không tìm thấy sản phẩm với mã vạch này", 404)
        
        # Check if batch is in Kho thường
        kho_thuong = KhoHang.query.filter_by(Loai='Kho thường').first()
        if not kho_thuong or batch.MaKho != kho_thuong.MaKho:
            return error_response("Sản phẩm không có sẵn tại Kho thường", 400)
        
        # Check stock
        if batch.SLTon <= 0:
            return error_response("Sản phẩm đã hết hàng", 400)
        
        # Get product info
        product = SanPham.query.get(batch.MaSP)
        if not product:
            return error_response("Không tìm thấy thông tin sản phẩm", 404)
        
        # Check expiry
        expiry_warning = None
        if batch.HSD:
            days_to_expire = (batch.HSD - date.today()).days
            if days_to_expire < 0:
                expiry_warning = "Sản phẩm đã hết hạn sử dụng"
            elif days_to_expire <= 7:
                expiry_warning = f"Sản phẩm sắp hết hạn (còn {days_to_expire} ngày)"
        
        return success_response({
            'product': product.to_dict(),
            'batch': batch.to_dict(),
            'expiry_warning': expiry_warning
        })
        
    except Exception as e:
        return error_response(f"Lỗi quét mã vạch: {str(e)}", 500)


@sales_bp.route('/invoices', methods=['POST'])
@jwt_required()
def create_invoice():
    """
    Create invoice and automatically create export slip (Phiếu Xuất Kho)
    Thu ngân only
    
    UC11: Mua hàng
    Luồng:
    1. Thu ngân quét barcode sản phẩm
    2. Hệ thống xác định lô FEFO từ Kho thường, tính tổng tiền
    3. Thu ngân nhận thanh toán
    4. Hoàn tất giao dịch. Hệ thống in hóa đơn và tự động tạo Phiếu Xuất Kho
    
    Request body:
        {
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
    data = request.get_json()
    items = data.get('items', [])
    
    if not items or len(items) == 0:
        return error_response("Danh sách sản phẩm không được rỗng", 400)
    
    try:
        # Get current user (Thu Ngân)
        user_id = get_jwt_identity()
        claims = get_jwt()
        user_type = claims.get('type')
        
        if user_type != 'ThuNgan':
            return error_response("Chỉ Thu Ngân mới có thể tạo hóa đơn", 403)
        
        thu_ngan = ThuNgan.query.get(user_id)
        if not thu_ngan:
            return error_response("Không tìm thấy thông tin Thu Ngân", 404)
        
        # Get Kho thường
        kho_thuong = KhoHang.query.filter_by(Loai='Kho thường').first()
        if not kho_thuong:
            return error_response("Không tìm thấy Kho thường", 404)
        
        # Validate all items first
        validated_items = []
        total_amount = 0
        
        for item in items:
            ma_sp = item.get('MaSP')
            ma_lo = item.get('MaLo')
            so_luong = item.get('SoLuong', 0)
            
            if not ma_sp or not ma_lo or so_luong <= 0:
                return error_response(f"Thông tin sản phẩm {ma_sp} không hợp lệ", 400)
            
            # Check product exists
            product = SanPham.query.get(ma_sp)
            if not product:
                return error_response(f"Không tìm thấy sản phẩm {ma_sp}", 404)
            
            # Check batch exists and has enough stock
            batch = LoSP.query.filter_by(MaSP=ma_sp, MaLo=ma_lo).first()
            if not batch:
                return error_response(f"Không tìm thấy lô {ma_lo} của sản phẩm {ma_sp}", 404)
            
            if batch.MaKho != kho_thuong.MaKho:
                return error_response(f"Lô {ma_lo} không ở Kho thường", 400)
            
            if batch.SLTon < so_luong:
                return error_response(
                    f"Lô {ma_lo} không đủ hàng (tồn: {batch.SLTon}, cần: {so_luong})",
                    400
                )
            
            # Check expiry
            if batch.HSD and batch.HSD < date.today():
                return error_response(f"Lô {ma_lo} đã hết hạn sử dụng", 400)
            
            validated_items.append({
                'product': product,
                'batch': batch,
                'so_luong': so_luong,
                'gia_ban': product.GiaBan,
                'thanh_tien': product.GiaBan * so_luong
            })
            
            total_amount += product.GiaBan * so_luong
        
        # Generate invoice ID
        ma_hd = generate_id('HD', 6)
        while HoaDon.query.get(ma_hd):
            ma_hd = generate_id('HD', 6)
        
        # Create invoice
        invoice = HoaDon(
            MaHD=ma_hd,
            NgayTao=datetime.now(),
            MaNVThuNgan=thu_ngan.MaNV
        )
        db.session.add(invoice)
        
        # Create invoice items
        for item in validated_items:
            invoice_item = HoaDonSP(
                MaSP=item['product'].MaSP,
                MaHD=ma_hd,
                SoLuong=item['so_luong']
            )
            db.session.add(invoice_item)
        
        # Create export slip (Phiếu Xuất Kho - mục đích: Xuất bán hàng)
        ma_phieu_xk = generate_id('PXK', 6)
        while PhieuXuatKho.query.get(ma_phieu_xk):
            ma_phieu_xk = generate_id('PXK', 6)
        
        export_slip = PhieuXuatKho(
            MaPhieu=ma_phieu_xk,
            NgayTao=datetime.now(),
            MucDich='Xuất bán hàng',
            MaThamChieu=ma_hd  # Reference to invoice
        )
        db.session.add(export_slip)
        
        # Update batch stock
        for item in validated_items:
            batch = item['batch']
            batch.SLTon -= item['so_luong']
            batch.MaPhieuXK = ma_phieu_xk
        
        db.session.commit()
        
        # Prepare response
        invoice_data = invoice.to_dict()
        invoice_data['items'] = [{
            'MaSP': item['product'].MaSP,
            'TenSP': item['product'].TenSP,
            'MaLo': item['batch'].MaLo,
            'SoLuong': item['so_luong'],
            'DonGia': float(item['gia_ban']),
            'ThanhTien': float(item['thanh_tien'])
        } for item in validated_items]
        invoice_data['TongTien'] = float(total_amount)
        invoice_data['MaPhieuXK'] = ma_phieu_xk
        invoice_data['TenThuNgan'] = thu_ngan.Ten
        
        return success_response(
            invoice_data,
            message="Tạo hóa đơn thành công",
            status=201
        )
        
    except Exception as e:
        db.session.rollback()
        return error_response(f"Lỗi tạo hóa đơn: {str(e)}", 500)


@sales_bp.route('/invoices', methods=['GET'])
@jwt_required()
def get_invoices():
    """
    Get list of invoices with pagination
    
    Query params:
        - page: Page number (default: 1)
        - per_page: Items per page (default: 20)
        - from_date: Filter from date (YYYY-MM-DD)
        - to_date: Filter to date (YYYY-MM-DD)
        - ma_nv: Filter by cashier ID
    """
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    from_date = request.args.get('from_date')
    to_date = request.args.get('to_date')
    ma_nv = request.args.get('ma_nv')
    
    try:
        query = HoaDon.query
        
        # Apply filters
        if from_date:
            query = query.filter(HoaDon.NgayTao >= datetime.strptime(from_date, '%Y-%m-%d'))
        
        if to_date:
            # Add 1 day to include the whole day
            end_date = datetime.strptime(to_date, '%Y-%m-%d')
            end_date = end_date.replace(hour=23, minute=59, second=59)
            query = query.filter(HoaDon.NgayTao <= end_date)
        
        if ma_nv:
            query = query.filter(HoaDon.MaNVThuNgan == ma_nv)
        
        query = query.order_by(HoaDon.NgayTao.desc())
        
        # Paginate
        result = paginate(query, page=page, per_page=per_page)
        
        # Add items and total for each invoice
        for invoice_dict in result['items']:
            invoice = HoaDon.query.get(invoice_dict['MaHD'])
            if invoice:
                items = []
                total = 0
                for hd_sp in invoice.hoa_don_sps:
                    product = hd_sp.san_pham
                    item_total = product.GiaBan * hd_sp.SoLuong
                    items.append({
                        'MaSP': hd_sp.MaSP,
                        'TenSP': product.TenSP,
                        'SoLuong': hd_sp.SoLuong,
                        'DonGia': float(product.GiaBan),
                        'ThanhTien': float(item_total)
                    })
                    total += item_total
                
                invoice_dict['items'] = items
                invoice_dict['TongTien'] = float(total)
                
                # Add cashier name
                if invoice.thu_ngan:
                    invoice_dict['TenThuNgan'] = invoice.thu_ngan.Ten
        
        return success_response(result)
        
    except Exception as e:
        return error_response(f"Lỗi lấy danh sách hóa đơn: {str(e)}", 500)


@sales_bp.route('/invoices/<string:ma_hd>', methods=['GET'])
@jwt_required()
def get_invoice_detail(ma_hd):
    """Get invoice detail by ID"""
    try:
        invoice = HoaDon.query.get(ma_hd)
        if not invoice:
            return error_response("Không tìm thấy hóa đơn", 404)
        
        invoice_data = invoice.to_dict()
        
        # Get items
        items = []
        total = 0
        for hd_sp in invoice.hoa_don_sps:
            product = hd_sp.san_pham
            item_total = product.GiaBan * hd_sp.SoLuong
            items.append({
                'MaSP': hd_sp.MaSP,
                'TenSP': product.TenSP,
                'DVT': product.DVT,
                'SoLuong': hd_sp.SoLuong,
                'DonGia': float(product.GiaBan),
                'ThanhTien': float(item_total)
            })
            total += item_total
        
        invoice_data['items'] = items
        invoice_data['TongTien'] = float(total)
        
        # Add cashier info
        if invoice.thu_ngan:
            invoice_data['ThuNgan'] = {
                'MaNV': invoice.thu_ngan.MaNV,
                'Ten': invoice.thu_ngan.Ten,
                'SDT': invoice.thu_ngan.SDT
            }
        
        # Find related export slip
        export_slip = PhieuXuatKho.query.filter_by(MaThamChieu=ma_hd).first()
        if export_slip:
            invoice_data['MaPhieuXK'] = export_slip.MaPhieu
        
        return success_response(invoice_data)
        
    except Exception as e:
        return error_response(f"Lỗi lấy chi tiết hóa đơn: {str(e)}", 500)


@sales_bp.route('/stats/daily', methods=['GET'])
@jwt_required()
def get_daily_stats():
    """
    Get daily sales statistics
    
    Query params:
        - date: Date to get stats (YYYY-MM-DD), default: today
    """
    date_str = request.args.get('date')
    
    try:
        if date_str:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        else:
            target_date = date.today()
        
        # Get invoices for the date
        start_time = datetime.combine(target_date, datetime.min.time())
        end_time = datetime.combine(target_date, datetime.max.time())
        
        invoices = HoaDon.query.filter(
            HoaDon.NgayTao >= start_time,
            HoaDon.NgayTao <= end_time
        ).all()
        
        # Calculate stats
        total_invoices = len(invoices)
        total_revenue = 0
        total_items = 0
        
        for invoice in invoices:
            for hd_sp in invoice.hoa_don_sps:
                product = hd_sp.san_pham
                total_revenue += product.GiaBan * hd_sp.SoLuong
                total_items += hd_sp.SoLuong
        
        return success_response({
            'date': target_date.isoformat(),
            'total_invoices': total_invoices,
            'total_revenue': float(total_revenue),
            'total_items': total_items,
            'average_order_value': float(total_revenue / total_invoices) if total_invoices > 0 else 0
        })
        
    except Exception as e:
        return error_response(f"Lỗi lấy thống kê: {str(e)}", 500)
