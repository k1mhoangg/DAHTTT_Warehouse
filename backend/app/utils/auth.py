"""Decorator for role-based authorization"""

from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request, get_jwt
from app.models import NhanVienKho, ThuNgan


def role_required(*allowed_roles):
    """
    Decorator to check if user has required role
    
    Usage:
        @role_required('QuanLy', 'NhanVien')
        def some_function():
            pass
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            
            user_role = claims.get('role')
            user_type = claims.get('type')
            
            # Convert allowed_roles to set for comparison
            allowed = set(allowed_roles)
            
            # Check if user's role or type is in allowed roles
            if user_role not in allowed and user_type not in allowed:
                return jsonify({
                    "success": False,
                    "error": "Forbidden",
                    "message": "You don't have permission to access this resource"
                }), 403
            
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def get_current_user():
    """Get current authenticated user from JWT token"""
    verify_jwt_in_request()
    claims = get_jwt_identity()
    
    user_id = claims.get('id')
    user_type = claims.get('type')
    
    if user_type == 'NhanVienKho':
        return NhanVienKho.query.get(user_id)
    elif user_type == 'ThuNgan':
        return ThuNgan.query.get(user_id)
    
    return None
