"""Authentication routes"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from app.models import NhanVienKho, ThuNgan
from app import db
import bcrypt

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Login endpoint for all user types
    
    Request body:
        {
            "username": "string",
            "password": "string",
            "type": "NhanVienKho" | "ThuNgan"
        }
    """
    data = request.get_json()
    
    username = data.get('username')
    password = data.get('password')
    user_type = data.get('type')
    
    if not username or not password or not user_type:
        return jsonify({
            "success": False,
            "message": "Username, password, and type are required"
        }), 400
    
    # Find user based on type
    user = None
    if user_type == 'NhanVienKho':
        user = NhanVienKho.query.filter_by(TaiKhoanNV=username).first()
    elif user_type == 'ThuNgan':
        user = ThuNgan.query.filter_by(TaiKhoanNV=username).first()
    else:
        return jsonify({
            "success": False,
            "message": "Invalid user type"
        }), 400
    
    if not user:
        return jsonify({
            "success": False,
            "message": "Invalid credentials"
        }), 401
    
    # Verify password
    if not user.MatKhau:
        return jsonify({
            "success": False,
            "message": "Password not set for this user"
        }), 401
    
    if not bcrypt.checkpw(password.encode('utf-8'), user.MatKhau.encode('utf-8')):
        return jsonify({
            "success": False,
            "message": "Invalid credentials"
        }), 401
    
    # Create JWT token with user info
    additional_claims = {
        "type": user_type,
        "role": user.Role.value if user_type == 'NhanVienKho' else 'ThuNgan',
        "username": user.TaiKhoanNV,
        "name": user.Ten
    }

    access_token = create_access_token(
        identity=str(user.MaNV),      # <-- BẮT BUỘC PHẢI LÀ STRING HOẶC INT
        additional_claims=additional_claims
    )

    
    return jsonify({
        "success": True,
        "message": "Login successful",
        "data": {
            "access_token": access_token,
            "user": {
                "MaNV": user.MaNV,
                "Ten": user.Ten,
                "TaiKhoanNV": user.TaiKhoanNV,
                "Role": additional_claims["role"],
                "Type": user_type
            }
        }
    }), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current authenticated user info"""
    
    user_id = get_jwt_identity()  # string: "NVK001"
    claims = get_jwt()            # object chứa claims (type, role, name)

    user_type = claims.get("type")
    
    # Load user
    user = None
    if user_type == 'NhanVienKho':
        user = NhanVienKho.query.get(user_id)
    elif user_type == 'ThuNgan':
        user = ThuNgan.query.get(user_id)

    if not user:
        return jsonify({
            "success": False,
            "message": "User not found"
        }), 404

    return jsonify({
        "success": True,
        "data": {
            **user.to_dict(),
            "Type": user_type,
            "Role": claims.get("role"),
            "Username": claims.get("username"),
            "Name": claims.get("name"),
        }
    }), 200



@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logout endpoint (client-side should remove token)"""
    
    return jsonify({
        "success": True,
        "message": "Logout successful"
    }), 200


@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """
    Change password for authenticated user
    
    Request body:
        {
            "old_password": "string",
            "new_password": "string"
        }
    """
    data = request.get_json()
    claims = get_jwt_identity()
    
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    
    if not old_password or not new_password:
        return jsonify({
            "success": False,
            "message": "Old password and new password are required"
        }), 400
    
    if len(new_password) < 6:
        return jsonify({
            "success": False,
            "message": "New password must be at least 6 characters"
        }), 400
    
    # Get user
    user_id = claims.get('id')
    user_type = claims.get('type')
    
    user = None
    if user_type == 'NhanVienKho':
        user = NhanVienKho.query.get(user_id)
    elif user_type == 'ThuNgan':
        user = ThuNgan.query.get(user_id)
    
    if not user:
        return jsonify({
            "success": False,
            "message": "User not found"
        }), 404
    
    # Verify old password
    if not bcrypt.checkpw(old_password.encode('utf-8'), user.MatKhau.encode('utf-8')):
        return jsonify({
            "success": False,
            "message": "Old password is incorrect"
        }), 401
    
    # Hash and update new password
    hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
    user.MatKhau = hashed.decode('utf-8')
    
    db.session.commit()
    
    return jsonify({
        "success": True,
        "message": "Password changed successfully"
    }), 200
