"""
SQLAlchemy Models for Warehouse Management System
Dựa trên database schema từ init.sql
"""

from app import db
from datetime import datetime
from enum import Enum


class GioiTinh(Enum):
    """Giới tính"""
    NAM = "Nam"
    NU = "Nữ"
    KHAC = "Khác"


class TrangThaiSP(Enum):
    """Trạng thái sản phẩm"""
    CON_HANG = "Còn hàng"
    HET_HANG = "Hết hàng"
    NGUNG_KINH_DOANH = "Ngừng kinh doanh"


class LoaiKho(Enum):
    """Loại kho"""
    KHO_THUONG = "Kho thường"
    KHO_LOI = "Kho lỗi"


class RoleNV(Enum):
    """Role nhân viên kho"""
    NHAN_VIEN = "Nhân viên"
    QUAN_LY = "Quản lý"


# =============================================
# NHÂN VIÊN
# =============================================

class ThuNgan(db.Model):
    __tablename__ = "ThuNgan"
    
    MaNV = db.Column(db.String(20), primary_key=True)
    Ten = db.Column(db.String(100), nullable=False)
    DiaChi = db.Column(db.String(200))
    NgaySinh = db.Column(db.Date)
    GioiTinh = db.Column(db.Enum(GioiTinh, values_callable=lambda x: [e.value for e in x]))
    SDT = db.Column(db.String(15))
    TaiKhoanNV = db.Column(db.String(50), unique=True)
    MatKhau = db.Column(db.String(255))  # Added for authentication
    
    # Relationships
    hoa_dons = db.relationship("HoaDon", back_populates="thu_ngan")
    
    def to_dict(self):
        return {
            "MaNV": self.MaNV,
            "Ten": self.Ten,
            "DiaChi": self.DiaChi,
            "NgaySinh": self.NgaySinh.isoformat() if self.NgaySinh else None,
            "GioiTinh": self.GioiTinh.value if self.GioiTinh else None,
            "SDT": self.SDT,
            "TaiKhoanNV": self.TaiKhoanNV,
        }


class NhanVienKho(db.Model):
    __tablename__ = "NhanVienKho"
    
    MaNV = db.Column(db.String(20), primary_key=True)
    Ten = db.Column(db.String(100), nullable=False)
    DiaChi = db.Column(db.String(200))
    NgaySinh = db.Column(db.Date)
    GioiTinh = db.Column(db.Enum(GioiTinh, values_callable=lambda x: [e.value for e in x]))
    SDT = db.Column(db.String(15))
    TaiKhoanNV = db.Column(db.String(50), unique=True)
    Role = db.Column(db.Enum(RoleNV, values_callable=lambda x: [e.value for e in x]), default=RoleNV.NHAN_VIEN)
    MatKhau = db.Column(db.String(255))  # Added for authentication
    
    # Relationships
    bao_caos = db.relationship("BaoCao", back_populates="nhan_vien")
    xu_ly_tra_hangs = db.relationship("XuLyTraHang", back_populates="nhan_vien")
    dat_hangs = db.relationship("DatHang", back_populates="nhan_vien")
    tra_hangs = db.relationship("TraHang", back_populates="nhan_vien")
    
    def to_dict(self):
        return {
            "MaNV": self.MaNV,
            "Ten": self.Ten,
            "DiaChi": self.DiaChi,
            "NgaySinh": self.NgaySinh.isoformat() if self.NgaySinh else None,
            "GioiTinh": self.GioiTinh.value if self.GioiTinh else None,
            "SDT": self.SDT,
            "TaiKhoanNV": self.TaiKhoanNV,
            "Role": self.Role.value if self.Role else None,
        }


# =============================================
# NHÀ CUNG CẤP
# =============================================

class NhaCungCap(db.Model):
    __tablename__ = "NhaCungCap"
    
    Ten = db.Column(db.String(100), primary_key=True)
    PhuongThucLienHe = db.Column(db.String(200))
    
    # Relationships
    dat_hangs = db.relationship("DatHang", back_populates="nha_cung_cap")
    lo_thuoc_nccs = db.relationship("LoThuocNCC", back_populates="nha_cung_cap")
    tra_hangs = db.relationship("TraHang", back_populates="nha_cung_cap")
    
    def to_dict(self):
        return {
            "Ten": self.Ten,
            "PhuongThucLienHe": self.PhuongThucLienHe,
        }


# =============================================
# SẢN PHẨM
# =============================================

class SanPham(db.Model):
    __tablename__ = "SanPham"
    
    MaSP = db.Column(db.String(20), primary_key=True)
    TenSP = db.Column(db.String(200), nullable=False)
    LoaiSP = db.Column(db.String(100))
    TrangThai = db.Column(db.Enum(TrangThaiSP, values_callable=lambda x: [e.value for e in x]), default=TrangThaiSP.CON_HANG)
    DVT = db.Column(db.String(20))  # Đơn vị tính
    GiaBan = db.Column(db.Numeric(15, 2), nullable=False)
    MucCanhBaoDatHang = db.Column(db.Integer, default=10)
    
    # Relationships
    lo_sps = db.relationship("LoSP", back_populates="san_pham", cascade="all, delete-orphan")
    hoa_don_sps = db.relationship("HoaDonSP", back_populates="san_pham")
    
    def to_dict(self):
        return {
            "MaSP": self.MaSP,
            "TenSP": self.TenSP,
            "LoaiSP": self.LoaiSP,
            "TrangThai": self.TrangThai.value if self.TrangThai else None,
            "DVT": self.DVT,
            "GiaBan": float(self.GiaBan),
            "MucCanhBaoDatHang": self.MucCanhBaoDatHang,
        }


# =============================================
# KHO HÀNG
# =============================================

class KhoHang(db.Model):
    __tablename__ = "KhoHang"
    
    MaKho = db.Column(db.String(20), primary_key=True)
    DiaChi = db.Column(db.String(200))
    Loai = db.Column(db.Enum(LoaiKho, values_callable=lambda x: [e.value for e in x]), nullable=False)
    SucChua = db.Column(db.Integer)
    MaPhieuXK = db.Column(db.String(20))
    MaPhieuNK = db.Column(db.String(20))
    
    # Relationships
    lo_sps = db.relationship("LoSP", back_populates="kho")
    phieu_chuyen_kho_xuat = db.relationship(
        "PhieuChuyenKho",
        foreign_keys="PhieuChuyenKho.KhoXuat",
        back_populates="kho_xuat"
    )
    phieu_chuyen_kho_nhap = db.relationship(
        "PhieuChuyenKho",
        foreign_keys="PhieuChuyenKho.KhoNhap",
        back_populates="kho_nhap"
    )
    phieu_kiem_khos = db.relationship("PhieuKiemKho", back_populates="kho")
    
    def to_dict(self):
        return {
            "MaKho": self.MaKho,
            "DiaChi": self.DiaChi,
            "Loai": self.Loai.value if self.Loai else None,
            "SucChua": self.SucChua,
            "MaPhieuXK": self.MaPhieuXK,
            "MaPhieuNK": self.MaPhieuNK,
        }


# =============================================
# PHIẾU KHO
# =============================================

class PhieuChuyenKho(db.Model):
    __tablename__ = "PhieuChuyenKho"
    
    MaPhieu = db.Column(db.String(20), primary_key=True)
    NgayTao = db.Column(db.DateTime, default=datetime.utcnow)
    MucDich = db.Column(db.String(200))
    MaThamChieu = db.Column(db.String(50))
    KhoXuat = db.Column(db.String(20), db.ForeignKey("KhoHang.MaKho"))
    KhoNhap = db.Column(db.String(20), db.ForeignKey("KhoHang.MaKho"))
    
    # Relationships
    kho_xuat = db.relationship(
        "KhoHang",
        foreign_keys=[KhoXuat],
        back_populates="phieu_chuyen_kho_xuat"
    )
    kho_nhap = db.relationship(
        "KhoHang",
        foreign_keys=[KhoNhap],
        back_populates="phieu_chuyen_kho_nhap"
    )
    phieu_nhap_khos = db.relationship("PhieuNhapKho", back_populates="phieu_chuyen_kho")
    phieu_xuat_khos = db.relationship("PhieuXuatKho", back_populates="phieu_chuyen_kho")
    
    def to_dict(self):
        return {
            "MaPhieu": self.MaPhieu,
            "NgayTao": self.NgayTao.isoformat() if self.NgayTao else None,
            "MucDich": self.MucDich,
            "MaThamChieu": self.MaThamChieu,
            "KhoXuat": self.KhoXuat,
            "KhoNhap": self.KhoNhap,
        }


class PhieuNhapKho(db.Model):
    __tablename__ = "PhieuNhapKho"
    
    MaPhieu = db.Column(db.String(20), primary_key=True)
    NgayTao = db.Column(db.DateTime, default=datetime.utcnow)
    MucDich = db.Column(db.String(200))
    MaThamChieu = db.Column(db.String(50))
    MaPhieuCK = db.Column(db.String(20), db.ForeignKey("PhieuChuyenKho.MaPhieu"))
    
    # Relationships
    phieu_chuyen_kho = db.relationship("PhieuChuyenKho", back_populates="phieu_nhap_khos")
    lo_sps = db.relationship("LoSP", back_populates="phieu_nhap_kho")
    
    def to_dict(self):
        return {
            "MaPhieu": self.MaPhieu,
            "NgayTao": self.NgayTao.isoformat() if self.NgayTao else None,
            "MucDich": self.MucDich,
            "MaThamChieu": self.MaThamChieu,
            "MaPhieuCK": self.MaPhieuCK,
        }


class PhieuXuatKho(db.Model):
    __tablename__ = "PhieuXuatKho"
    
    MaPhieu = db.Column(db.String(20), primary_key=True)
    NgayTao = db.Column(db.DateTime, default=datetime.utcnow)
    MucDich = db.Column(db.String(200))
    MaThamChieu = db.Column(db.String(50))
    MaPhieuCK = db.Column(db.String(20), db.ForeignKey("PhieuChuyenKho.MaPhieu"))
    
    # Relationships
    phieu_chuyen_kho = db.relationship("PhieuChuyenKho", back_populates="phieu_xuat_khos")
    lo_sps = db.relationship("LoSP", back_populates="phieu_xuat_kho")
    
    def to_dict(self):
        return {
            "MaPhieu": self.MaPhieu,
            "NgayTao": self.NgayTao.isoformat() if self.NgayTao else None,
            "MucDich": self.MucDich,
            "MaThamChieu": self.MaThamChieu,
            "MaPhieuCK": self.MaPhieuCK,
        }


class PhieuKiemKho(db.Model):
    __tablename__ = "PhieuKiemKho"
    
    MaPhieu = db.Column(db.String(20), primary_key=True)
    NgayTao = db.Column(db.DateTime, default=datetime.utcnow)
    MucDich = db.Column(db.String(200))
    MaThamChieu = db.Column(db.String(50))
    MaKho = db.Column(db.String(20), db.ForeignKey("KhoHang.MaKho"))
    
    # Relationships
    kho = db.relationship("KhoHang", back_populates="phieu_kiem_khos")
    bao_caos = db.relationship("BaoCao", back_populates="phieu_kiem_kho", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "MaPhieu": self.MaPhieu,
            "NgayTao": self.NgayTao.isoformat() if self.NgayTao else None,
            "MucDich": self.MucDich,
            "MaThamChieu": self.MaThamChieu,
            "MaKho": self.MaKho,
        }


# =============================================
# BÁO CÁO
# =============================================

class BaoCao(db.Model):
    __tablename__ = "BaoCao"
    
    MaPhieu = db.Column(db.String(20), db.ForeignKey("PhieuKiemKho.MaPhieu"), primary_key=True)
    MaBaoCao = db.Column(db.String(20), primary_key=True)
    SLThucTe = db.Column(db.Integer)
    NgayTao = db.Column(db.DateTime, default=datetime.utcnow)
    MaNV = db.Column(db.String(20), db.ForeignKey("NhanVienKho.MaNV"))
    
    # Relationships
    phieu_kiem_kho = db.relationship("PhieuKiemKho", back_populates="bao_caos")
    nhan_vien = db.relationship("NhanVienKho", back_populates="bao_caos")
    lo_sps = db.relationship("LoSP", back_populates="bao_cao")
    
    def to_dict(self):
        return {
            "MaPhieu": self.MaPhieu,
            "MaBaoCao": self.MaBaoCao,
            "SLThucTe": self.SLThucTe,
            "NgayTao": self.NgayTao.isoformat() if self.NgayTao else None,
            "MaNV": self.MaNV,
        }


# =============================================
# YÊU CẦU TRẢ HÀNG VÀ HÓA ĐƠN
# =============================================

class YeuCauTraHang(db.Model):
    __tablename__ = "YeuCauTraHang"
    
    MaYC = db.Column(db.String(20), primary_key=True)
    NgayTao = db.Column(db.DateTime, default=datetime.utcnow)
    LyDo = db.Column(db.Text)
    
    # Relationships
    hoa_dons = db.relationship("HoaDon", back_populates="yeu_cau_tra_hang")
    xu_ly_tra_hangs = db.relationship("XuLyTraHang", back_populates="yeu_cau_tra_hang")
    tra_hangs = db.relationship("TraHang", back_populates="yeu_cau_tra_hang")
    
    def to_dict(self):
        return {
            "MaYC": self.MaYC,
            "NgayTao": self.NgayTao.isoformat() if self.NgayTao else None,
            "LyDo": self.LyDo,
        }


class HoaDon(db.Model):
    __tablename__ = "HoaDon"
    
    MaHD = db.Column(db.String(20), primary_key=True)
    NgayTao = db.Column(db.DateTime, default=datetime.utcnow)
    MaNVThuNgan = db.Column(db.String(20), db.ForeignKey("ThuNgan.MaNV"))
    MaYCTraHang = db.Column(db.String(20), db.ForeignKey("YeuCauTraHang.MaYC"))
    
    # Relationships
    thu_ngan = db.relationship("ThuNgan", back_populates="hoa_dons")
    yeu_cau_tra_hang = db.relationship("YeuCauTraHang", back_populates="hoa_dons")
    hoa_don_sps = db.relationship("HoaDonSP", back_populates="hoa_don", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "MaHD": self.MaHD,
            "NgayTao": self.NgayTao.isoformat() if self.NgayTao else None,
            "MaNVThuNgan": self.MaNVThuNgan,
            "MaYCTraHang": self.MaYCTraHang,
        }


# =============================================
# LÔ SẢN PHẨM
# =============================================

class LoSP(db.Model):
    __tablename__ = "LoSP"
    
    MaSP = db.Column(db.String(20), db.ForeignKey("SanPham.MaSP"), primary_key=True)
    MaLo = db.Column(db.String(20), primary_key=True)
    MaVach = db.Column(db.String(50), unique=True)
    NSX = db.Column(db.Date)
    HSD = db.Column(db.Date)
    SLTon = db.Column(db.Integer, default=0)
    MaPhieuKiem = db.Column(db.String(20))
    MaBaoCao = db.Column(db.String(20))
    MaKho = db.Column(db.String(20), db.ForeignKey("KhoHang.MaKho"))
    MaPhieuNK = db.Column(db.String(20), db.ForeignKey("PhieuNhapKho.MaPhieu"))
    MaPhieuXK = db.Column(db.String(20), db.ForeignKey("PhieuXuatKho.MaPhieu"))
    
    # Composite foreign key for BaoCao
    __table_args__ = (
        db.ForeignKeyConstraint(
            ['MaPhieuKiem', 'MaBaoCao'],
            ['BaoCao.MaPhieu', 'BaoCao.MaBaoCao']
        ),
    )
    
    # Relationships
    san_pham = db.relationship("SanPham", back_populates="lo_sps")
    kho = db.relationship("KhoHang", back_populates="lo_sps")
    phieu_nhap_kho = db.relationship("PhieuNhapKho", back_populates="lo_sps")
    phieu_xuat_kho = db.relationship("PhieuXuatKho", back_populates="lo_sps")
    bao_cao = db.relationship("BaoCao", back_populates="lo_sps")
    lo_thuoc_nccs = db.relationship("LoThuocNCC", back_populates="lo_sp")
    
    def to_dict(self):
        return {
            "MaSP": self.MaSP,
            "MaLo": self.MaLo,
            "MaVach": self.MaVach,
            "NSX": self.NSX.isoformat() if self.NSX else None,
            "HSD": self.HSD.isoformat() if self.HSD else None,
            "SLTon": self.SLTon,
            "MaPhieuKiem": self.MaPhieuKiem,
            "MaBaoCao": self.MaBaoCao,
            "MaKho": self.MaKho,
            "MaPhieuNK": self.MaPhieuNK,
            "MaPhieuXK": self.MaPhieuXK,
        }


# =============================================
# BẢNG QUAN HỆ
# =============================================

class TaoPhieu(db.Model):
    __tablename__ = "TaoPhieu"
    
    MaNV = db.Column(db.String(20), db.ForeignKey("NhanVienKho.MaNV"), primary_key=True)
    MaPhieuTao = db.Column(db.String(20), primary_key=True)


class DuyetPhieu(db.Model):
    __tablename__ = "DuyetPhieu"
    
    MaNV = db.Column(db.String(20), db.ForeignKey("NhanVienKho.MaNV"), primary_key=True)
    MaPhieuDuyet = db.Column(db.String(20), primary_key=True)


class XuLyTraHang(db.Model):
    __tablename__ = "XuLyTraHang"
    
    MaNV = db.Column(db.String(20), db.ForeignKey("NhanVienKho.MaNV"), primary_key=True)
    MaYCTra = db.Column(db.String(20), db.ForeignKey("YeuCauTraHang.MaYC"), primary_key=True)
    
    # Relationships
    nhan_vien = db.relationship("NhanVienKho", back_populates="xu_ly_tra_hangs")
    yeu_cau_tra_hang = db.relationship("YeuCauTraHang", back_populates="xu_ly_tra_hangs")


class DatHang(db.Model):
    __tablename__ = "DatHang"
    
    TenNCC = db.Column(db.String(100), db.ForeignKey("NhaCungCap.Ten"), primary_key=True)
    MaNV = db.Column(db.String(20), db.ForeignKey("NhanVienKho.MaNV"), primary_key=True)
    
    # Relationships
    nha_cung_cap = db.relationship("NhaCungCap", back_populates="dat_hangs")
    nhan_vien = db.relationship("NhanVienKho", back_populates="dat_hangs")


class LoThuocNCC(db.Model):
    __tablename__ = "LoThuocNCC"
    
    TenNCC = db.Column(db.String(100), db.ForeignKey("NhaCungCap.Ten"), primary_key=True)
    MaLo = db.Column(db.String(20), primary_key=True)
    MaSP = db.Column(db.String(20), primary_key=True)
    
    __table_args__ = (
        db.ForeignKeyConstraint(
            ['MaSP', 'MaLo'],
            ['LoSP.MaSP', 'LoSP.MaLo']
        ),
    )
    
    # Relationships
    nha_cung_cap = db.relationship("NhaCungCap", back_populates="lo_thuoc_nccs")
    lo_sp = db.relationship("LoSP", back_populates="lo_thuoc_nccs")


class TraHang(db.Model):
    __tablename__ = "TraHang"
    
    MaNV = db.Column(db.String(20), db.ForeignKey("NhanVienKho.MaNV"), primary_key=True)
    MaYC = db.Column(db.String(20), db.ForeignKey("YeuCauTraHang.MaYC"), primary_key=True)
    TenNCC = db.Column(db.String(100), db.ForeignKey("NhaCungCap.Ten"), primary_key=True)
    
    # Relationships
    nhan_vien = db.relationship("NhanVienKho", back_populates="tra_hangs")
    yeu_cau_tra_hang = db.relationship("YeuCauTraHang", back_populates="tra_hangs")
    nha_cung_cap = db.relationship("NhaCungCap", back_populates="tra_hangs")


class HoaDonSP(db.Model):
    __tablename__ = "HoaDonSP"
    
    MaSP = db.Column(db.String(20), db.ForeignKey("SanPham.MaSP"), primary_key=True)
    MaHD = db.Column(db.String(20), db.ForeignKey("HoaDon.MaHD"), primary_key=True)
    SoLuong = db.Column(db.Integer, nullable=False)
    
    # Relationships
    san_pham = db.relationship("SanPham", back_populates="hoa_don_sps")
    hoa_don = db.relationship("HoaDon", back_populates="hoa_don_sps")
    
    def to_dict(self):
        return {
            "MaSP": self.MaSP,
            "MaHD": self.MaHD,
            "SoLuong": self.SoLuong,
        }
