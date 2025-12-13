"""
Order management routes
UC02: Đặt hàng từ nhà cung cấp
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import NhaCungCap, SanPham, NhanVienKho, DatHang
from app import db
from app.utils.auth import role_required
from app.utils.helpers import success_response, error_response, generate_id
from datetime import datetime
from sqlalchemy import func, text
import json

orders_bp = Blueprint('orders', __name__)


# =============================================
# UC02: ĐẶT HÀNG TỪ NHÀ CUNG CẤP
# =============================================

@orders_bp.route('/suppliers', methods=['GET'])
@jwt_required()
def get_suppliers():
    """Get all suppliers for order creation"""
    try:
        suppliers = NhaCungCap.query.all()
        return success_response({
            'suppliers': [s.to_dict() for s in suppliers],
            'total': len(suppliers)
        })
    except Exception as e:
        return error_response(f"Error getting suppliers: {str(e)}", 500)


@orders_bp.route('/suppliers/<string:ten>', methods=['GET'])
@jwt_required()
def get_supplier(ten):
    """Get supplier details"""
    supplier = NhaCungCap.query.get(ten)
    if not supplier:
        return error_response("Supplier not found", 404)
    
    return success_response(supplier.to_dict())


@orders_bp.route('/suggest-order', methods=['GET'])
@jwt_required()
def suggest_order():
    """
    UC02: Gợi ý sản phẩm cần đặt dựa trên mức cảnh báo
    
    Response: List of products with stock below warning level
    """
    try:
        from app.models import LoSP
        
        products = SanPham.query.all()
        suggestions = []
        
        for product in products:
            # Calculate total stock across all warehouses
            total_stock = db.session.query(func.sum(LoSP.SLTon))\
                .filter(LoSP.MaSP == product.MaSP)\
                .scalar() or 0
            
            # Check if below warning level
            if total_stock < product.MucCanhBaoDatHang:
                suggested_quantity = product.MucCanhBaoDatHang - total_stock
                
                suggestions.append({
                    **product.to_dict(),
                    'current_stock': total_stock,
                    'warning_level': product.MucCanhBaoDatHang,
                    'suggested_quantity': suggested_quantity,
                    'shortage': product.MucCanhBaoDatHang - total_stock
                })
        
        # Sort by shortage (most urgent first)
        suggestions.sort(key=lambda x: x['shortage'], reverse=True)
        
        return success_response({
            'suggestions': suggestions,
            'total': len(suggestions)
        })
    except Exception as e:
        return error_response(f"Error getting suggestions: {str(e)}", 500)


@orders_bp.route('/orders', methods=['POST'])
@jwt_required()
@role_required('Quản lý', 'Nhân viên')
def create_order():
    """
    UC02: Tạo đơn đặt hàng
    
    Request body:
        {
            "TenNCC": "string",
            "MucDich": "string",
            "items": [
                {
                    "MaSP": "string",
                    "SoLuongDat": int,
                    "GhiChu": "string" (optional)
                }
            ]
        }
    """
    try:
        data = request.get_json()
        identity = get_jwt_identity()
        
        if isinstance(identity, str):
            ma_nv = identity
        elif isinstance(identity, dict):
            ma_nv = identity.get('id') or identity.get('MaNV') or identity.get('username')
        else:
            ma_nv = str(identity)
        
        # Validate
        if not data.get('TenNCC') or not data.get('items'):
            return error_response("TenNCC and items are required", 400)
        
        # Check supplier exists
        ncc = NhaCungCap.query.get(data['TenNCC'])
        if not ncc:
            return error_response("Supplier not found", 404)
        
        # Validate all products and build order items
        order_items = []
        total_amount = 0
        
        for item in data['items']:
            san_pham = SanPham.query.get(item.get('MaSP'))
            if not san_pham:
                return error_response(f"Product {item.get('MaSP')} not found", 404)
            
            # Convert SoLuongDat to int and validate
            try:
                so_luong_dat = int(item.get('SoLuongDat', 0))
            except (ValueError, TypeError):
                return error_response(f"Invalid quantity for {item.get('MaSP')}", 400)
            
            if so_luong_dat <= 0:
                return error_response(f"Quantity must be greater than 0 for {item.get('MaSP')}", 400)
            
            item_total = float(san_pham.GiaBan) * so_luong_dat
            total_amount += item_total
            
            order_items.append({
                'MaSP': item['MaSP'],
                'TenSP': san_pham.TenSP,
                'SoLuongDat': so_luong_dat,
                'DVT': san_pham.DVT,
                'GiaBan': float(san_pham.GiaBan),
                'GhiChu': item.get('GhiChu', ''),
                'ThanhTien': item_total
            })
        
        # Generate order ID
        ma_don_hang = generate_id('DH', 6)
        
        # Check if relationship exists
        existing_dat_hang = DatHang.query.filter_by(
            TenNCC=data['TenNCC'], 
            MaNV=ma_nv
        ).first()
        
        if existing_dat_hang:
            # Update existing record
            sql = text("""
                UPDATE DatHang
                SET MaDonHang = :ma_don_hang,
                    NgayDat = :ngay_dat,
                    MucDich = :muc_dich,
                    TrangThai = 'Chờ duyệt',
                    ChiTietDonHang = :chi_tiet
                WHERE TenNCC = :ten_ncc AND MaNV = :ma_nv
            """)
        else:
            # Insert new record
            sql = text("""
                INSERT INTO DatHang (TenNCC, MaNV, MaDonHang, NgayDat, MucDich, TrangThai, ChiTietDonHang)
                VALUES (:ten_ncc, :ma_nv, :ma_don_hang, :ngay_dat, :muc_dich, 'Chờ duyệt', :chi_tiet)
            """)
        
        db.session.execute(sql, {
            'ten_ncc': data['TenNCC'],
            'ma_nv': ma_nv,
            'ma_don_hang': ma_don_hang,
            'ngay_dat': datetime.utcnow(),
            'muc_dich': data.get('MucDich', f'Đặt hàng từ {data["TenNCC"]}'),
            'chi_tiet': json.dumps(order_items, ensure_ascii=False)
        })
        
        db.session.commit()
        
        return success_response({
            'order': {
                'MaDonHang': ma_don_hang,
                'TenNCC': data['TenNCC'],
                'MaNV': ma_nv,
                'NgayDat': datetime.utcnow().isoformat(),
                'MucDich': data.get('MucDich'),
                'TrangThai': 'Chờ duyệt',
                'supplier': ncc.to_dict(),
                'items': order_items,
                'total_items': len(order_items),
                'total_quantity': sum(item['SoLuongDat'] for item in order_items),
                'total_amount': total_amount
            }
        }, message="Order created successfully. Waiting for approval.", status=201)
        
    except Exception as e:
        db.session.rollback()
        print(f"Create order error: {str(e)}")
        import traceback
        traceback.print_exc()
        return error_response(f"Error creating order: {str(e)}", 500)


@orders_bp.route('/orders', methods=['GET'])
@jwt_required()
def get_orders():
    """Get all purchase orders"""
    try:
        sql = text("""
            SELECT 
                d.MaDonHang,
                d.TenNCC,
                d.MaNV as MaNVTao,
                d.NgayDat,
                d.MucDich,
                d.TrangThai,
                d.MaNVDuyet,
                d.NgayDuyet,
                d.LyDoTuChoi,
                d.ChiTietDonHang,
                nv_tao.Ten as TenNVTao,
                nv_duyet.Ten as TenNVDuyet
            FROM DatHang d
            LEFT JOIN NhanVienKho nv_tao ON d.MaNV = nv_tao.MaNV
            LEFT JOIN NhanVienKho nv_duyet ON d.MaNVDuyet = nv_duyet.MaNV
            WHERE d.MaDonHang IS NOT NULL
            ORDER BY d.NgayDat DESC
        """)
        
        orders_result = db.session.execute(sql).fetchall()
        
        result = []
        for order_row in orders_result:
            # Parse JSON items
            items = []
            total_quantity = 0
            total_amount = 0
            
            if order_row.ChiTietDonHang:
                try:
                    items = json.loads(order_row.ChiTietDonHang)
                    total_quantity = sum(item.get('SoLuongDat', 0) for item in items)
                    total_amount = sum(item.get('ThanhTien', 0) for item in items)
                except:
                    pass
            
            result.append({
                'MaDonHang': order_row.MaDonHang,
                'TenNCC': order_row.TenNCC,
                'MaNVTao': order_row.MaNVTao,
                'TenNVTao': order_row.TenNVTao,
                'NgayDat': order_row.NgayDat.isoformat() if order_row.NgayDat else None,
                'MucDich': order_row.MucDich,
                'TrangThai': order_row.TrangThai,
                'MaNVDuyet': order_row.MaNVDuyet,
                'TenNVDuyet': order_row.TenNVDuyet,
                'NgayDuyet': order_row.NgayDuyet.isoformat() if order_row.NgayDuyet else None,
                'LyDoTuChoi': order_row.LyDoTuChoi,
                'items': items,
                'total_items': len(items),
                'total_quantity': total_quantity,
                'total_amount': total_amount
            })
        
        return success_response({
            'orders': result,
            'total': len(result)
        })
    except Exception as e:
        print(f"Get orders error: {str(e)}")
        import traceback
        traceback.print_exc()
        return error_response(f"Error getting orders: {str(e)}", 500)


@orders_bp.route('/orders/<string:ma_don_hang>', methods=['GET'])
@jwt_required()
def get_order(ma_don_hang):
    """Get order details"""
    try:
        sql = text("""
            SELECT 
                d.*,
                nv_tao.Ten as TenNVTao,
                nv_duyet.Ten as TenNVDuyet
            FROM DatHang d
            LEFT JOIN NhanVienKho nv_tao ON d.MaNV = nv_tao.MaNV
            LEFT JOIN NhanVienKho nv_duyet ON d.MaNVDuyet = nv_duyet.MaNV
            WHERE d.MaDonHang = :ma_don_hang
        """)
        
        order_row = db.session.execute(sql, {'ma_don_hang': ma_don_hang}).fetchone()
        
        if not order_row:
            return error_response("Order not found", 404)
        
        # Parse JSON items
        items = []
        if order_row.ChiTietDonHang:
            try:
                items = json.loads(order_row.ChiTietDonHang)
            except:
                pass
        
        order_data = {
            'MaDonHang': order_row.MaDonHang,
            'TenNCC': order_row.TenNCC,
            'MaNV': order_row.MaNV,
            'TenNVTao': order_row.TenNVTao,
            'NgayDat': order_row.NgayDat.isoformat() if order_row.NgayDat else None,
            'MucDich': order_row.MucDich,
            'TrangThai': order_row.TrangThai,
            'MaNVDuyet': order_row.MaNVDuyet,
            'TenNVDuyet': order_row.TenNVDuyet,
            'NgayDuyet': order_row.NgayDuyet.isoformat() if order_row.NgayDuyet else None,
            'LyDoTuChoi': order_row.LyDoTuChoi,
            'items': items
        }
        
        return success_response(order_data)
    except Exception as e:
        return error_response(f"Error getting order: {str(e)}", 500)


@orders_bp.route('/orders/<string:ma_don_hang>/approve', methods=['POST'])
@jwt_required()
@role_required('Quản lý')
def approve_order(ma_don_hang):
    """UC02 Step 5: Approve order (Quản lý only)"""
    try:
        identity = get_jwt_identity()
        
        if isinstance(identity, str):
            ma_nv = identity
        elif isinstance(identity, dict):
            ma_nv = identity.get('id') or identity.get('MaNV') or identity.get('username')
        else:
            ma_nv = str(identity)
        
        sql = text("""
            UPDATE DatHang
            SET TrangThai = 'Đã duyệt',
                MaNVDuyet = :ma_nv,
                NgayDuyet = :ngay_duyet
            WHERE MaDonHang = :ma_don_hang
                AND TrangThai = 'Chờ duyệt'
        """)
        
        result = db.session.execute(sql, {
            'ma_don_hang': ma_don_hang,
            'ma_nv': ma_nv,
            'ngay_duyet': datetime.utcnow()
        })
        
        if result.rowcount == 0:
            return error_response("Order not found or already processed", 404)
        
        db.session.commit()
        
        return success_response({
            'MaDonHang': ma_don_hang,
            'TrangThai': 'Đã duyệt',
            'MaNVDuyet': ma_nv,
            'message': 'Order approved successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        return error_response(f"Error approving order: {str(e)}", 500)


@orders_bp.route('/orders/<string:ma_don_hang>/reject', methods=['POST'])
@jwt_required()
@role_required('Quản lý')
def reject_order(ma_don_hang):
    """Reject order (Quản lý only)"""
    try:
        data = request.get_json()
        
        if not data.get('LyDo'):
            return error_response("LyDo is required", 400)
        
        sql = text("""
            UPDATE DatHang
            SET TrangThai = 'Từ chối',
                LyDoTuChoi = :ly_do
            WHERE MaDonHang = :ma_don_hang
                AND TrangThai = 'Chờ duyệt'
        """)
        
        result = db.session.execute(sql, {
            'ma_don_hang': ma_don_hang,
            'ly_do': data['LyDo']
        })
        
        if result.rowcount == 0:
            return error_response("Order not found or already processed", 404)
        
        db.session.commit()
        
        return success_response({
            'MaDonHang': ma_don_hang,
            'TrangThai': 'Từ chối',
            'LyDoTuChoi': data['LyDo'],
            'message': 'Order rejected'
        })
        
    except Exception as e:
        db.session.rollback()
        return error_response(f"Error rejecting order: {str(e)}", 500)


@orders_bp.route('/orders/<string:ma_don_hang>', methods=['DELETE'])
@jwt_required()
@role_required('Quản lý')
def delete_order(ma_don_hang):
    """Delete order (Manager only, only if not approved)"""
    try:
        sql_check = text("""
            SELECT TrangThai FROM DatHang WHERE MaDonHang = :ma_don_hang
        """)
        
        order = db.session.execute(sql_check, {'ma_don_hang': ma_don_hang}).fetchone()
        
        if not order:
            return error_response("Order not found", 404)
        
        if order.TrangThai == 'Đã duyệt':
            return error_response("Cannot delete approved order", 400)
        
        sql_delete = text("""
            UPDATE DatHang 
            SET MaDonHang = NULL, 
                NgayDat = NULL, 
                MucDich = NULL, 
                TrangThai = NULL, 
                ChiTietDonHang = NULL
            WHERE MaDonHang = :ma_don_hang
        """)
        db.session.execute(sql_delete, {'ma_don_hang': ma_don_hang})
        
        db.session.commit()
        
        return success_response(None, message="Order deleted successfully")
        
    except Exception as e:
        db.session.rollback()
        return error_response(f"Error deleting order: {str(e)}", 500)


@orders_bp.route('/orders/statistics', methods=['GET'])
@jwt_required()
def get_order_statistics():
    """Get order statistics"""
    try:
        sql = text("""
            SELECT 
                TrangThai,
                COUNT(*) as count
            FROM DatHang
            WHERE MaDonHang IS NOT NULL
            GROUP BY TrangThai
        """)
        
        results = db.session.execute(sql).fetchall()
        
        stats = {
            'total': 0,
            'pending': 0,
            'approved': 0,
            'rejected': 0
        }
        
        for row in results:
            stats['total'] += row.count
            if row.TrangThai == 'Chờ duyệt':
                stats['pending'] = row.count
            elif row.TrangThai == 'Đã duyệt':
                stats['approved'] = row.count
            elif row.TrangThai == 'Từ chối':
                stats['rejected'] = row.count
        
        return success_response(stats)
    except Exception as e:
        return error_response(f"Error getting statistics: {str(e)}", 500)
