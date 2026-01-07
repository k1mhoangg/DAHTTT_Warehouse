-- =============================================
-- WAREHOUSE MANAGEMENT SYSTEM - DATABASE INITIALIZATION
-- Hệ thống quản lý kho cho cửa hàng tiện lợi
-- =============================================

DROP DATABASE IF EXISTS QuanLyKho;
CREATE DATABASE QuanLyKho CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE QuanLyKho;

-- =============================================
-- BẢNG NHÂN VIÊN
-- =============================================

-- Bảng Thu Ngân
CREATE TABLE ThuNgan (
    MaNV VARCHAR(20) PRIMARY KEY,
    Ten VARCHAR(100) NOT NULL,
    DiaChi VARCHAR(200),
    NgaySinh DATE,
    GioiTinh ENUM('Nam', 'Nữ', 'Khác'),
    SDT VARCHAR(15),
    TaiKhoanNV VARCHAR(50) UNIQUE,
    MatKhau VARCHAR(250) DEFAULT '123'
);

-- Bảng Nhân Viên Kho
CREATE TABLE NhanVienKho (
    MaNV VARCHAR(20) PRIMARY KEY,
    Ten VARCHAR(100) NOT NULL,
    DiaChi VARCHAR(200),
    NgaySinh DATE,
    GioiTinh ENUM('Nam', 'Nữ', 'Khác'),
    SDT VARCHAR(15),
    TaiKhoanNV VARCHAR(50) UNIQUE,
    Role ENUM('Nhân viên', 'Quản lý') DEFAULT 'Nhân viên',
    MatKhau VARCHAR(250) DEFAULT '123'
);

-- =============================================
-- BẢNG NHÀ CUNG CẤP
-- =============================================

CREATE TABLE NhaCungCap (
    Ten VARCHAR(100) PRIMARY KEY,
    PhuongThucLienHe VARCHAR(200)
);

-- =============================================
-- BẢNG SẢN PHẨM
-- =============================================

CREATE TABLE SanPham (
    MaSP VARCHAR(20) PRIMARY KEY,
    TenSP VARCHAR(200) NOT NULL,
    LoaiSP VARCHAR(100),
    TrangThai ENUM('Còn hàng', 'Hết hàng', 'Ngừng kinh doanh') DEFAULT 'Còn hàng',
    DVT VARCHAR(20), -- Đơn vị tính
    GiaBan DECIMAL(15,2) NOT NULL,
    MucCanhBaoDatHang INT DEFAULT 10
);

-- =============================================
-- BẢNG KHO HÀNG
-- =============================================

CREATE TABLE KhoHang (
    MaKho VARCHAR(20) PRIMARY KEY,
    DiaChi VARCHAR(200),
    Loai ENUM('Kho thường', 'Kho lỗi') NOT NULL,
    SucChua INT,
    MaPhieuXK VARCHAR(20),
    MaPhieuNK VARCHAR(20)
);

-- =============================================
-- BẢNG PHIẾU KHO
-- =============================================

-- Phiếu Chuyển Kho
CREATE TABLE PhieuChuyenKho (
    MaPhieu VARCHAR(20) PRIMARY KEY,
    NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP,
    MucDich VARCHAR(200),
    MaThamChieu VARCHAR(50),
    KhoXuat VARCHAR(20),
    KhoNhap VARCHAR(20),
    FOREIGN KEY (KhoXuat) REFERENCES KhoHang(MaKho),
    FOREIGN KEY (KhoNhap) REFERENCES KhoHang(MaKho)
);

-- Phiếu Nhập Kho
CREATE TABLE PhieuNhapKho (
    MaPhieu VARCHAR(20) PRIMARY KEY,
    NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP,
    MucDich VARCHAR(200),
    MaThamChieu VARCHAR(50),
    MaPhieuCK VARCHAR(20),
    FOREIGN KEY (MaPhieuCK) REFERENCES PhieuChuyenKho(MaPhieu)
);

-- Phiếu Xuất Kho
CREATE TABLE PhieuXuatKho (
    MaPhieu VARCHAR(20) PRIMARY KEY,
    NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP,
    MucDich VARCHAR(200),
    MaThamChieu VARCHAR(50),
    MaPhieuCK VARCHAR(20),
    FOREIGN KEY (MaPhieuCK) REFERENCES PhieuChuyenKho(MaPhieu)
);

-- Phiếu Kiểm Kho
CREATE TABLE PhieuKiemKho (
    MaPhieu VARCHAR(20) PRIMARY KEY,
    NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP,
    MucDich VARCHAR(200),
    MaThamChieu VARCHAR(50),
    MaKho VARCHAR(20),
    FOREIGN KEY (MaKho) REFERENCES KhoHang(MaKho)
);

-- =============================================
-- BẢNG BÁO CÁO
-- =============================================

CREATE TABLE BaoCao (
    MaPhieu VARCHAR(20),
    MaBaoCao VARCHAR(20),
    SLThucTe INT,
    NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP,
    MaNV VARCHAR(20),
    PRIMARY KEY (MaPhieu, MaBaoCao),
    FOREIGN KEY (MaPhieu) REFERENCES PhieuKiemKho(MaPhieu),
    FOREIGN KEY (MaNV) REFERENCES NhanVienKho(MaNV)
);

-- =============================================
-- BẢNG YÊU CẦU TRẢ HÀNG VÀ HÓA ĐƠN
-- =============================================

CREATE TABLE YeuCauTraHang (
    MaYC VARCHAR(20) PRIMARY KEY,
    NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP,
    LyDo TEXT
);

CREATE TABLE HoaDon (
    MaHD VARCHAR(20) PRIMARY KEY,
    NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP,
    MaNVThuNgan VARCHAR(20),
    MaYCTraHang VARCHAR(20),
    FOREIGN KEY (MaNVThuNgan) REFERENCES ThuNgan(MaNV),
    FOREIGN KEY (MaYCTraHang) REFERENCES YeuCauTraHang(MaYC)
);

-- =============================================
-- BẢNG LÔ SẢN PHẨM
-- =============================================

CREATE TABLE LoSP (
    MaSP VARCHAR(20),
    MaLo VARCHAR(20),
    MaVach VARCHAR(50) UNIQUE,
    NSX DATE,
    HSD DATE,
    SLTon INT DEFAULT 0,
    MaPhieuKiem VARCHAR(20),
    MaBaoCao VARCHAR(20),
    MaKho VARCHAR(20),
    MaPhieuNK VARCHAR(20),
    MaPhieuXK VARCHAR(20),
    PRIMARY KEY (MaSP, MaLo),
    FOREIGN KEY (MaSP) REFERENCES SanPham(MaSP),
    FOREIGN KEY (MaKho) REFERENCES KhoHang(MaKho),
    FOREIGN KEY (MaPhieuNK) REFERENCES PhieuNhapKho(MaPhieu),
    FOREIGN KEY (MaPhieuXK) REFERENCES PhieuXuatKho(MaPhieu),
    FOREIGN KEY (MaPhieuKiem, MaBaoCao) REFERENCES BaoCao(MaPhieu, MaBaoCao)
);

-- =============================================
-- BẢNG QUAN HỆ
-- =============================================

-- Tạo Phiếu (Nhân viên kho tạo các phiếu)
CREATE TABLE TaoPhieu (
    MaNV VARCHAR(20),
    MaPhieuTao VARCHAR(20),
    PRIMARY KEY (MaNV, MaPhieuTao),
    FOREIGN KEY (MaNV) REFERENCES NhanVienKho(MaNV)
);

-- Duyệt Phiếu (Nhân viên kho duyệt các phiếu)
CREATE TABLE DuyetPhieu (
    MaNV VARCHAR(20),
    MaPhieuDuyet VARCHAR(20),
    PRIMARY KEY (MaNV, MaPhieuDuyet),
    FOREIGN KEY (MaNV) REFERENCES NhanVienKho(MaNV)
);

-- Xử Lý Trả Hàng (Nhân viên kho xử lý yêu cầu trả hàng)
CREATE TABLE XuLyTraHang (
    MaNV VARCHAR(20),
    MaYCTra VARCHAR(20),
    PRIMARY KEY (MaNV, MaYCTra),
    FOREIGN KEY (MaNV) REFERENCES NhanVienKho(MaNV),
    FOREIGN KEY (MaYCTra) REFERENCES YeuCauTraHang(MaYC)
);

-- Đặt Hàng (Nhân viên kho đặt hàng từ nhà cung cấp)
CREATE TABLE DatHang (
    TenNCC VARCHAR(100),
    MaNV VARCHAR(20),
    MaDonHang VARCHAR(20),
    NgayDat DATETIME DEFAULT CURRENT_TIMESTAMP,
    MucDich VARCHAR(200),
    TrangThai ENUM('Chờ duyệt', 'Đã duyệt', 'Từ chối') DEFAULT 'Chờ duyệt',
    MaNVDuyet VARCHAR(20),
    NgayDuyet DATETIME,
    LyDoTuChoi TEXT,
    ChiTietDonHang JSON,
    PRIMARY KEY (TenNCC, MaNV),
    FOREIGN KEY (TenNCC) REFERENCES NhaCungCap(Ten),
    FOREIGN KEY (MaNV) REFERENCES NhanVienKho(MaNV),
    FOREIGN KEY (MaNVDuyet) REFERENCES NhanVienKho(MaNV)
);

-- Lô Thuốc từ Nhà Cung Cấp
CREATE TABLE LoThuocNCC (
    TenNCC VARCHAR(100),
    MaLo VARCHAR(20),
    MaSP VARCHAR(20),
    PRIMARY KEY (TenNCC, MaLo, MaSP),
    FOREIGN KEY (TenNCC) REFERENCES NhaCungCap(Ten),
    FOREIGN KEY (MaSP, MaLo) REFERENCES LoSP(MaSP, MaLo)
);

-- Trả Hàng (Nhân viên kho trả hàng về cho nhà cung cấp)
CREATE TABLE TraHang (
    MaNV VARCHAR(20),
    MaYC VARCHAR(20),
    TenNCC VARCHAR(100),
    PRIMARY KEY (MaNV, MaYC, TenNCC),
    FOREIGN KEY (MaNV) REFERENCES NhanVienKho(MaNV),
    FOREIGN KEY (MaYC) REFERENCES YeuCauTraHang(MaYC),
    FOREIGN KEY (TenNCC) REFERENCES NhaCungCap(Ten)
);

-- Hóa Đơn - Sản Phẩm (Chi tiết sản phẩm trong hóa đơn)
CREATE TABLE HoaDonSP (
    MaSP VARCHAR(20),
    MaHD VARCHAR(20),
    SoLuong INT NOT NULL,
    PRIMARY KEY (MaSP, MaHD),
    FOREIGN KEY (MaSP) REFERENCES SanPham(MaSP),
    FOREIGN KEY (MaHD) REFERENCES HoaDon(MaHD)
);

-- =============================================
-- DỮ LIỆU MẪU
-- =============================================

-- Thêm Kho Hàng
INSERT INTO KhoHang (MaKho, DiaChi, Loai, SucChua) VALUES
('KHO001', '123 Nguyễn Văn Linh, Q7, TP.HCM', 'Kho thường', 5000),
('KHO002', '456 Lê Văn Việt, Q9, TP.HCM', 'Kho lỗi', 1000);

-- Thêm Nhân Viên Kho
INSERT INTO NhanVienKho (MaNV, Ten, DiaChi, NgaySinh, GioiTinh, SDT, TaiKhoanNV, Role) VALUES
('NVK001', 'Nguyễn Văn An', '12 Trần Hưng Đạo, Q1', '1990-05-15', 'Nam', '0901234567', 'nva_kho', 'Quản lý'),
('NVK002', 'Trần Thị Bình', '34 Lê Lợi, Q3', '1995-08-20', 'Nữ', '0912345678', 'ttb_kho', 'Nhân viên'),
('NVK003', 'Lê Văn Cường', '56 Hai Bà Trưng, Q1', '1992-03-10', 'Nam', '0923456789', 'lvc_kho', 'Nhân viên');

-- Thêm Thu Ngân
INSERT INTO ThuNgan (MaNV, Ten, DiaChi, NgaySinh, GioiTinh, SDT, TaiKhoanNV) VALUES
('TN001', 'Phạm Thị Dung', '78 Nguyễn Huệ, Q1', '1998-11-25', 'Nữ', '0934567890', 'ptd_thungan'),
('TN002', 'Hoàng Văn Em', '90 Điện Biên Phủ, Q3', '1997-07-18', 'Nam', '0945678901', 'hve_thungan');

-- Thêm Nhà Cung Cấp
INSERT INTO NhaCungCap (Ten, PhuongThucLienHe) VALUES
('Công ty TNHH Thực phẩm Sạch', 'Email: contact@thucphamsach.vn, SĐT: 028-3838-1234'),
('Công ty CP Nước Giải Khát Việt Nam', 'Email: sales@beverage.vn, SĐT: 028-3838-5678'),
('Công ty TNHH Đồ Dùng Gia Đình', 'Email: info@dodunggiadinh.vn, SĐT: 028-3838-9012'),
('Công ty CP Vệ Sinh Môi Trường', 'Email: cs@vesinhmt.vn, SĐT: 028-3838-3456');

-- Thêm Sản Phẩm
INSERT INTO SanPham (MaSP, TenSP, LoaiSP, TrangThai, DVT, GiaBan, MucCanhBaoDatHang) VALUES
('SP001', 'Gạo ST25', 'Thực phẩm', 'Còn hàng', 'Kg', 25000, 100),
('SP002', 'Dầu ăn Simply', 'Thực phẩm', 'Còn hàng', 'Chai', 45000, 50),
('SP003', 'Nước ngọt Coca Cola', 'Đồ uống', 'Còn hàng', 'Lon', 12000, 200),
('SP004', 'Sữa tươi Vinamilk', 'Đồ uống', 'Còn hàng', 'Hộp', 8000, 150),
('SP005', 'Bánh mì sandwich', 'Thực phẩm', 'Còn hàng', 'Gói', 15000, 80),
('SP006', 'Nước rửa chén Sunlight', 'Vệ sinh', 'Còn hàng', 'Chai', 35000, 40),
('SP007', 'Giấy vệ sinh Pulppy', 'Vệ sinh', 'Còn hàng', 'Cuộn', 6000, 100),
('SP008', 'Mì gói Hảo Hảo', 'Thực phẩm', 'Còn hàng', 'Gói', 3500, 300),
('SP009', 'Trứng gà', 'Thực phẩm', 'Còn hàng', 'Vỉ', 35000, 60),
('SP010', 'Nước tương Chinsu', 'Gia vị', 'Còn hàng', 'Chai', 18000, 70);

-- Thêm Phiếu Nhập Kho
INSERT INTO PhieuNhapKho (MaPhieu, NgayTao, MucDich, MaThamChieu) VALUES
('PNK001', '2024-12-01 08:00:00', 'Nhập hàng từ nhà cung cấp', 'DH001'),
('PNK002', '2024-12-03 09:30:00', 'Nhập hàng từ nhà cung cấp', 'DH002'),
('PNK003', '2024-12-05 10:15:00', 'Nhập hàng từ nhà cung cấp', 'DH003');

-- Thêm Phiếu Xuất Kho
INSERT INTO PhieuXuatKho (MaPhieu, NgayTao, MucDich, MaThamChieu) VALUES
('PXK001', '2024-12-02 14:00:00', 'Xuất hàng bán lẻ', 'HD001'),
('PXK002', '2024-12-04 15:30:00', 'Xuất hàng bán lẻ', 'HD002');

-- Thêm Lô Sản Phẩm
INSERT INTO LoSP (MaSP, MaLo, MaVach, NSX, HSD, SLTon, MaKho, MaPhieuNK) VALUES
('SP001', 'LO001', '8936012345001', '2024-11-01', '2025-11-01', 500, 'KHO001', 'PNK001'),
('SP002', 'LO002', '8936012345002', '2024-10-15', '2025-10-15', 200, 'KHO001', 'PNK001'),
('SP003', 'LO003', '8936012345003', '2024-11-20', '2025-05-20', 800, 'KHO001', 'PNK002'),
('SP004', 'LO004', '8936012345004', '2024-12-01', '2025-01-01', 600, 'KHO001', 'PNK002'),
('SP005', 'LO005', '8936012345005', '2024-11-28', '2024-12-05', 300, 'KHO001', 'PNK003'),
('SP006', 'LO006', '8936012345006', '2024-09-01', '2026-09-01', 150, 'KHO001', 'PNK003'),
('SP007', 'LO007', '8936012345007', '2024-10-01', '2027-10-01', 400, 'KHO001', 'PNK001'),
('SP008', 'LO008', '8936012345008', '2024-11-15', '2025-05-15', 1000, 'KHO001', 'PNK002'),
('SP009', 'LO009', '8936012345009', '2024-12-08', '2024-12-22', 200, 'KHO001', 'PNK003'),
('SP010', 'LO010', '8936012345010', '2024-08-01', '2026-08-01', 250, 'KHO001', 'PNK001');

-- Thêm LoThuocNCC (Liên kết lô sản phẩm với nhà cung cấp)
INSERT INTO LoThuocNCC (TenNCC, MaLo, MaSP) VALUES
('Công ty TNHH Thực phẩm Sạch', 'LO001', 'SP001'),
('Công ty TNHH Thực phẩm Sạch', 'LO002', 'SP002'),
('Công ty CP Nước Giải Khát Việt Nam', 'LO003', 'SP003'),
('Công ty CP Nước Giải Khát Việt Nam', 'LO004', 'SP004'),
('Công ty TNHH Thực phẩm Sạch', 'LO005', 'SP005'),
('Công ty TNHH Đồ Dùng Gia Đình', 'LO006', 'SP006'),
('Công ty CP Vệ Sinh Môi Trường', 'LO007', 'SP007'),
('Công ty TNHH Thực phẩm Sạch', 'LO008', 'SP008'),
('Công ty TNHH Thực phẩm Sạch', 'LO009', 'SP009'),
('Công ty TNHH Thực phẩm Sạch', 'LO010', 'SP010');

-- Thêm Hóa Đơn
INSERT INTO HoaDon (MaHD, NgayTao, MaNVThuNgan) VALUES
('HD001', '2024-12-02 16:30:00', 'TN001'),
('HD002', '2024-12-04 17:45:00', 'TN002'),
('HD003', '2024-12-06 10:20:00', 'TN001');

-- Thêm Chi Tiết Hóa Đơn
INSERT INTO HoaDonSP (MaSP, MaHD, SoLuong) VALUES
('SP001', 'HD001', 5),
('SP003', 'HD001', 12),
('SP004', 'HD001', 6),
('SP005', 'HD002', 10),
('SP006', 'HD002', 3),
('SP008', 'HD003', 20),
('SP009', 'HD003', 4);

-- Thêm TaoPhieu (Nhân viên kho tạo phiếu)
INSERT INTO TaoPhieu (MaNV, MaPhieuTao) VALUES
('NVK002', 'PNK001'),
('NVK002', 'PNK002'),
('NVK003', 'PNK003'),
('NVK002', 'PXK001'),
('NVK003', 'PXK002');

-- Thêm DuyetPhieu (Quản lý duyệt phiếu)
INSERT INTO DuyetPhieu (MaNV, MaPhieuDuyet) VALUES
('NVK001', 'PNK001'),
('NVK001', 'PNK002'),
('NVK001', 'PNK003'),
('NVK001', 'PXK001'),
('NVK001', 'PXK002');

-- Thêm DatHang (Bao gồm dữ liệu cho UC02)
INSERT INTO DatHang (TenNCC, MaNV, MaDonHang, NgayDat, MucDich, TrangThai, MaNVDuyet, NgayDuyet, ChiTietDonHang) VALUES
('Công ty TNHH Thực phẩm Sạch', 'NVK002', 'DH000001', '2024-11-28 10:00:00', 'Đặt hàng định kỳ', 'Đã duyệt', 'NVK001', '2024-11-28 14:30:00', 
    JSON_ARRAY(
        JSON_OBJECT('MaSP', 'SP001', 'TenSP', 'Gạo ST25', 'SoLuong', 500, 'DonGia', 23000),
        JSON_OBJECT('MaSP', 'SP002', 'TenSP', 'Dầu ăn Simply', 'SoLuong', 200, 'DonGia', 42000)
    )),
('Công ty CP Nước Giải Khát Việt Nam', 'NVK002', 'DH000002', '2024-12-01 09:15:00', 'Đặt hàng định kỳ', 'Đã duyệt', 'NVK001', '2024-12-01 15:00:00',
    JSON_ARRAY(
        JSON_OBJECT('MaSP', 'SP003', 'TenSP', 'Nước ngọt Coca Cola', 'SoLuong', 800, 'DonGia', 10500),
        JSON_OBJECT('MaSP', 'SP004', 'TenSP', 'Sữa tươi Vinamilk', 'SoLuong', 600, 'DonGia', 7500)
    )),
('Công ty TNHH Đồ Dùng Gia Đình', 'NVK003', 'DH000003', '2024-12-03 11:20:00', 'Bổ sung hàng', 'Đã duyệt', 'NVK001', '2024-12-03 16:45:00',
    JSON_ARRAY(
        JSON_OBJECT('MaSP', 'SP006', 'TenSP', 'Nước rửa chén Sunlight', 'SoLuong', 150, 'DonGia', 33000)
    )),
('Công ty CP Vệ Sinh Môi Trường', 'NVK003', 'DH000004', '2024-12-05 08:30:00', 'Đặt hàng khẩn cấp', 'Chờ duyệt', NULL, NULL,
    JSON_ARRAY(
        JSON_OBJECT('MaSP', 'SP007', 'TenSP', 'Giấy vệ sinh Pulppy', 'SoLuong', 500, 'DonGia', 5500)
    ));

-- =============================================
-- CÁC INDEX ĐỂ TỐI ƯU TRUY VẤN
-- =============================================

CREATE INDEX idx_losp_kho ON LoSP(MaKho);
CREATE INDEX idx_losp_hsd ON LoSP(HSD);
CREATE INDEX idx_hoadon_ngay ON HoaDon(NgayTao);
CREATE INDEX idx_phieunhap_ngay ON PhieuNhapKho(NgayTao);
CREATE INDEX idx_phieuxuat_ngay ON PhieuXuatKho(NgayTao);
CREATE INDEX idx_sanpham_loai ON SanPham(LoaiSP);
CREATE INDEX idx_dathang_trangthai ON DatHang(TrangThai);
CREATE INDEX idx_dathang_ngaydat ON DatHang(NgayDat);

-- =============================================
-- KẾT THÚC KHỞI TẠO DATABASE
-- =============================================