"""
Script để seed mật khẩu cho NhanVienKho và ThuNgan
Mật khẩu mặc định: 123456
"""
import bcrypt
from app import create_app, db
from app.models import NhanVienKho, ThuNgan

def hash_password(password):
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def seed_passwords():
    app = create_app()
    with app.app_context():
        default_password = "123456"
        hashed = hash_password(default_password)
        
        # Update NhanVienKho
        nvk_users = NhanVienKho.query.all()
        for user in nvk_users:
            user.MatKhau = hashed
            print(f"Updated password for NhanVienKho: {user.TaiKhoanNV} ({user.MaNV})")
        
        # Update ThuNgan
        tn_users = ThuNgan.query.all()
        for user in tn_users:
            user.MatKhau = hashed
            print(f"Updated password for ThuNgan: {user.TaiKhoanNV} ({user.MaNV})")
        
        db.session.commit()
        print(f"\n✅ Successfully updated passwords for {len(nvk_users)} NhanVienKho and {len(tn_users)} ThuNgan")
        print(f"Default password: {default_password}")
        print("\nLogin credentials:")
        for user in nvk_users:
            print(f"  - Username: {user.TaiKhoanNV}, Password: {default_password}, Role: {user.Role}")
        for user in tn_users:
            print(f"  - Username: {user.TaiKhoanNV}, Password: {default_password}, Role: ThuNgan")

if __name__ == '__main__':
    seed_passwords()
